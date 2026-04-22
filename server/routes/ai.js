const express = require('express');
const {
    generateDashboardAnalysis,
    generateStudentAnalysis,
    getUsageStats,
} = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/analysis', authorize('admin', 'team_lead', 'skillhub'), generateDashboardAnalysis);
router.post(
    '/student-analysis',
    authorize('admin', 'team_lead', 'skillhub'),
    generateStudentAnalysis
);
router.get('/usage', authorize('admin'), getUsageStats);

module.exports = router;
