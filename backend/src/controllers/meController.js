/**
 * meController.js: things the logged-in user does with their own account:
 * profile, password, two-factor authentication, notifications, and the
 * client's saved listings, viewings and inquiries.
 */
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, toInt } = require('../utils/validator');
const { audit } = require('../utils/audit');
const { encrypt, newTotpSecret, verifyTotp, totpUri } = require('../utils/crypto');
const { publicUser, findUser } = require('../middleware/auth');
const { COVER } = require('./propertyController');
const viewings = require('../services/viewingService');

// ---------------------------------------------------------------- profile
async function updateProfile(req, res) {
  const u = req.user;
  req.body.email = String(req.body.email || '').trim().toLowerCase();
  const v = new Validator(req.body);
  v.required('full_name', 'Full name').name('full_name').length('full_name', 'Full name', 3, 100)
    .required('email', 'Email').email('email').required('phone', 'Phone').phone('phone');
  await v.unique('email', 'users', 'email', 'Another account uses this email.', 'user_id', u.user_id);
  await v.unique('phone', 'users', 'phone', 'Another account uses this phone number.', 'user_id', u.user_id);
  if (u.role === 'agent') v.length('agency_name', 'Agency name', 2, 100).length('bio', 'About you', 0, 500);
  v.throwIfFailed();

  await transaction(async (tx) => {
    await tx.query('update users set full_name = $1, email = $2, phone = $3 where user_id = $4',
      [v.value('full_name'), req.body.email, v.value('phone'), u.user_id]);
    if (u.role === 'agent') {
      await tx.query('update agent_profiles set agency_name = $1, bio = $2 where agent_id = $3',
        [v.value('agency_name') || null, v.value('bio') || null, u.user_id]);
    }
  });
  await audit(req, 'profile_updated', 'user', u.user_id);
  res.json({ user: publicUser(await findUser(u.user_id)), message: 'Profile saved.' });
}

async function changePassword(req, res) {
  const v = new Validator(req.body);
  v.required('current_password', 'Current password')
    .check('current_password', !(await bcrypt.compare(req.body.current_password || '', req.user.password_hash)), 'Your current password is not correct.')
    .required('password', 'New password').password('password')
    .matches('password', 'password_confirm', 'The two new passwords do not match.')
    .throwIfFailed();
  await query('update users set password_hash = $1 where user_id = $2', [await bcrypt.hash(req.body.password, 10), req.user.user_id]);
  await audit(req, 'password_changed', 'user', req.user.user_id);
  res.json({ message: 'Password changed.' });
}

// ---------------------------------------------------------------- 2FA
// Step 1: a new secret is generated and sent to the browser as a QR code (not saved yet).
const pendingSecrets = new Map();
async function twoFactorSetup(req, res) {
  if (req.user.twofa_enabled) return res.json({ enabled: true });
  const secret = newTotpSecret();
  pendingSecrets.set(req.user.user_id, secret);
  const uri = totpUri(secret, req.user.email);
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 180, color: { dark: '#173f35', light: '#ffffff' } });
  res.json({ enabled: false, secret, qrSvg });
}

// Step 2: only when the user types a correct code is the secret encrypted and saved.
async function twoFactorEnable(req, res) {
  const secret = pendingSecrets.get(req.user.user_id);
  if (!secret) throw new AppError(409, 'Start the set-up again: reload this page.');
  if (!verifyTotp(secret, req.body.code)) {
    throw new AppError(422, "That code did not match. Check your phone's clock is correct and enter the code shown now.", { code: 'Wrong code' });
  }
  await query('update users set twofa_enabled = true, twofa_secret = $1 where user_id = $2', [encrypt(secret), req.user.user_id]);
  pendingSecrets.delete(req.user.user_id);
  await audit(req, '2fa_enabled', 'user', req.user.user_id);
  res.json({ message: 'Two-factor authentication is ON. You will need a code from your app each time you log in.' });
}

async function twoFactorDisable(req, res) {
  if (!(await bcrypt.compare(req.body.current_password || '', req.user.password_hash))) {
    throw new AppError(422, 'Enter your current password to turn off 2FA.', { current_password: 'Password is not correct.' });
  }
  await query('update users set twofa_enabled = false, twofa_secret = null where user_id = $1', [req.user.user_id]);
  await audit(req, '2fa_disabled', 'user', req.user.user_id);
  res.json({ message: 'Two-factor authentication is OFF.' });
}

