const express = require('express');
const {
    getMeetings,
    getMeetingStats,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getAIAnalysis,
} = require('../controllers/meetingController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(authorize('admin', 'team_lead'), getMeetings)
    .post(authorize('admin', 'team_lead'), createMeeting);

// Specific routes BEFORE /:id so Express matches them correctly.
router.get('/stats', authorize('admin', 'team_lead'), getMeetingStats);
router.get('/ai-analysis', authorize('admin', 'team_lead'), getAIAnalysis);

router
    .route('/:id')
    .get(authorize('admin', 'team_lead'), getMeeting)
    .put(authorize('admin', 'team_lead'), updateMeeting)
    .delete(authorize('admin'), deleteMeeting);

module.exports = router;
