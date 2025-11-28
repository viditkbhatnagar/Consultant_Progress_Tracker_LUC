const Notification = require('../models/Notification');
const User = require('../models/User');
const Commitment = require('../models/Commitment');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({
            recipient: req.user.id,
            isActive: true
        })
            .sort('-createdAt')
            .limit(50);

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found',
            });
        }

        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this notification',
            });
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({
            success: true,
            data: notification,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create notification (Internal use)
exports.createNotification = async (recipientId, type, message, relatedCommitment = null) => {
    try {
        const notification = await Notification.create({
            recipient: recipientId,
            type,
            message,
            relatedCommitment,
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// @desc    Generate follow-up reminders for commitments
// @route   POST /api/notifications/generate-reminders
// @access  Private/Admin
exports.generateFollowUpReminders = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find commitments with follow-up dates today or overdue
        const commitments = await Commitment.find({
            followUpDate: { $lte: tomorrow },
            admissionClosed: false,
            isActive: true,
        }).populate('consultant');

        let notificationsCreated = 0;

        for (const commitment of commitments) {
            // Check if notification already exists for this commitment today
            const existingNotification = await Notification.findOne({
                recipient: commitment.consultant._id,
                relatedCommitment: commitment._id,
                type: 'follow_up',
                createdAt: { $gte: today },
            });

            if (!existingNotification) {
                await exports.createNotification(
                    commitment.consultant._id,
                    'follow_up',
                    `Follow-up reminder: ${commitment.studentName || 'Student'} - ${commitment.commitmentMade.substring(0, 50)}...`,
                    commitment._id
                );
                notificationsCreated++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Generated ${notificationsCreated} follow-up reminders`,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found',
            });
        }

        if (notification.recipient.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this notification',
            });
        }

        notification.isActive = false;
        await notification.save();

        res.status(200).json({
            success: true,
            message: 'Notification deleted',
        });
    } catch (error) {
        next(error);
    }
};
