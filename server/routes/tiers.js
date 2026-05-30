const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const { getTiers, generateImage, getLatestImage, getImageHistory, updateTier } = require('../controllers/tierController');

const router = express.Router();

router.use(protect);
router.use(orgGate('luc'));

// Reads: admin + team_lead (TL dashboards show the tier standings/image).
router.get('/', authorize('admin', 'team_lead'), getTiers);
router.get('/latest-image', authorize('admin', 'team_lead'), getLatestImage);
router.get('/images', authorize('admin', 'team_lead'), getImageHistory);

// Mutations: admin only.
router.post('/generate-image', authorize('admin'), generateImage);
router.put('/:tier', authorize('admin'), updateTier);

module.exports = router;
