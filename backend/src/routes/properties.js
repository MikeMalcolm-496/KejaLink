/** /api/properties: public search and details; client actions on a listing. */
const router = require('express').Router();
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin } = require('../middleware/auth');
const c = require('../controllers/propertyController');

router.get('/', h(c.search));
router.get('/locations', h(c.locations));
router.get('/stats', h(c.stats));
router.get('/:id', h(c.details));
router.get('/:id/slots', h(c.slots));
router.post('/:id/favourite', requireLogin('client'), h(c.toggleFavourite));
router.post('/:id/viewings', requireLogin('client'), h(c.book));        // the main transaction
router.post('/:id/inquiries', requireLogin('client'), h(c.inquire));
router.post('/:id/report', requireLogin('client'), h(c.report));

module.exports = router;
