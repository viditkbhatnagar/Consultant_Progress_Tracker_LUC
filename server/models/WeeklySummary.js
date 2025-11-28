const mongoose = require('mongoose');

const WeeklySummarySchema = new mongoose.Schema(
    {
        // Scope
        consultant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        teamName: {
            type: String,
        },

        // Week
        weekNumber: {
            type: Number,
            required: true,
            min: 1,
            max: 53,
        },
        year: {
            type: Number,
            required: true,
        },
        weekStartDate: {
            type: Date,
            required: true,
        },
        weekEndDate: {
            type: Date,
            required: true,
        },

        // Aggregated metrics
        totalCommitments: {
            type: Number,
            default: 0,
        },
        totalAchieved: {
            type: Number,
            default: 0,
        },
        totalMeetingsDone: {
            type: Number,
            default: 0,
        },
        totalAdmissionsClosed: {
            type: Number,
            default: 0,
        },
        totalProspects: {
            type: Number,
            default: 0,
        },
        overallAchievementPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        // Auto-generated
        generatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
WeeklySummarySchema.index({ consultant: 1, weekNumber: 1, year: 1 });
WeeklySummarySchema.index({ teamLead: 1, weekNumber: 1, year: 1 });

module.exports = mongoose.model('WeeklySummary', WeeklySummarySchema);