// ---------------------------------------------------------------- notifications
async function notifications(req, res) {
  const limit = Math.min(toInt(req.query.limit, 20) || 20, 100);
  const rows = await query('select * from notifications where user_id = $1 order by created_at desc limit $2', [req.user.user_id, limit]);
  const unread = await queryOne('select count(*) n from notifications where user_id = $1 and not is_read', [req.user.user_id]);
  res.json({ items: rows, unread: Number(unread.n) });
}

async function readNotifications(req, res) {
  if (req.body.id) {
    await query('update notifications set is_read = true where notification_id = $1 and user_id = $2', [toInt(req.body.id), req.user.user_id]);
  } else {
    await query('update notifications set is_read = true where user_id = $1', [req.user.user_id]);
  }
  res.json({ ok: true });
}

// ---------------------------------------------------------------- client lists
async function favourites(req, res) {
  const rows = await query(
    `select p.property_id, p.title, p.listing_type, p.property_type, p.price, p.bedrooms, p.bathrooms, p.location,
            p.listing_status, p.featured_until, ${COVER}, true is_saved, f.saved_at
     from favourites f join properties p on p.property_id = f.property_id
     where f.client_id = $1 and p.listing_status <> 'removed' order by f.saved_at desc`, [req.user.user_id]);
  res.json(rows);
}

async function myViewings(req, res) {
  const upcoming = req.query.tab !== 'past';
  const cond = upcoming
    ? "v.viewing_status in ('requested','confirmed','rescheduled') and v.scheduled_at >= now()"
    : "not (v.viewing_status in ('requested','confirmed','rescheduled') and v.scheduled_at >= now())";
  const rows = await query(
    `select v.*, p.title, p.location, p.property_id, u.full_name agent_name, u.phone agent_phone, ${COVER},
            case when v.viewing_status = 'confirmed' then p.address end as address
     from viewings v join properties p on p.property_id = v.property_id join users u on u.user_id = p.agent_id
     where v.client_id = $1 and ${cond} order by v.scheduled_at ${upcoming ? 'asc' : 'desc'}`, [req.user.user_id]);
  res.json(rows);
}

async function cancelViewing(req, res) {
  await viewings.changeStatus(req, toInt(req.params.id), 'cancelled', 'client');
  res.json({ message: 'Viewing cancelled. The agent has been notified and the slot is free again.' });
}

async function myInquiries(req, res) {
  const rows = await query(
    `select i.*, p.title, p.property_id, u.full_name agent_name
     from inquiries i join properties p on p.property_id = i.property_id join users u on u.user_id = p.agent_id
     where i.client_id = $1 order by coalesce(i.replied_at, i.created_at) desc`, [req.user.user_id]);
  res.json(rows);
}

// GET /api/me/badges: small counts for the sidebar (items waiting for this user)
async function badges(req, res) {
  const id = req.user.user_id;
  if (req.user.role === 'agent') {
    const r = await queryOne(`select
      (select count(*) from viewings v join properties p on p.property_id = v.property_id where p.agent_id = $1 and v.viewing_status = 'requested')::int viewings,
      (select count(*) from inquiries i join properties p on p.property_id = i.property_id where p.agent_id = $1 and i.inquiry_status = 'open')::int inquiries`, [id]);
    return res.json({ '/agent/viewings': r.viewings, '/agent/inquiries': r.inquiries });
  }
  if (['admin', 'super_admin'].includes(req.user.role)) {
    const r = await queryOne(`select (select count(*) from agent_profiles where verification_status = 'pending')::int agents,
      (select count(*) from listing_reports where report_status = 'open')::int reports`);
    return res.json({ '/admin/agents': r.agents, '/admin/listings': r.reports });
  }
  res.json({});
}

module.exports = {
  badges, updateProfile, changePassword, twoFactorSetup, twoFactorEnable, twoFactorDisable,
  notifications, readNotifications, favourites, myViewings, cancelViewing, myInquiries,
};
