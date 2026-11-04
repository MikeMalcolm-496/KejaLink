/** /api/auth: registration, login, 2FA step, logout, password reset. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { rateLimit } = require('../middleware/security');
const c = require('../controllers/authController');
const config = require('../config/env');

const loginLimit = rateLimit({ windowMinutes: 15, max: config.loginRateLimit, message: 'Too many login attempts from this network. Wait 15 minutes.' });

router.get('/me', h(c.me));
router.post('/register', loginLimit, h(c.register));
router.post('/login', loginLimit, h(c.login));
router.post('/2fa', loginLimit, h(c.verifyTwoFactor));
router.post('/logout', h(c.logout));
router.post('/change-temporary-password', h(c.changeTemporaryPassword));

module.exports = router;
