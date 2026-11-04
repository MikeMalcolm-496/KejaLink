/** /api/admin: the admin panel. Admins and super admins only. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireAdmin, requireLogin } = require('../middleware/auth');
const c = require('../controllers/adminController');

router.use(requireAdmin);
router.get('/overview', h(c.overview));
router.get('/search', h(c.search));
router.get('/agents', h(c.agents));
router.get('/users', h(c.users));
router.get('/users/:id', h(c.getUser));
router.post('/users', h(c.saveUser));
router.put('/users/:id', h(c.saveUser));
router.get('/listings', h(c.listings));
router.get('/viewings', h(c.allViewings));
router.get('/payments', h(c.payments));
router.get('/audit', h(c.auditLog));
router.get('/admins', requireLogin('super_admin'), h(c.admins));
router.post('/actions/:action', h(c.action));

module.exports = router;
