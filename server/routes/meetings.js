const express = require('express');
const {
    getMeetings,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
} = require('../controllers/meetingController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(authorize('admin', 'team_lead'), getMeetings)
    .post(authorize('admin', 'team_lead'), createMeeting);

router
    .route('/:id')
    .get(authorize('admin', 'team_lead'), getMeeting)
    .put(authorize('admin', 'team_lead'), updateMeeting)
    .delete(authorize('admin'), deleteMeeting);

module.exports = router;
