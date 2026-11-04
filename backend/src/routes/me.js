/** /api/me: the logged-in user's own account and (for clients) their lists. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin } = require('../middleware/auth');
const c = require('../controllers/meController');

router.use(requireLogin());
router.get('/badges', h(c.badges));
router.put('/profile', h(c.updateProfile));
router.put('/password', h(c.changePassword));
router.get('/2fa', h(c.twoFactorSetup));
router.post('/2fa', h(c.twoFactorEnable));
router.delete('/2fa', h(c.twoFactorDisable));
router.get('/notifications', h(c.notifications));
router.post('/notifications/read', h(c.readNotifications));

router.get('/favourites', requireLogin('client'), h(c.favourites));
router.get('/viewings', requireLogin('client'), h(c.myViewings));
router.patch('/viewings/:id/cancel', requireLogin('client'), h(c.cancelViewing));
router.get('/inquiries', requireLogin('client'), h(c.myInquiries));

module.exports = router;
