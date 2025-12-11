const mongoose = require('mongoose');

const CommitmentSchema = new mongoose.Schema(
    {
        // Ownership
        consultantName: {
            type: String,
            required: [true, 'Consultant name is required'],
            trim: true,
        },
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Team lead is required'],
        },
        teamName: {
            type: String,
            required: true,
        },

        // Week tracking
        weekNumber: {
            type: Number,
            required: [true, 'Week number is required'],
            min: 1,
            max: 53,
        },
        year: {
            type: Number,
            required: [true, 'Year is required'],
        },
        weekStartDate: {
            type: Date,
            required: [true, 'Week start date is required'],
        },
        weekEndDate: {
            type: Date,
            required: [true, 'Week end date is required'],
        },
        dayCommitted: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },

        // Lead details
        studentName: {
            type: String,
            trim: true,
        },
        studentPhone: {
            type: String,
            trim: true,
            default: '',
            validate: {
                validator: function (v) {
                    // Allow empty string (optional field)
                    if (!v || v.trim() === '') return true;
                    // If provided, validate basic phone format (digits, spaces, +, -, ())
                    return /^[\d\s\-\+\(\)]+$/.test(v);
                },
                message: 'Please provide a valid phone number (digits, spaces, +, -, () only)'
            }
        },
        commitmentMade: {
            type: String,
            required: [true, 'Commitment description is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            // Alias for commitmentMade for clearer naming
            get: function () {
                return this.commitmentMade;
            },
            set: function (value) {
                this.commitmentMade = value;
            }
        },
        leadStage: {
            type: String,
            enum: ['Cold', 'Warm', 'Hot', 'Unresponsive', 'Meeting Scheduled', 'Admission'],
            default: 'Cold',
        },
        commitmentAchieved: {
            type: String,
            trim: true,
        },
        meetingsDone: {
            type: Number,
            default: 0,
            min: 0,
        },
        achievementPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        // Status tracking
        reasonForNotAchieving: {
            type: String,
            trim: true,
        },
        leadStage: {
            type: String,
            enum: [
                'Dead',
                'Cold',
                'Warm',
                'Hot',
                'Offer Sent',
                'Awaiting Confirmation',
                'Meeting Scheduled',
                'Admission',
                'CIF',
                'Unresponsive',
            ],
            default: 'Cold',
        },
        conversionProbability: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        // Follow-up
        followUpDate: {
            type: Date,
        },
        followUpNotes: {
            type: String,
            trim: true,
        },
        expectedConversionDate: {
            type: Date,
        },

        // Management oversight
        commitmentVsAchieved: {
            type: String,
            trim: true,
        },
        correctiveActionByTL: {
            type: String,
            trim: true,
        },
        adminComment: {
            type: String,
            trim: true,
        },
        prospectForWeek: {
            type: Number,
            min: 0,
        },

        // Final status
        admissionClosed: {
            type: Boolean,
            default: false,
        },
        admissionClosedDate: {
            type: Date,
            default: null,
        },
        closedDate: {
            type: Date,
        },
        closedAmount: {
            type: Number,
            min: 0,
        },

        // Status
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'achieved', 'missed'],
            default: 'pending',
        },
        isActive: {
            type: Boolean,
            default: true,
        },

        // Audit
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for faster queries
CommitmentSchema.index({ consultantName: 1, weekNumber: 1, year: 1 });
CommitmentSchema.index({ teamLead: 1, weekNumber: 1, year: 1 });
CommitmentSchema.index({ weekStartDate: 1 });
CommitmentSchema.index({ leadStage: 1 });
CommitmentSchema.index({ admissionClosed: 1 });

module.exports = mongoose.model('Commitment', CommitmentSchema);
