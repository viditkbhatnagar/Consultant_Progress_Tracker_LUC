const express = require('express');
const {
    generateDashboardAnalysis,
    generateStudentAnalysis,
    generateTeamAnalysis,
    generateConsultantAnalysis,
    getAnalysisTargets,
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
// Admin-only deep breakdown endpoints.
router.get('/analysis-targets', authorize('admin'), getAnalysisTargets);
router.post('/team-analysis', authorize('admin'), generateTeamAnalysis);
router.post('/consultant-analysis', authorize('admin'), generateConsultantAnalysis);
router.get('/usage', authorize('admin'), getUsageStats);

module.exports = router;
