const Notification = require('../models/Notification');
const Commitment = require('../models/Commitment');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res, next) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
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

        if (notification.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this notification',
            });
        }

        notification.isRead = true;
        notification.readAt = new Date();
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
            { user: req.user.id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create notification (internal helper)
exports.createNotification = async (userId, type, title, message, relatedCommitment = null, priority = 'medium') => {
    try {
        const notification = await Notification.create({
            user: userId,
            type,
            title,
            message,
            relatedCommitment,
            priority,
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

        // Find commitments with follow-up dates today or overdue that are still open
        const commitments = await Commitment.find({
            followUpDate: { $lte: tomorrow },
            admissionClosed: false,
            isActive: true,
        }).populate('teamLead', 'name');

        let notificationsCreated = 0;

        for (const commitment of commitments) {
            if (!commitment.teamLead) continue;

            // Skip if a reminder for this commitment has already been created today
            const existing = await Notification.findOne({
                user: commitment.teamLead._id,
                relatedCommitment: commitment._id,
                type: 'follow_up_reminder',
                createdAt: { $gte: today },
            });

            if (!existing) {
                const title = `Follow-up: ${commitment.studentName || 'Lead'}`;
                const snippet = (commitment.commitmentMade || '').substring(0, 80);
                await exports.createNotification(
                    commitment.teamLead._id,
                    'follow_up_reminder',
                    title,
                    `Follow-up reminder: ${snippet}`,
                    commitment._id,
                    'high'
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

        if (notification.user.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this notification',
            });
        }

        await notification.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Notification deleted',
        });
    } catch (error) {
        next(error);
    }
};
