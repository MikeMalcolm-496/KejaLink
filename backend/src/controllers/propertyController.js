/**
 * propertyController.js: public listing search and details (FR3),
 * plus the client actions on a listing: favourite, inquiry, booking, report.
 */
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, toInt } = require('../utils/validator');
const { audit, notify, notifyAdmins } = require('../utils/audit');
const viewings = require('../services/viewingService');

const COVER = `(select image_url from property_images i where i.property_id = p.property_id order by is_cover desc, image_id limit 1) as cover`;
const PUBLIC_WHERE = "p.listing_status in ('available','under_offer') and a.verification_status = 'approved' and u.account_status = 'active'";

/** Read the search filters, keeping only valid values. */
function readFilters(q) {
  const num = (v) => (/^\d{1,12}$/.test(String(v || '')) ? Number(v) : null);
  return {
    q: String(q.q || '').trim().slice(0, 100),
    location: String(q.location || '').trim().slice(0, 100),
    listing_type: ['sale', 'rent'].includes(q.listing_type) ? q.listing_type : '',
    property_type: ['apartment', 'house', 'land', 'commercial'].includes(q.property_type) ? q.property_type : '',
    min_price: num(q.min_price),
    max_price: num(q.max_price),
    bedrooms: num(q.bedrooms),
    sort: ['newest', 'price_asc', 'price_desc', 'popular'].includes(q.sort) ? q.sort : 'newest',
  };
}

