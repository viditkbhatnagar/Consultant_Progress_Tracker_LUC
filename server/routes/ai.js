const express = require('express');
const { generateDashboardAnalysis, getUsageStats } = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/analysis', authorize('admin', 'team_lead'), generateDashboardAnalysis);
router.get('/usage', authorize('admin'), getUsageStats);

module.exports = router;
