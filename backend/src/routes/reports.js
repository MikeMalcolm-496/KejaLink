/** /api/reports/:type: admins (all data) and agents (own data). */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin } = require('../middleware/auth');
const c = require('../controllers/reportController');

router.get('/:type', requireLogin('agent', 'admin', 'super_admin'), h(c.run));

module.exports = router;
