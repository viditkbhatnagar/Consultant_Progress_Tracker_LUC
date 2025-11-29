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
} = require('../controllers/commitmentController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Main CRUD routes
router
    .route('/')
    .get(getCommitments)
    .post(authorize('team_lead'), createCommitment);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes like /:id
// Otherwise /:id will match everything

// Date range queries (BEFORE /:id)
router.get('/date-range', getCommitmentsByDateRange);

// Week-specific route (BEFORE /:id)
router.route('/week/:weekNumber/:year').get(getWeekCommitments);

// Consultant performance details (BEFORE /:id)
router.get(
    '/consultant/:consultantName/performance',
    authorize('team_lead', 'admin'),
    getConsultantPerformance
);

// Specific actions (BEFORE /:id)
router.put('/:id/close-admission', authorize('team_lead', 'admin'), closeAdmission);
router.put('/:id/meetings', authorize('team_lead', 'admin'), updateMeetings);

// Single commitment operations (This /:id route MUST come LAST)
router
    .route('/:id')
    .get(getCommitment)
    .put(authorize('team_lead', 'admin'), updateCommitment)
    .delete(authorize('admin'), deleteCommitment);

module.exports = router;

