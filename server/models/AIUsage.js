const mongoose = require('mongoose');

const AIUsageSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        role: {
            type: String,
            enum: ['admin', 'team_lead'],
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
        promptTokens: {
            type: Number,
            required: true,
        },
        completionTokens: {
            type: Number,
            required: true,
        },
        totalTokens: {
            type: Number,
            required: true,
        },
        cost: {
            type: Number,
            required: true,
        },
        dateRangeQueried: {
            startDate: String,
            endDate: String,
        },
    },
    { timestamps: true }
);

AIUsageSchema.index({ createdAt: -1 });
AIUsageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AIUsage', AIUsageSchema);
