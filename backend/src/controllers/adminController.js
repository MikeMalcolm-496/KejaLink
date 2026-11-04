/**
 * adminController.js: the admin panel (FR1 verification, FR5 administration).
 *
 * Permission rules (checked in targetUser):
 *   - nobody can suspend, delete or change their own account here
 *   - only a super admin can act on admin / super admin accounts
 *   - every action writes admin_actions (moderation record) and audit_logs
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, toInt } = require('../utils/validator');
const { audit, adminAction, notify } = require('../utils/audit');
const { sendMail, escapeHtml } = require('../utils/mailer');
const { deleteImages } = require('../utils/storage');
const { COVER } = require('./propertyController');
const viewings = require('../services/viewingService');

const isSuper = (req) => req.user.role === 'super_admin';

/** Paging helper: returns { limit, offset, page } */
function paging(req, perPage = 20) {
  const page = Math.max(1, toInt(req.query.page, 1));
  return { limit: perPage, offset: (page - 1) * perPage, page };
}
const pageResult = (items, total, page, perPage) => ({ items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) });

/** A temporary password that meets the password policy. */
function tempPassword() {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const pick = (s, n) => Array.from({ length: n }, () => s[crypto.randomInt(s.length)]).join('');
  return `Keja${crypto.randomInt(1000, 10000)}${pick(lower, 3)}${pick(lower.toUpperCase(), 1)}`;
}

// ---------------------------------------------------------------- overview
async function overview(req, res) {
  const stats = await queryOne(`select
    (select count(*) from users)::int users,
    (select count(*) from agent_profiles where verification_status = 'pending')::int pending_agents,
    (select count(*) from properties where listing_status in ('available','under_offer'))::int active_listings,
    (select count(*) from viewings where date_trunc('month', scheduled_at) = date_trunc('month', now()))::int viewings_month,
    (select count(*) from listing_reports where report_status = 'open')::int open_reports,
    (select coalesce(sum(amount),0) from payments where payment_status = 'success' and date_trunc('month', created_at) = date_trunc('month', now()))::int revenue_month`);
  const pending = await query(`select u.user_id, u.full_name, u.email, u.created_at, a.agency_name, a.licence_no
                               from agent_profiles a join users u on u.user_id = a.agent_id
                               where a.verification_status = 'pending' order by u.created_at limit 5`);
  const viewingsByMonth = await query(`select to_char(m, 'Mon YYYY') label, coalesce(count(v.viewing_id), 0)::int value
     from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
     left join viewings v on date_trunc('month', v.created_at) = m group by m order by m`);
  const listingsByType = await query(`select property_type label, count(*) filter (where listing_type = 'rent')::int rent,
     count(*) filter (where listing_type = 'sale')::int sale from properties where listing_status <> 'removed' group by property_type order by property_type`);
  const recent = await query(`select l.*, u.full_name from audit_logs l left join users u on u.user_id = l.user_id order by l.log_id desc limit 8`);
  res.json({ stats, pending, viewingsByMonth, listingsByType, recent });
}

// GET /api/admin/search?q=  (moderation search box)
async function search(req, res) {
  const q = `%${String(req.query.q || '').slice(0, 100)}%`;
  const users = await query('select user_id, full_name, email, role, account_status from users where full_name ilike $1 or email ilike $1 or phone ilike $1 limit 5', [q]);
  const listings = await query(`select property_id, title, location, listing_status,
     (select count(*) from listing_reports r where r.property_id = p.property_id and r.report_status = 'open')::int reports
     from properties p where title ilike $1 or location ilike $1 limit 5`, [q]);
  res.json({ users, listings });
}

