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
            // Enum expanded to match the real user role set. The original
            // version only listed admin+team_lead, which silently rejected
            // chat usage rows coming from skillhub/manager accounts.
            enum: ['admin', 'team_lead', 'manager', 'skillhub'],
            required: true,
        },
        // Which feature produced this call. Default 'analysis' keeps legacy
        // rows (written before the chatbot shipped) labeled correctly — the
        // AI-analysis dashboard tool was the only consumer back then.
        type: {
            type: String,
            enum: ['analysis', 'chat'],
            default: 'analysis',
            index: true,
        },
        // Cached at write time so admin's "by team" breakdown doesn't need
        // an extra populate-join on every read. Populated from req.user at
        // the controller/service layer.
        teamName: {
            type: String,
            trim: true,
            default: '',
        },
        organization: {
            type: String,
            trim: true,
            default: '',
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
