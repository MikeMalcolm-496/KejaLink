/** /api/payments: M-Pesa featuring for agents. The callback is mounted separately in server.js. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin, requireApprovedAgent } = require('../middleware/auth');
const c = require('../controllers/paymentController');

router.use(requireLogin('agent'));
router.get('/', h(c.overview));
router.post('/', requireApprovedAgent, h(c.start));
router.get('/:id', h(c.status));

module.exports = router;
