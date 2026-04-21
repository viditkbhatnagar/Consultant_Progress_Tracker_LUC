const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

// Shared lead-stage enum used by Commitment and Meeting. Kept in one place so
// adding new values (like "No Answer"/"Lost" from the Meeting Tracker) flows
// through both schemas without drift.
const LEAD_STAGES = [
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
    'No Answer',
    'Lost',
];

// Skillhub-only: a commitment can carry up to 4 scheduled demo slots.
// Each slot tracks when the demo is scheduled, whether it has been completed,
// and when it was marked complete. LUC commitments ignore this field.
const DemoSlotSchema = new mongoose.Schema(
    {
        slot: {
            type: String,
            enum: ['Demo 1', 'Demo 2', 'Demo 3', 'Demo 4'],
            required: true,
        },
        scheduledAt: { type: Date, default: null },
        done: { type: Boolean, default: false },
        doneAt: { type: Date, default: null },
        notes: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const CommitmentSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },
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
        // The actual calendar date the team lead/counselor is logging this
        // commitment for (not when the row was created). Must fall inside
        // [weekStartDate, weekEndDate] for team_lead/skillhub creates;
        // admins can set any date.
        commitmentDate: {
            type: Date,
            required: [true, 'Commitment date is required'],
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
        // Skillhub-only: up to 4 demo slots. Ignored for LUC.
        demos: {
            type: [DemoSlotSchema],
            default: [],
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
            enum: LEAD_STAGES,
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

const Commitment = mongoose.model('Commitment', CommitmentSchema);

module.exports = Commitment;
module.exports.LEAD_STAGES = LEAD_STAGES;
