/** /api/payments: manual featuring-payment requests for agents. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin, requireApprovedAgent } = require('../middleware/auth');
const c = require('../controllers/paymentController');

router.use(requireLogin('agent'));
router.get('/', h(c.overview));
router.post('/', requireApprovedAgent, h(c.start));

module.exports = router;