// GET /api/properties
async function search(req, res) {
  const started = Date.now();
  const f = readFilters(req.query);
  const where = [PUBLIC_WHERE];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(p.title ilike $${params.length} or p.location ilike $${params.length} or p.description ilike $${params.length})`);
  }
  if (f.location) add('(p.location ilike ?)', `%${f.location}%`);
  if (f.listing_type) add('p.listing_type = ?', f.listing_type);
  if (f.property_type) add('p.property_type = ?', f.property_type);
  if (f.min_price !== null) add('p.price >= ?', f.min_price);
  if (f.max_price !== null) add('p.price <= ?', f.max_price);
  if (f.bedrooms !== null) add('p.bedrooms >= ?', f.bedrooms);

  const from = `from properties p join agent_profiles a on a.agent_id = p.agent_id join users u on u.user_id = p.agent_id where ${where.join(' and ')}`;
  const total = Number((await queryOne(`select count(*) n ${from}`, params)).n);
  const perPage = Math.min(toInt(req.query.per_page, 9) || 9, 30);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, toInt(req.query.page, 1)), pages);

  // Sort options come from this fixed list; user input never becomes SQL.
  const order = { newest: 'p.created_at desc', price_asc: 'p.price asc', price_desc: 'p.price desc', popular: 'p.views_count desc' }[f.sort];
  const clientId = req.user && req.user.role === 'client' ? req.user.user_id : 0;
  params.push(clientId, perPage, (page - 1) * perPage);
  const n = params.length;
  const rows = await query(
    `select p.property_id, p.title, p.listing_type, p.property_type, p.price, p.bedrooms, p.bathrooms, p.location,
            p.listing_status, p.featured_until, p.views_count, p.created_at, a.agency_name, u.full_name as agent_name, ${COVER},
            exists(select 1 from favourites f where f.property_id = p.property_id and f.client_id = $${n - 2}) as is_saved
     ${from}
     order by (p.featured_until is not null and p.featured_until > now()) desc, ${order}, p.property_id desc
     limit $${n - 1} offset $${n}`, params);

  res.json({ items: rows, total, page, pages, filters: f, ms: Date.now() - started });
}

// GET /api/properties/locations: suggestions for the location box
async function locations(req, res) {
  const rows = await query(`select location, count(*) n from properties where listing_status <> 'removed' group by location order by n desc limit 30`);
  res.json(rows.map((r) => r.location));
}

// GET /api/properties/stats: numbers for the home page
async function stats(req, res) {
  const s = await queryOne(`select
    (select count(*) from properties p join agent_profiles a on a.agent_id = p.agent_id where p.listing_status = 'available' and a.verification_status = 'approved') listings,
    (select count(*) from agent_profiles where verification_status = 'approved') agents,
    (select count(distinct location) from properties where listing_status <> 'removed') areas`);
  res.json({ listings: Number(s.listings), agents: Number(s.agents), areas: Number(s.areas) });
}

/** Load a property; owners and admins can also see listings hidden from the public. */
async function loadProperty(id, user) {
  const p = await queryOne(
    `select p.*, u.full_name agent_name, u.phone agent_phone, u.account_status agent_account_status,
            a.agency_name, a.licence_no, a.bio agent_bio, a.verification_status,
            (select count(*) from properties p2 where p2.agent_id = p.agent_id and p2.listing_status <> 'removed')::int agent_listing_count
     from properties p join users u on u.user_id = p.agent_id join agent_profiles a on a.agent_id = p.agent_id
     where p.property_id = $1`, [id]);
  if (!p) return null;
  const isPublic = p.listing_status !== 'removed' && p.verification_status === 'approved' && p.agent_account_status === 'active';
  const isOwner = user && user.user_id === p.agent_id;
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  return isPublic || isOwner || isAdmin ? { ...p, is_owner: Boolean(isOwner) } : null;
}

// GET /api/properties/:id
async function details(req, res) {
  const id = toInt(req.params.id);
  const p = await loadProperty(id, req.user);
  if (!p) throw new AppError(404, 'This listing does not exist or has been taken down.');

  // Count one view per visitor session (cookie) per property; owners don't count.
  const seen = String(req.cookies.kl_seen || '').split('.').filter(Boolean);
  if (!p.is_owner && !seen.includes(String(id))) {
    await query('update properties set views_count = views_count + 1 where property_id = $1', [id]);
    res.cookie('kl_seen', [...seen.slice(-50), id].join('.'), { httpOnly: true, sameSite: 'lax' });
  }

  const images = await query('select image_id, image_url, is_cover from property_images where property_id = $1 order by is_cover desc, image_id', [id]);
  const isClient = req.user && req.user.role === 'client';
  const uid = req.user ? req.user.user_id : 0;
  const [saved, myViewing, myInquiries, similar] = await Promise.all([
    isClient ? queryOne('select 1 from favourites where client_id = $1 and property_id = $2', [uid, id]) : null,
    isClient ? queryOne("select * from viewings where client_id = $1 and property_id = $2 and viewing_status in ('requested','confirmed','rescheduled')", [uid, id]) : null,
    isClient ? query('select * from inquiries where client_id = $1 and property_id = $2 order by created_at desc', [uid, id]) : [],
    query(`select p.property_id, p.title, p.listing_type, p.property_type, p.price, p.bedrooms, p.bathrooms, p.location, p.listing_status, p.featured_until, ${COVER}, false is_saved
           from properties p join agent_profiles a on a.agent_id = p.agent_id
           where p.property_id <> $1 and p.listing_status = 'available' and a.verification_status = 'approved'
             and (p.location = $2 or (p.property_type = $3 and p.listing_type = $4))
           order by (p.location = $2) desc, abs(p.price - $5) limit 3`, [id, p.location, p.property_type, p.listing_type, p.price]),
  ]);

  // Contact details only for logged-in users.
  if (!req.user) p.agent_phone = null;
  res.json({ property: p, images, isSaved: Boolean(saved), myViewing, myInquiries, similar });
}

// GET /api/properties/:id/slots?date=YYYY-MM-DD
async function slots(req, res) {
  const date = String(req.query.date || '');
  const error = viewings.validateSlot(date, viewings.SLOTS[0]);
  if (error) throw new AppError(422, error);
  if (!(await loadProperty(toInt(req.params.id), req.user))) throw new AppError(404, 'Listing not found.');
  res.json({ date, slots: await viewings.takenSlots({ query }, toInt(req.params.id), date) });
}

// POST /api/properties/:id/favourite  (toggle)
async function toggleFavourite(req, res) {
  const id = toInt(req.params.id);
  if (!(await loadProperty(id, req.user))) throw new AppError(404, 'This listing is no longer available.');
  const removed = await query('delete from favourites where client_id = $1 and property_id = $2 returning 1', [req.user.user_id, id]);
  if (!removed.length) await query('insert into favourites (client_id, property_id) values ($1, $2)', [req.user.user_id, id]);
  await audit(req, removed.length ? 'favourite_removed' : 'favourite_added', 'property', id);
  res.json({ saved: !removed.length });
}

// POST /api/properties/:id/viewings  (the main transaction)
async function book(req, res) {
  const id = await viewings.bookViewing(req, toInt(req.params.id), String(req.body.date || ''), String(req.body.time || ''));
  res.status(201).json({ viewing_id: id, message: 'Viewing requested. The agent will confirm it and you will be notified.' });
}

// POST /api/properties/:id/inquiries
async function inquire(req, res) {
  const id = toInt(req.params.id);
  const p = await loadProperty(id, req.user);
  const v = new Validator(req.body);
  v.required('message', 'Message').length('message', 'Message', 10, 1000).check('message', !p, 'This listing is no longer available.');
  const recent = await queryOne("select count(*) n from inquiries where client_id = $1 and created_at > now() - interval '1 hour'", [req.user.user_id]);
  v.check('message', Number(recent.n) >= 5, 'You have sent many inquiries in the last hour. Please wait before sending more.');
  v.throwIfFailed();
  const inquiry = await transaction(async (tx) => {
    const row = await tx.queryOne('insert into inquiries (client_id, property_id, message) values ($1, $2, $3) returning *', [req.user.user_id, id, v.value('message')]);
    await notify(tx, p.agent_id, `${req.user.full_name} asked about ${p.title}`, '/agent/inquiries');
    return row;
  });
  await audit(req, 'inquiry_sent', 'inquiry', inquiry.inquiry_id, p.title);
  res.status(201).json({ inquiry, message: `Inquiry sent to ${p.agent_name}. You'll be notified when they reply.` });
}

// POST /api/properties/:id/report
async function report(req, res) {
  const id = toInt(req.params.id);
  const p = await loadProperty(id, req.user);
  const v = new Validator(req.body);
  v.required('reason', 'Reason').length('reason', 'Reason', 10, 255).check('reason', !p, 'Listing not found.').throwIfFailed();
  const already = await queryOne("select 1 from listing_reports where property_id = $1 and reporter_id = $2 and report_status = 'open'", [id, req.user.user_id]);
  if (already) return res.json({ message: 'You have already reported this listing. An admin will review it.' });
  await transaction(async (tx) => {
    await tx.query('insert into listing_reports (property_id, reporter_id, reason) values ($1, $2, $3)', [id, req.user.user_id, v.value('reason')]);
    await notifyAdmins(tx, `Listing reported: ${p.title}`, '/admin/listings?reported=1');
  });
  await audit(req, 'listing_reported', 'property', id, v.value('reason'));
  res.status(201).json({ message: 'Thank you. Your report was sent to the KejaLink admins.' });
}

module.exports = { search, locations, stats, details, slots, toggleFavourite, book, inquire, report, COVER, loadProperty };