// ---------------------------------------------------------------- agents
async function agents(req, res) {
  const tab = ['pending', 'approved', 'rejected'].includes(req.query.tab) ? req.query.tab : 'pending';
  const params = [tab];
  let where = 'a.verification_status = $1';
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where += ` and (u.full_name ilike $2 or a.licence_no ilike $2 or a.agency_name ilike $2)`; }
  const rows = await query(`select u.user_id, u.full_name, u.email, u.phone, u.created_at, a.*, v.full_name verifier,
     (select count(*) from properties p where p.agent_id = u.user_id and p.listing_status <> 'removed')::int listings
     from agent_profiles a join users u on u.user_id = a.agent_id left join users v on v.user_id = a.verified_by
     where ${where} order by u.created_at ${tab === 'pending' ? 'asc' : 'desc'} limit 200`, params);
  const counts = await query('select verification_status s, count(*)::int n from agent_profiles group by verification_status');
  res.json({ items: rows, counts: Object.fromEntries(counts.map((c) => [c.s, c.n])) });
}

// ---------------------------------------------------------------- users
async function users(req, res) {
  const params = [];
  const where = ['1=1'];
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where.push(`(u.full_name ilike $${params.length} or u.email ilike $${params.length} or u.phone ilike $${params.length})`); }
  if (['client', 'agent', 'admin', 'super_admin'].includes(req.query.role)) { params.push(req.query.role); where.push(`u.role = $${params.length}`); }
  if (['active', 'suspended'].includes(req.query.status)) { params.push(req.query.status); where.push(`u.account_status = $${params.length}`); }
  const w = where.join(' and ');
  const total = Number((await queryOne(`select count(*) n from users u where ${w}`, params)).n);
  const { limit, offset, page } = paging(req);
  const sortCol = { name: 'u.full_name', email: 'u.email', role: 'u.role', status: 'u.account_status', registered: 'u.created_at', login: 'u.last_login_at' }[req.query.sort] || 'u.created_at';
  const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
  params.push(limit, offset);
  const rows = await query(`select u.user_id, u.full_name, u.email, u.phone, u.role, u.account_status, u.twofa_enabled, u.locked_until,
     u.last_login_at, u.created_at, a.verification_status, a.licence_no, a.agency_name
     from users u left join agent_profiles a on a.agent_id = u.user_id where ${w}
     order by ${sortCol} ${dir} nulls last, u.user_id limit $${params.length - 1} offset $${params.length}`, params);
  res.json(pageResult(rows, total, page, limit));
}

async function getUser(req, res) {
  const u = await queryOne(`select u.user_id, u.full_name, u.email, u.phone, u.role, a.licence_no, a.agency_name
                            from users u left join agent_profiles a on a.agent_id = u.user_id where u.user_id = $1`, [toInt(req.params.id)]);
  if (!u) throw new AppError(404, 'User not found.');
  if (['admin', 'super_admin'].includes(u.role) && !isSuper(req) && u.user_id !== req.user.user_id) throw new AppError(403, 'Only a super admin can edit administrator accounts.');
  res.json(u);
}

