/**
 * auth.js: who is logged in (authentication) and what they may do (authorisation).
 *
 * After login the server sets a cookie "kl_session" holding a signed JWT with
 * the user's ID. The cookie is httpOnly (JavaScript in the page cannot read
 * it, so an XSS bug cannot steal it) and SameSite=Lax.
 * The token lasts 30 minutes and is renewed on every request, so users are
 * logged out after 30 minutes of inactivity.
 *
 * Levels of access: client < agent < admin < super_admin (see requireRole).
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { queryOne } = require('../config/db');
const { AppError } = require('./errors');
const { audit } = require('../utils/audit');

const SESSION_COOKIE = 'kl_session';
const SESSION_MINUTES = 30;

const cookieOptions = (minutes) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  maxAge: minutes * 60 * 1000,
  path: '/',
});

function startSession(res, userId) {
  const token = jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: `${SESSION_MINUTES}m` });
  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_MINUTES));
}

function endSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(0));
}

/** Fetch a user with agent details. */
function findUser(userId) {
  return queryOne(
    `select u.*, a.licence_no, a.agency_name, a.bio, a.verification_status, a.rejection_reason
     from users u left join agent_profiles a on a.agent_id = u.user_id where u.user_id = $1`, [userId]);
}

/** Remove secrets before sending a user to the browser. */
function publicUser(u) {
  if (!u) return null;
  const { password_hash, twofa_secret, failed_logins, locked_until, ...safe } = u;
  return safe;
}

/** Runs on every request: reads the cookie and sets req.user (or leaves it undefined). */
async function loadUser(req, res, next) {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return next();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      endSession(res);          // expired or tampered token
      return next();
    }
    const user = await findUser(payload.uid);
    if (!user || user.account_status !== 'active') {
      endSession(res);          // deleted or suspended while logged in
      return next();
    }
    req.user = user;
    startSession(res, user.user_id);   // sliding 30-minute expiry
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard for protected routes: requireLogin() for any user,
 * requireLogin('agent') or requireLogin('admin', 'super_admin') for specific roles.
 */
function requireLogin(...roles) {
  return async (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Please log in to continue.'));
    // A temporary password from an admin must be changed before anything else.
    if (req.user.must_change_password && !req.originalUrl.startsWith('/api/auth/')) {
      return next(new AppError(403, 'You must set a new password first.', { code: 'MUST_CHANGE_PASSWORD' }));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      await audit(req, 'access_denied', null, null, `Tried ${req.method} ${req.originalUrl}`);
      return next(new AppError(403, 'Your account type cannot do this.'));
    }
    next();
  };
}

const requireAdmin = requireLogin('admin', 'super_admin');

/** Agents can only change listings once an admin has approved their licence. */
function requireApprovedAgent(req, res, next) {
  if (!req.user || req.user.role !== 'agent') return next(new AppError(403, 'Only agents can do this.'));
  if (req.user.verification_status !== 'approved') {
    return next(new AppError(403, `Your agent account is ${req.user.verification_status}. You can post listings once an administrator approves your licence.`));
  }
  next();
}

module.exports = {
  loadUser, requireLogin, requireAdmin, requireApprovedAgent, startSession, endSession,
  publicUser, findUser, cookieOptions, SESSION_COOKIE,
};
