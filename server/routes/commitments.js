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
    .post(authorize('consultant'), createCommitment);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes like /:id
// Otherwise /:id will match everything

// Date range queries (BEFORE /:id)
router.get('/date-range', getCommitmentsByDateRange);

// Week-specific route (BEFORE /:id)
router.route('/week/:weekNumber/:year').get(getWeekCommitments);

// Consultant performance details (BEFORE /:id)
router.get(
    '/consultant/:consultantId/performance',
    authorize('team_lead', 'admin', 'consultant'),
    getConsultantPerformance
);

// Special action routes (BEFORE /:id)
router.patch('/:id/close', authorize('consultant', 'admin'), closeAdmission);
router.patch('/:id/meetings', authorize('consultant', 'admin'), updateMeetings);

// Specific commitment routes (This /:id route MUST come LAST)
router
    .route('/:id')
    .get(getCommitment)
    .put(updateCommitment)
    .delete(deleteCommitment);

module.exports = router;

