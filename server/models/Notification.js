const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['follow_up_reminder', 'weekly_summary', 'commitment_due', 'team_update'],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        relatedCommitment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Commitment',
        },

        isRead: {
            type: Boolean,
            default: false,
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium',
        },

        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
