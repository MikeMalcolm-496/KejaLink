/**
 * security.js: general protections applied to every request.
 *
 *  securityHeaders  tells browsers to block framing, sniffing and leaking referrers
 *  csrfGuard        every request that changes data must carry the header
 *                   "X-KejaLink: 1". Browsers will not let another website add a
 *                   custom header to a request to our API, so a forged form post
 *                   from an attacker's site is rejected (CSRF protection).
 *  rateLimit        limits attempts per IP address, e.g. 10 logins per 15 minutes
 */
const { AppError } = require('./errors');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function csrfGuard(req, res, next) {
  const changesData = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (changesData && req.get('X-KejaLink') !== '1') {
    return next(new AppError(403, 'Request blocked for security reasons. Refresh the page and try again.'));
  }
  next();
}

/** Tiny in-memory rate limiter (enough for one server; resets when the server restarts). */
function rateLimit({ windowMinutes, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip + ':' + req.baseUrl + req.path;
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMinutes * 60000) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) return next(new AppError(429, message));
    next();
  };
}

module.exports = { securityHeaders, csrfGuard, rateLimit };
