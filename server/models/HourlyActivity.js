const mongoose = require('mongoose');

const HourlyActivitySchema = new mongoose.Schema(
    {
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
            enum: [
                's0930',
                's1030',
                's1130',
                's1230',
                's1400',
                's1500',
                's1600',
                's1700',
                's1800',
                's1900',
            ],
        },
        activityType: {
            type: String,
            required: [true, 'Activity type is required'],
            enum: [
                'call',
                'followup',
                'call_followup',
                'noshow',
                'drip',
                'meeting',
                'zoom',
                'outmeet',
                'teammeet',
                'tlmeet',
            ],
        },
        count: {
            type: Number,
            default: 1,
        },
        duration: {
            type: Number,
            default: 60,
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
