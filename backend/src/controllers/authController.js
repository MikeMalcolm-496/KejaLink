/**
 * authController.js: register, login (with lockout and 2FA), logout,
 * forgot/reset password, forced password change, "who am I".
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator } = require('../utils/validator');
const { audit, notifyAdmins } = require('../utils/audit');
const { sendMail, escapeHtml } = require('../utils/mailer');
const { decrypt, verifyTotp, sha256 } = require('../utils/crypto');
const { startSession, endSession, publicUser, findUser, cookieOptions } = require('../middleware/auth');

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const TWOFA_COOKIE = 'kl_2fa';
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);   // used when the email does not exist

// ---------------------------------------------------------------- register
async function register(req, res) {
  const b = req.body;
  const role = b.role === 'agent' ? 'agent' : 'client';
  b.email = String(b.email || '').trim().toLowerCase();

  const v = new Validator(b);
  v.required('full_name', 'Full name').name('full_name').length('full_name', 'Full name', 3, 100)
    .required('email', 'Email').email('email')
    .required('phone', 'Phone').phone('phone')
    .required('password', 'Password').password('password')
    .matches('password', 'password_confirm', 'The two passwords do not match.')
    .check('terms', !b.terms, 'You must accept the terms of use.');
  await v.unique('email', 'users', 'email', 'An account with this email already exists. Try logging in.');
  await v.unique('phone', 'users', 'phone', 'This phone number is already registered.');
  if (role === 'agent') {
    v.required('licence_no', 'Licence number')
      .pattern('licence_no', /^[A-Za-z0-9/-]{4,30}$/, 'Licence numbers use letters, digits, / or - (4 to 30 characters), e.g. EARB/2024/0153.')
      .length('agency_name', 'Agency name', 2, 100);
    await v.unique('licence_no', 'agent_profiles', 'licence_no', 'This licence number is already registered to another agent.');
  }
  v.throwIfFailed();

  const hash = await bcrypt.hash(b.password, 10);
  const userId = await transaction(async (tx) => {
    const u = await tx.queryOne(
      'insert into users (full_name, email, phone, password_hash, role) values ($1, $2, $3, $4, $5) returning user_id',
      [v.value('full_name'), b.email, v.value('phone'), hash, role]);
    if (role === 'agent') {
      await tx.query('insert into agent_profiles (agent_id, licence_no, agency_name) values ($1, $2, $3)',
        [u.user_id, v.value('licence_no').toUpperCase(), v.value('agency_name') || null]);
      await notifyAdmins(tx, `New agent awaiting verification: ${v.value('full_name')}`, '/admin/agents');
    }
    return u.user_id;
  });

  await audit(req, 'register', 'user', userId, `Registered as ${role}`, userId);
  await sendMail(b.email, 'Welcome to KejaLink', `<p>Hi ${escapeHtml(v.value('full_name'))}, your KejaLink account is ready.${role === 'agent'
    ? ' An administrator will verify your licence shortly; you can post listings once approved.' : ''}</p>`);
  await query('update users set last_login_at = now() where user_id = $1', [userId]);
  startSession(res, userId);
  res.status(201).json({ user: publicUser(await findUser(userId)) });
}

// ---------------------------------------------------------------- login step 1
async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const v = new Validator(req.body);
  v.required('email', 'Email').email('email').required('password', 'Password').throwIfFailed();

  const generic = 'Incorrect email or password.';   // same message whether or not the email exists
  const user = await queryOne('select * from users where email = $1', [email]);
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);      // same timing as a real check
    await audit(req, 'login_failed', 'user', null, `Unknown email: ${email}`, null);
    throw new AppError(401, generic);
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new AppError(423, `Too many failed attempts. Try again in ${mins} minute(s) or reset your password.`);
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    const fails = user.failed_logins + 1;
    if (fails >= MAX_FAILED_LOGINS) {
      await query(`update users set failed_logins = 0, locked_until = now() + interval '${LOCKOUT_MINUTES} minutes' where user_id = $1`, [user.user_id]);
      await audit(req, 'account_locked', 'user', user.user_id, `Locked after ${fails} failed attempts`, user.user_id);
      throw new AppError(423, `Too many failed attempts. Your account is locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    await query('update users set failed_logins = $1 where user_id = $2', [fails, user.user_id]);
    await audit(req, 'login_failed', 'user', user.user_id, `Wrong password (attempt ${fails} of ${MAX_FAILED_LOGINS})`, user.user_id);
    throw new AppError(401, `${generic} ${MAX_FAILED_LOGINS - fails} attempt(s) left before your account is locked.`);
  }
  if (user.account_status === 'suspended') {
    await audit(req, 'login_failed', 'user', user.user_id, 'Suspended account', user.user_id);
    throw new AppError(403, 'This account has been suspended. Contact support@kejalink.co.ke.');
  }

  if (user.twofa_enabled) {
    // Password is right; now ask for the 6-digit code. This short-lived token proves step 1 passed.
    const pending = jwt.sign({ uid: user.user_id, step: '2fa' }, config.jwtSecret, { expiresIn: '5m' });
    res.cookie(TWOFA_COOKIE, pending, cookieOptions(5));
    return res.json({ twoFactorRequired: true });
  }
  await completeLogin(req, res, user);
}

async function completeLogin(req, res, user) {
  await query('update users set failed_logins = 0, locked_until = null, last_login_at = now() where user_id = $1', [user.user_id]);
  res.clearCookie(TWOFA_COOKIE, { path: '/' });
  startSession(res, user.user_id);
  await audit(req, 'login_success', 'user', user.user_id, null, user.user_id);
  res.json({ user: publicUser(await findUser(user.user_id)) });
}

// ---------------------------------------------------------------- login step 2 (2FA)
const twoFaAttempts = new Map();
async function verifyTwoFactor(req, res) {
  let payload;
  try {
    payload = jwt.verify(req.cookies[TWOFA_COOKIE] || '', config.jwtSecret);
  } catch {
    throw new AppError(401, 'Your login step expired. Please log in again.', { code: 'RESTART_LOGIN' });
  }
  const attempts = (twoFaAttempts.get(payload.uid) || 0) + 1;
  twoFaAttempts.set(payload.uid, attempts);
  if (attempts > 5) {
    twoFaAttempts.delete(payload.uid);
    res.clearCookie(TWOFA_COOKIE, { path: '/' });
    await audit(req, '2fa_failed', 'user', payload.uid, 'Too many wrong codes; login cancelled', payload.uid);
    throw new AppError(429, 'Too many wrong codes. Please log in again.', { code: 'RESTART_LOGIN' });
  }
  const user = await queryOne('select * from users where user_id = $1', [payload.uid]);
  const secret = user && user.twofa_secret ? decrypt(user.twofa_secret) : null;
  if (!secret || !verifyTotp(secret, req.body.code)) {
    await audit(req, '2fa_failed', 'user', payload.uid, 'Wrong authentication code', payload.uid);
    throw new AppError(401, 'That code is not correct. Codes change every 30 seconds; enter the one shown now.');
  }
  twoFaAttempts.delete(payload.uid);
  await completeLogin(req, res, user);
}

// ---------------------------------------------------------------- logout / me
async function logout(req, res) {
  if (req.user) await audit(req, 'logout', 'user', req.user.user_id);
  endSession(res);
  res.json({ ok: true });
}

async function me(req, res) {
  let unread = 0;
  if (req.user) {
    unread = Number((await queryOne('select count(*) n from notifications where user_id = $1 and not is_read', [req.user.user_id])).n);
  }
  res.json({ user: publicUser(req.user), unreadNotifications: unread, demoMode: config.demoMode });
}

// ---------------------------------------------------------------- forgot / reset password
async function forgotPassword(req, res) {
  const v = new Validator(req.body);
  v.required('email', 'Email').email('email').throwIfFailed();
  const email = v.value('email').toLowerCase();
  const user = await queryOne("select user_id, full_name, email from users where email = $1 and account_status = 'active'", [email]);
  let demoLink = null;

  if (user) {
    // Only one active link per user; only a SHA-256 hash of the token is stored.
    await query('update password_resets set used_at = now() where user_id = $1 and used_at is null', [user.user_id]);
    const token = crypto.randomBytes(32).toString('hex');
    await query("insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 minutes')",
      [user.user_id, sha256(token)]);
    const link = `${config.appUrl}/reset-password?token=${token}`;
    await sendMail(user.email, 'Reset your KejaLink password',
      `<p>Hi ${escapeHtml(user.full_name)},</p><p>Use this link to choose a new password. It works once and expires in 30 minutes.</p>
       <p><a href="${link}" style="background:#173f35;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset my password</a></p>
       <p>If you did not ask for this, ignore this e-mail.</p>`);
    await audit(req, 'password_reset_requested', 'user', user.user_id, null, user.user_id);
    if (config.mail.mode !== 'smtp') demoLink = `/reset-password?token=${token}`;   // demo: no real inbox
  }
  // Same answer whether or not the account exists (prevents discovering registered emails).
  res.json({ message: 'If an account exists for that email, a reset link is on its way.', demoLink });
}

async function checkResetToken(token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  return queryOne(`select r.*, u.email from password_resets r join users u on u.user_id = r.user_id
                   where r.token_hash = $1 and r.used_at is null and r.expires_at > now()`, [sha256(token)]);
}

async function validateResetToken(req, res) {
  const reset = await checkResetToken(req.query.token);
  res.json({ valid: Boolean(reset), email: reset ? reset.email : null });
}

async function resetPassword(req, res) {
  const reset = await checkResetToken(req.body.token);
  if (!reset) throw new AppError(400, 'This reset link is invalid or has expired. Request a new one.');
  const v = new Validator(req.body);
  v.required('password', 'Password').password('password')
    .matches('password', 'password_confirm', 'The two passwords do not match.').throwIfFailed();
  const hash = await bcrypt.hash(req.body.password, 10);
  await transaction(async (tx) => {
    await tx.query('update users set password_hash = $1, failed_logins = 0, locked_until = null, must_change_password = false where user_id = $2',
      [hash, reset.user_id]);
    await tx.query('update password_resets set used_at = now() where reset_id = $1', [reset.reset_id]);
  });
  await audit(req, 'password_reset', 'user', reset.user_id, null, reset.user_id);
  res.json({ message: 'Password changed. You can now log in with your new password.' });
}

/** After an admin reset: replace the temporary password. */
async function changeTemporaryPassword(req, res) {
  if (!req.user) throw new AppError(401, 'Please log in to continue.');
  const v = new Validator(req.body);
  v.required('password', 'New password').password('password')
    .matches('password', 'password_confirm', 'The two passwords do not match.')
    .check('password', await bcrypt.compare(req.body.password || '', req.user.password_hash), 'Choose a password different from the temporary one.')
    .throwIfFailed();
  await query('update users set password_hash = $1, must_change_password = false where user_id = $2',
    [await bcrypt.hash(req.body.password, 10), req.user.user_id]);
  await audit(req, 'password_changed', 'user', req.user.user_id, 'Replaced temporary password');
  res.json({ user: publicUser(await findUser(req.user.user_id)) });
}

module.exports = {
  register, login, verifyTwoFactor, logout, me, forgotPassword, validateResetToken, resetPassword, changeTemporaryPassword,
};
