/**
 * viewingService.js: the MAIN TRANSACTION of KejaLink: booking a property viewing.
 *
 * Business rules
 *   - Viewings are Monday to Saturday, one-hour slots from 09:00 to 16:00 (Nairobi time).
 *   - Bookable from tomorrow up to 30 days ahead, and only for 'available' properties.
 *   - One live booking per property per slot, and one per client per property.
 *     Both rules are ALSO enforced by partial unique indexes in the database,
 *     which is the final guard if two people click at the same instant.
 *   - Status flow:
 *       requested ──► confirmed ──► completed
 *           │   └──► rescheduled ──► confirmed / completed
 *           ├──► declined (agent)
 *           └──► cancelled (client, from any live status)
 *   - When a property is sold, rented or removed, its live viewings are declined automatically.
 */
const { transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { audit, notify } = require('../utils/audit');

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const MAX_DAYS_AHEAD = 30;
const LIVE = ['requested', 'confirmed', 'rescheduled'];

/** Allowed next statuses, by who is acting. */
const TRANSITIONS = {
  requested:   { agent: ['confirmed', 'rescheduled', 'declined'], client: ['cancelled'] },
  confirmed:   { agent: ['rescheduled', 'declined', 'completed'], client: ['cancelled'] },
  rescheduled: { agent: ['confirmed', 'rescheduled', 'declined', 'completed'], client: ['cancelled'] },
  declined:    { agent: [], client: [] },
  completed:   { agent: [], client: [] },
  cancelled:   { agent: [], client: [] },
};

/** Today's date in Nairobi as YYYY-MM-DD. */
function nairobiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns an error message, or null when the date and time are a valid slot. */
function validateSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return 'Choose a valid date.';
  if (!SLOTS.includes(time)) return 'Choose one of the available time slots.';
  const today = nairobiToday();
  if (date <= today) return 'Viewings must be booked at least one day ahead.';
  if (date > addDays(today, MAX_DAYS_AHEAD)) return `Viewings can be booked up to ${MAX_DAYS_AHEAD} days ahead.`;
  if (new Date(date + 'T00:00:00Z').getUTCDay() === 0) return 'Agents do not hold viewings on Sundays. Please pick another day.';
  return null;
}

/** Kenya is UTC+3 all year (no daylight saving), so the offset is fixed. */
const toTimestamp = (date, time) => `${date}T${time}:00+03:00`;

const formatWhen = (ts) => new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(ts));

/** Map of slot -> true if already taken, for one property on one date. */
async function takenSlots(db, propertyId, date) {
  const rows = await db.query(
    `select to_char(scheduled_at at time zone 'Africa/Nairobi', 'HH24:MI') as t from viewings
     where property_id = $1 and (scheduled_at at time zone 'Africa/Nairobi')::date = $2::date
       and viewing_status in ('requested','confirmed','rescheduled')`, [propertyId, date]);
  const taken = Object.fromEntries(SLOTS.map((s) => [s, false]));
  rows.forEach((r) => { taken[r.t] = true; });
  return taken;
}

/** Book a viewing as one transaction. Returns the new viewing_id. */
async function bookViewing(req, propertyId, date, time) {
  const error = validateSlot(date, time);
  if (error) throw new AppError(422, error);
  const clientId = req.user.user_id;

  try {
    return await transaction(async (tx) => {
      // 1. Lock the property row so two bookings for it are processed one after the other.
      const p = await tx.queryOne('select property_id, agent_id, title, listing_status from properties where property_id = $1 for update', [propertyId]);
      if (!p) throw new AppError(404, 'This property no longer exists.');
      if (p.listing_status !== 'available') throw new AppError(409, `This property is ${p.listing_status.replace('_', ' ')} and cannot be booked.`);

      // 2. Business rule: one live booking per client per property.
      const existing = await tx.queryOne(
        "select scheduled_at from viewings where client_id = $1 and property_id = $2 and viewing_status in ('requested','confirmed','rescheduled')",
        [clientId, propertyId]);
      if (existing) throw new AppError(409, `You already have a viewing for this property on ${formatWhen(existing.scheduled_at)}. Cancel it first to pick another time.`);

      // 3. Insert. The unique index uq_viewings_live_slot is the final guard against double-booking.
      const v = await tx.queryOne('insert into viewings (client_id, property_id, scheduled_at) values ($1, $2, $3) returning viewing_id',
        [clientId, propertyId, toTimestamp(date, time)]);

      // 4. Tell the agent.
      await notify(tx, p.agent_id, `New viewing request: ${p.title} on ${formatWhen(toTimestamp(date, time))}`, '/agent/viewings');
      await audit(req, 'viewing_booked', 'viewing', v.viewing_id, `${p.title} on ${date} ${time}`);
      return v.viewing_id;
    });
  } catch (err) {
    // 23505 = unique violation: someone booked this exact slot a moment ago.
    if (err.code === '23505') throw new AppError(409, 'Sorry, that time slot was just taken. Please choose another one.');
    throw err;
  }
}