// POST /api/admin/users (create) and PUT /api/admin/users/:id (edit)
async function saveUser(req, res) {
  const id = req.params.id ? toInt(req.params.id) : null;
  const existing = id ? await queryOne('select * from users where user_id = $1', [id]) : null;
  if (id && !existing) throw new AppError(404, 'User not found.');
  if (existing && ['admin', 'super_admin'].includes(existing.role) && !isSuper(req) && existing.user_id !== req.user.user_id) {
    throw new AppError(403, 'Only a super admin can edit administrator accounts.');
  }
  const roles = isSuper(req) ? ['client', 'agent', 'admin'] : ['client', 'agent'];
  const role = existing ? existing.role : req.body.role;
  req.body.email = String(req.body.email || '').trim().toLowerCase();

  const v = new Validator(req.body);
  v.required('full_name', 'Full name').name('full_name').length('full_name', 'Full name', 3, 100)
    .required('email', 'Email').email('email').required('phone', 'Phone').phone('phone');
  if (!existing) v.oneOf('role', roles, 'role');
  await v.unique('email', 'users', 'email', 'Another account uses this email.', existing ? 'user_id' : null, id);
  await v.unique('phone', 'users', 'phone', 'Another account uses this phone number.', existing ? 'user_id' : null, id);
  if (role === 'agent') {
    v.required('licence_no', 'Licence number').pattern('licence_no', /^[A-Za-z0-9/-]{4,30}$/, 'Use letters, digits, / or - (4 to 30 characters).');
    await v.unique('licence_no', 'agent_profiles', 'licence_no', 'This licence number is already registered.', existing ? 'agent_id' : null, id);
  }
  v.throwIfFailed();

  if (existing) {
    await transaction(async (tx) => {
      await tx.query('update users set full_name = $1, email = $2, phone = $3 where user_id = $4', [v.value('full_name'), req.body.email, v.value('phone'), id]);
      if (role === 'agent') await tx.query('update agent_profiles set licence_no = $1, agency_name = $2 where agent_id = $3', [v.value('licence_no').toUpperCase(), v.value('agency_name') || null, id]);
    });
    await audit(req, 'profile_updated', 'user', id, 'Edited by admin');
    return res.json({ message: 'User details saved.' });
  }

  const temp = tempPassword();
  const newId = await transaction(async (tx) => {
    const u = await tx.queryOne('insert into users (full_name, email, phone, password_hash, role, must_change_password) values ($1,$2,$3,$4,$5,true) returning user_id',
      [v.value('full_name'), req.body.email, v.value('phone'), await bcrypt.hash(temp, 10), role]);
    if (role === 'agent') {
      // An agent registered by an admin is verified at the same time.
      await tx.query("insert into agent_profiles (agent_id, licence_no, agency_name, verification_status, verified_by, verified_at) values ($1,$2,$3,'approved',$4,now())",
        [u.user_id, v.value('licence_no').toUpperCase(), v.value('agency_name') || null, req.user.user_id]);
    }
    await adminAction(tx, req, 'create_user', u.user_id, null, `Created ${role} account`);
    return u.user_id;
  });
  await sendMail(req.body.email, 'Your KejaLink account', `<p>An administrator created a KejaLink account for you.</p>
    <p>Email: <b>${escapeHtml(req.body.email)}</b><br>Temporary password: <b>${temp}</b></p><p>You will choose your own password at first login.</p>`);
  res.status(201).json({ user_id: newId, tempPassword: temp, message: `Account created for ${v.value('full_name')}.` });
}

// ---------------------------------------------------------------- listings, viewings, payments, audit
async function listings(req, res) {
  const params = [];
  const where = ['1=1'];
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where.push(`(p.title ilike $${params.length} or p.location ilike $${params.length} or u.full_name ilike $${params.length})`); }
  if (['available', 'under_offer', 'sold', 'rented', 'removed'].includes(req.query.status)) { params.push(req.query.status); where.push(`p.listing_status = $${params.length}`); }
  if (req.query.reported === '1') where.push("exists (select 1 from listing_reports r where r.property_id = p.property_id and r.report_status = 'open')");
  const w = where.join(' and ');
  const total = Number((await queryOne(`select count(*) n from properties p join users u on u.user_id = p.agent_id where ${w}`, params)).n);
  const { limit, offset, page } = paging(req);
  const sortCol = { title: 'p.title', agent: 'u.full_name', price: 'p.price', status: 'p.listing_status', created: 'p.created_at', views: 'p.views_count', reports: 'reports' }[req.query.sort] || (req.query.reported === '1' ? 'reports' : 'p.created_at');
  params.push(limit, offset);
  const rows = await query(`select p.*, u.full_name agent_name, ${COVER},
     (select count(*) from listing_reports r where r.property_id = p.property_id and r.report_status = 'open')::int reports,
     (select coalesce(json_agg(json_build_object('report_id', r.report_id, 'reason', r.reason, 'reporter', ru.full_name)), '[]')
        from listing_reports r join users ru on ru.user_id = r.reporter_id where r.property_id = p.property_id and r.report_status = 'open') open_reports
     from properties p join users u on u.user_id = p.agent_id where ${w}
     order by ${sortCol} ${req.query.dir === 'asc' ? 'asc' : 'desc'}, p.property_id desc limit $${params.length - 1} offset $${params.length}`, params);
  res.json(pageResult(rows, total, page, limit));
}

