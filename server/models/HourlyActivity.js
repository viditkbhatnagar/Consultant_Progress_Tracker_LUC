const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');
const {
    ALL_SLOT_IDS,
    ALL_ACTIVITY_TYPES,
} = require('../utils/hourlyConstants');

const HourlyActivitySchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },
        consultant: {
            type: mongoose.Schema.ObjectId,
            ref: 'Consultant',
            required: [true, 'Consultant is required'],
        },
        consultantName: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
        },
        slotId: {
            type: String,
            required: [true, 'Slot ID is required'],
            enum: ALL_SLOT_IDS,
        },
        activityType: {
            type: String,
            required: [true, 'Activity type is required'],
            enum: ALL_ACTIVITY_TYPES,
        },
        count: {
            type: Number,
            default: 1,
        },
        followupCount: {
            type: Number,
            default: 0,
        },
        duration: {
            type: Number,
            default: 60,
        },
        // Optional multi-activity payload for a slot (Skillhub only today).
        // When populated, readers/aggregators should iterate this instead of the
        // flat activityType/count/duration fields. Flat fields still mirror the
        // primary (first) item for backwards compatibility with older readers.
        activities: {
            type: [
                {
                    _id: false,
                    activityType: { type: String, enum: ALL_ACTIVITY_TYPES, required: true },
                    count: { type: Number, default: 1 },
                    followupCount: { type: Number, default: 0 },
                    duration: { type: Number, default: 0 },
                },
            ],
            default: [],
        },
        note: {
            type: String,
            default: '',
        },
        isContinuation: {
            type: Boolean,
            default: false,
        },
        parentSlotId: {
            type: String,
            default: null,
        },
        loggedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// One entry per consultant per date per slot
HourlyActivitySchema.index(
    { consultant: 1, date: 1, slotId: 1 },
    { unique: true }
);

// Fast daily lookups
HourlyActivitySchema.index({ date: 1 });

module.exports = mongoose.model('HourlyActivity', HourlyActivitySchema);
