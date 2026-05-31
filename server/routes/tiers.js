const express = require('express');
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const { getTiers, generateImage, getLatestImage, getImageHistory, updateTier } = require('../controllers/tierController');

const router = express.Router();

// Optional base image the admin can upload for the Tier Fight poster (in
// memory; the controller hands the buffer to OpenAI images.edit). theme +
// thoughts ride along as multipart form fields.
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
});

router.use(protect);
router.use(orgGate('luc'));

// Reads: admin + team_lead (TL dashboards show the tier standings/image).
router.get('/', authorize('admin', 'team_lead'), getTiers);
router.get('/latest-image', authorize('admin', 'team_lead'), getLatestImage);
router.get('/images', authorize('admin', 'team_lead'), getImageHistory);

// Mutations: admin only.
router.post('/generate-image', authorize('admin'), imageUpload.single('image'), generateImage);
router.put('/:tier', authorize('admin'), updateTier);

module.exports = router;