async function allViewings(req, res) {
  const params = [];
  const where = ['1=1'];
  if (['requested', 'confirmed', 'rescheduled', 'declined', 'completed', 'cancelled'].includes(req.query.status)) { params.push(req.query.status); where.push(`v.viewing_status = $${params.length}`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { params.push(req.query.from); where.push(`v.scheduled_at >= $${params.length}::date`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { params.push(req.query.to); where.push(`v.scheduled_at < $${params.length}::date + 1`); }
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where.push(`(p.title ilike $${params.length} or c.full_name ilike $${params.length} or a.full_name ilike $${params.length})`); }
  const base = `from viewings v join properties p on p.property_id = v.property_id join users c on c.user_id = v.client_id join users a on a.user_id = p.agent_id where ${where.join(' and ')}`;
  const total = Number((await queryOne(`select count(*) n ${base}`, params)).n);
  const { limit, offset, page } = paging(req, 25);
  const sortCol = { date: 'v.scheduled_at', property: 'p.title', client: 'c.full_name', agent: 'a.full_name', status: 'v.viewing_status', booked: 'v.created_at' }[req.query.sort] || 'v.scheduled_at';
  params.push(limit, offset);
  const rows = await query(`select v.*, p.title, c.full_name client, a.full_name agent ${base}
     order by ${sortCol} ${req.query.dir === 'asc' ? 'asc' : 'desc'} limit $${params.length - 1} offset $${params.length}`, params);
  res.json(pageResult(rows, total, page, limit));
}

async function payments(req, res) {
  const params = [];
  let where = '1=1';
  if (['pending', 'success', 'failed', 'cancelled'].includes(req.query.status)) { params.push(req.query.status); where = 'pm.payment_status = $1'; }
  const rows = await query(`select pm.*, a.full_name agent, p.title from payments pm join users a on a.user_id = pm.agent_id
     left join properties p on p.property_id = pm.property_id where ${where} order by pm.created_at desc limit 200`, params);
  const t = await queryOne("select coalesce(sum(amount),0)::int total, count(*)::int n from payments where payment_status = 'success'");
  res.json({ items: rows, totalReceived: t.total, successful: t.n });
}

async function auditLog(req, res) {
  const params = [];
  const where = ['1=1'];
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where.push(`(u.full_name ilike $${params.length} or u.email ilike $${params.length} or l.details ilike $${params.length} or l.ip_address ilike $${params.length})`); }
  if (/^[a-z0-9_]{1,50}$/.test(req.query.action || '')) { params.push(req.query.action); where.push(`l.action = $${params.length}`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { params.push(req.query.from); where.push(`l.created_at >= $${params.length}::date`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { params.push(req.query.to); where.push(`l.created_at < $${params.length}::date + 1`); }
  const base = `from audit_logs l left join users u on u.user_id = l.user_id where ${where.join(' and ')}`;
  const total = Number((await queryOne(`select count(*) n ${base}`, params)).n);
  const { limit, offset, page } = paging(req, 30);
  params.push(limit, offset);
  const rows = await query(`select l.*, u.full_name, u.role ${base} order by l.log_id desc limit $${params.length - 1} offset $${params.length}`, params);
  const actions = (await query('select distinct action from audit_logs order by action')).map((r) => r.action);
  res.json({ ...pageResult(rows, total, page, limit), actions });
}

async function admins(req, res) {
  const rows = await query(`select u.user_id, u.full_name, u.email, u.role, u.account_status, u.twofa_enabled, u.last_login_at,
     (select count(*) from admin_actions a where a.admin_id = u.user_id)::int actions
     from users u where u.role in ('admin','super_admin') order by u.role desc, u.full_name`);
  const clients = await query("select user_id, full_name, email from users where role = 'client' and account_status = 'active' order by full_name");
  res.json({ admins: rows, clients });
}

// ---------------------------------------------------------------- moderation actions
async function targetUser(req) {
  const t = await queryOne('select u.*, a.verification_status from users u left join agent_profiles a on a.agent_id = u.user_id where u.user_id = $1', [toInt(req.body.user_id)]);
  if (!t) throw new AppError(404, 'User not found.');
  if (t.user_id === req.user.user_id) throw new AppError(403, 'You cannot perform this action on your own account.');
  if (['admin', 'super_admin'].includes(t.role) && !isSuper(req)) throw new AppError(403, 'Only a super admin can manage administrator accounts.');
  return t;
}

function needReason(req, min = 5) {
  const reason = String(req.body.reason || '').trim().slice(0, 255);
  if (reason.length < min) throw new AppError(422, `Please give a reason (at least ${min} characters). It is saved to the activity log and shown to the user.`, { reason: 'Reason required.' });
  return reason;
}

// POST /api/admin/actions/:action
async function action(req, res) {
  const act = req.params.action;
  const reason = String(req.body.reason || '').trim().slice(0, 255);

  switch (act) {
    case 'approve_agent': {
      const t = await targetUser(req);
      if (t.role !== 'agent') throw new AppError(422, 'This user is not an agent.');
      await transaction(async (tx) => {
        await tx.query("update agent_profiles set verification_status = 'approved', rejection_reason = null, verified_by = $1, verified_at = now() where agent_id = $2", [req.user.user_id, t.user_id]);
        await adminAction(tx, req, 'approve_agent', t.user_id, null, reason || 'Licence verified');
        await notify(tx, t.user_id, 'Your agent account is approved. You can now post listings.', '/agent/listings/new');
      });
      await sendMail(t.email, 'Your KejaLink agent account is approved', `<p>Good news, ${escapeHtml(t.full_name)}! Your licence has been verified and you can now post listings.</p>`);
      return res.json({ message: `${t.full_name} is now an approved agent.` });
    }
    case 'reject_agent': {
      const t = await targetUser(req);
      const r = needReason(req);
      await transaction(async (tx) => {
        await tx.query("update agent_profiles set verification_status = 'rejected', rejection_reason = $1, verified_by = $2, verified_at = now() where agent_id = $3", [r, req.user.user_id, t.user_id]);
        await adminAction(tx, req, 'reject_agent', t.user_id, null, r);
        await notify(tx, t.user_id, `Your agent verification was rejected: ${r}`, '/agent');
      });
      return res.json({ message: `${t.full_name}'s verification was rejected.` });
    }
    case 'suspend_user': {
      const t = await targetUser(req);
      const r = needReason(req);
      await transaction(async (tx) => {
        await tx.query("update users set account_status = 'suspended' where user_id = $1", [t.user_id]);
        await adminAction(tx, req, 'suspend_user', t.user_id, null, r);
      });
      return res.json({ message: `${t.full_name} has been suspended and can no longer log in.` });
    }
    case 'reinstate_user': {
      const t = await targetUser(req);
      await transaction(async (tx) => {
        await tx.query("update users set account_status = 'active', failed_logins = 0, locked_until = null where user_id = $1", [t.user_id]);
        await adminAction(tx, req, 'reinstate_user', t.user_id, null, reason);
        await notify(tx, t.user_id, 'Your KejaLink account has been reinstated.');
      });
      return res.json({ message: `${t.full_name} has been reinstated.` });
    }
    case 'reset_password': {
      const t = await targetUser(req);
      const temp = tempPassword();
      await transaction(async (tx) => {
        await tx.query('update users set password_hash = $1, must_change_password = true, failed_logins = 0, locked_until = null where user_id = $2', [await bcrypt.hash(temp, 10), t.user_id]);
        await adminAction(tx, req, 'reset_password', t.user_id, null, reason);
      });
      await sendMail(t.email, 'Your KejaLink password was reset', `<p>An administrator reset your password. Temporary password: <b>${temp}</b></p><p>You will choose a new one when you log in.</p>`);
      return res.json({ tempPassword: temp, message: `Password reset for ${t.full_name}. The temporary password was also e-mailed.` });
    }
    case 'disable_2fa': {
      const t = await targetUser(req);
      await transaction(async (tx) => {
        await tx.query('update users set twofa_enabled = false, twofa_secret = null where user_id = $1', [t.user_id]);
        await adminAction(tx, req, 'disable_2fa', t.user_id, null, reason || 'Lost authenticator device');
      });
      return res.json({ message: `Two-factor authentication turned off for ${t.full_name}.` });
    }
    case 'delete_user': {
      const t = await targetUser(req);
      const images = await query('select i.image_url from property_images i join properties p on p.property_id = i.property_id where p.agent_id = $1', [t.user_id]);
      try {
        await transaction(async (tx) => {
          await adminAction(tx, req, 'delete_user', t.user_id, null, `${t.full_name} <${t.email}> ${reason}`.trim());
          await tx.query('delete from users where user_id = $1', [t.user_id]);   // listings, viewings, etc. cascade
        });
      } catch (err) {
        if (err.code === '23503') throw new AppError(409, 'This account has moderation history that must be kept, so it cannot be deleted. Suspend it instead.');
        throw err;
      }
      await deleteImages(images.map((i) => i.image_url));
      return res.json({ message: `${t.full_name}'s account and data were deleted.` });
    }
    case 'change_role': {
      if (!isSuper(req)) throw new AppError(403, 'Only a super admin can change roles.');
      const t = await targetUser(req);
      const role = req.body.role;
      if (!['client', 'admin'].includes(role) || t.role === 'agent') throw new AppError(422, 'Clients can be promoted to admin, and admins changed back to client.');
      await transaction(async (tx) => {
        await tx.query('update users set role = $1 where user_id = $2', [role, t.user_id]);
        await adminAction(tx, req, 'change_role', t.user_id, null, `${t.role} -> ${role}`);
      });
      return res.json({ message: `${t.full_name} is now ${role === 'admin' ? 'an admin' : 'a client'}.` });
    }
    case 'remove_listing':
    case 'restore_listing': {
      const p = await queryOne('select * from properties where property_id = $1', [toInt(req.body.property_id)]);
      if (!p) throw new AppError(404, 'Listing not found.');
      if (act === 'remove_listing') {
        const r = needReason(req);
        await transaction(async (tx) => {
          await tx.query("update properties set listing_status = 'removed' where property_id = $1", [p.property_id]);
          await viewings.declineOpenViewings(tx, p.property_id, 'The listing was taken down by KejaLink.');
          await tx.query("update listing_reports set report_status = 'resolved' where property_id = $1", [p.property_id]);
          await adminAction(tx, req, 'remove_listing', p.agent_id, p.property_id, r);
          await notify(tx, p.agent_id, `Your listing "${p.title}" was removed by an admin: ${r}`, '/agent/listings');
        });
        return res.json({ message: 'Listing removed and its upcoming viewings cancelled.' });
      }
      await transaction(async (tx) => {
        await tx.query("update properties set listing_status = 'available' where property_id = $1 and listing_status = 'removed'", [p.property_id]);
        await adminAction(tx, req, 'restore_listing', p.agent_id, p.property_id, reason);
        await notify(tx, p.agent_id, `Your listing "${p.title}" has been restored.`, '/agent/listings');
      });
      return res.json({ message: 'Listing restored.' });
    }
    case 'resolve_report': {
      await query("update listing_reports set report_status = 'resolved' where report_id = $1", [toInt(req.body.report_id)]);
      await audit(req, 'report_resolved', 'listing_report', toInt(req.body.report_id), reason || 'Dismissed');
      return res.json({ message: 'Report dismissed.' });
    }
    default:
      throw new AppError(404, 'Unknown action.');
  }
}

module.exports = { overview, search, agents, users, getUser, saveUser, listings, allViewings, payments, auditLog, admins, action };
