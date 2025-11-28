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

// Week-specific route
router.route('/week/:weekNumber/:year').get(getWeekCommitments);

// Specific commitment routes
router
    .route('/:id')
    .get(getCommitment)
    .put(updateCommitment)
    .delete(deleteCommitment);

// Special action routes
router.patch('/:id/close', authorize('consultant', 'admin'), closeAdmission);
router.patch('/:id/meetings', authorize('consultant', 'admin'), updateMeetings);

module.exports = router;
