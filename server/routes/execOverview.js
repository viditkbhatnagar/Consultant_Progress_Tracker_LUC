const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const {
    getOverview,
    getTeam,
    getTeams,
    getConsultantPerformanceRankings,
} = require('../controllers/execOverviewController');

const router = express.Router();

router.use(protect);
router.use(orgGate('luc'));

// Specific routes BEFORE the parameterized one.
router.get('/teams', authorize('admin', 'team_lead'), getTeams);
router.get('/consultant-performance', authorize('admin', 'team_lead'), getConsultantPerformanceRankings);
router.get('/team/:teamLeadId', authorize('admin', 'team_lead'), getTeam);
router.get('/', authorize('admin', 'team_lead'), getOverview);

module.exports = router;
