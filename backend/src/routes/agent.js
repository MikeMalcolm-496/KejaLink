/** /api/agent: the agent portal. Changing listings needs an approved licence. */
const router = require('express').Router();
const multer = require('multer');
const { asyncHandler: h } = require('../middleware/errors');
const { requireLogin, requireApprovedAgent } = require('../middleware/auth');
const c = require('../controllers/agentController');

// Photos are kept in memory (max 3 MB each, 10 per request) and checked before saving.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: c.MAX_PHOTOS } });

router.use(requireLogin('agent'));
router.get('/dashboard', h(c.dashboard));
router.get('/listings', h(c.listListings));
router.get('/listings/:id', requireApprovedAgent, h(c.getListing));
router.post('/listings', requireApprovedAgent, upload.array('photos', c.MAX_PHOTOS), h(c.saveListing));
router.put('/listings/:id', requireApprovedAgent, upload.array('photos', c.MAX_PHOTOS), h(c.saveListing));
router.patch('/listings/:id/status', requireApprovedAgent, h(c.setStatus));
router.delete('/listings/:id', requireApprovedAgent, h(c.deleteListing));
router.get('/viewings', h(c.listViewings));
router.patch('/viewings/:id', h(c.updateViewing));
router.get('/inquiries', h(c.listInquiries));
router.patch('/inquiries/:id', h(c.updateInquiry));

module.exports = router;
