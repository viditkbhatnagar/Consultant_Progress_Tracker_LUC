const express = require('express');
const {
    getCommitments,
    getCommitment,
    createCommitment,
    updateCommitment,
    deleteCommitment,
    closeAdmission,
    updateMeetings,
    getWeekCommitments,
    getCommitmentsByDateRange,
    getConsultantPerformance,
    getAIAnalysis,
    getLinkableCommitments,
} = require('../controllers/commitmentController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Main CRUD routes
router
    .route('/')
    .get(getCommitments)
    .post(authorize('team_lead', 'skillhub', 'admin'), createCommitment);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes like /:id
// Otherwise /:id will match everything

// Date range queries (BEFORE /:id)
router.get('/date-range', authorize('team_lead', 'admin', 'skillhub'), getCommitmentsByDateRange);

// Linkable commitments — backs the StudentFormDialog "Linked Commitment"
// picker and the reconciliation page (BEFORE /:id).
router.get('/linkable', authorize('admin', 'team_lead'), getLinkableCommitments);

// AI analysis for the Commitment Tracker page (BEFORE /:id)
router.get('/ai-analysis', authorize('admin', 'team_lead'), getAIAnalysis);

// Week-specific route (BEFORE /:id)
router.route('/week/:weekNumber/:year').get(getWeekCommitments);

// Consultant performance details (BEFORE /:id)
router.get(
    '/consultant/:consultantName/performance',
    authorize('team_lead', 'admin', 'skillhub'),
    getConsultantPerformance
);

// Specific actions (BEFORE /:id)
router.put('/:id/close-admission', authorize('team_lead', 'admin', 'skillhub'), closeAdmission);
router.put('/:id/meetings', authorize('team_lead', 'admin', 'skillhub'), updateMeetings);

// Single commitment operations (This /:id route MUST come LAST)
router
    .route('/:id')
    .get(getCommitment)
    .put(authorize('team_lead', 'admin', 'skillhub'), updateCommitment)
    .delete(authorize('admin'), deleteCommitment);

module.exports = router;

