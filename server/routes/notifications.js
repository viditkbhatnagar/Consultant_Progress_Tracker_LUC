const express = require('express');
const {
    getNotifications,
    markAsRead,
    markAllAsRead,
    generateFollowUpReminders,
    deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.route('/').get(getNotifications);
router.route('/read-all').patch(markAllAsRead);
router.route('/generate-reminders').post(authorize('admin', 'team_lead'), generateFollowUpReminders);
router.route('/:id/read').patch(markAsRead);
router.route('/:id').delete(deleteNotification);

module.exports = router;