/** Change a viewing's status. actor = 'agent' | 'client'. Ownership is checked here. */
async function changeStatus(req, viewingId, newStatus, actor, { note = null, date = null, time = null } = {}) {
  const actorId = req.user.user_id;
  try {
    await transaction(async (tx) => {
      const v = await tx.queryOne(
        `select v.*, p.agent_id, p.title from viewings v join properties p on p.property_id = v.property_id
         where v.viewing_id = $1 for update of v`, [viewingId]);
      // Agents may only touch viewings on their own listings; clients only their own bookings.
      if (!v || (actor === 'agent' && v.agent_id !== actorId) || (actor === 'client' && v.client_id !== actorId)) {
        throw new AppError(404, 'Viewing not found.');
      }
      const allowed = TRANSITIONS[v.viewing_status][actor];
      if (!allowed.includes(newStatus)) throw new AppError(409, `A ${v.viewing_status} viewing cannot be changed to ${newStatus}.`);
      if (newStatus === 'completed' && new Date(v.scheduled_at) > new Date()) {
        throw new AppError(409, 'You can only mark a viewing completed after its scheduled time.');
      }
      if (newStatus === 'declined' && (!note || note.trim().length < 5)) {
        throw new AppError(422, 'Give the client a short reason (at least 5 characters) when declining.', { note: 'Reason is required.' });
      }
      let scheduledAt = v.scheduled_at;
      if (newStatus === 'rescheduled') {
        const err = validateSlot(date, time);
        if (err) throw new AppError(422, err);
        scheduledAt = toTimestamp(date, time);
        if (new Date(scheduledAt).getTime() === new Date(v.scheduled_at).getTime()) throw new AppError(422, 'Pick a different date or time to reschedule.');
      }
      await tx.query('update viewings set viewing_status = $1, scheduled_at = $2, agent_note = coalesce($3, agent_note) where viewing_id = $4',
        [newStatus, scheduledAt, note ? String(note).slice(0, 255) : null, viewingId]);

      const when = formatWhen(scheduledAt);
      const messages = {
        confirmed: `Your viewing of ${v.title} on ${when} is confirmed.`,
        rescheduled: `Your viewing of ${v.title} was moved to ${when}.`,
        declined: `Your viewing request for ${v.title} was declined. Note: ${note}`,
        completed: `Thanks for viewing ${v.title}. Let the agent know if you're interested.`,
        cancelled: `A client cancelled their viewing of ${v.title} on ${when}.`,
      };
      if (actor === 'agent') await notify(tx, v.client_id, messages[newStatus], '/client/viewings');
      else await notify(tx, v.agent_id, messages[newStatus], '/agent/viewings');
      await audit(req, `viewing_${newStatus}`, 'viewing', viewingId, v.title + (newStatus === 'rescheduled' ? ` to ${date} ${time}` : ''));
    });
  } catch (err) {
    if (err.code === '23505') throw new AppError(409, 'Another viewing already holds that slot. Choose a different time.');
    throw err;
  }
}

/** Decline all live viewings of a property (sold, rented or removed). Returns how many. */
async function declineOpenViewings(tx, propertyId, reason) {
  const rows = await tx.query(
    `update viewings v set viewing_status = 'declined', agent_note = $2
     from properties p where p.property_id = v.property_id and v.property_id = $1
       and v.viewing_status in ('requested','confirmed','rescheduled')
     returning v.client_id, p.title`, [propertyId, reason]);
  for (const r of rows) await notify(tx, r.client_id, `Your viewing of ${r.title} was cancelled: ${reason}`, '/client/viewings');
  return rows.length;
}

module.exports = { SLOTS, LIVE, MAX_DAYS_AHEAD, TRANSITIONS, validateSlot, takenSlots, bookViewing, changeStatus, declineOpenViewings, formatWhen, nairobiToday, addDays };
