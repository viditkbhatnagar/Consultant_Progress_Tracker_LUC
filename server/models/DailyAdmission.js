const mongoose = require('mongoose');

const DailyAdmissionSchema = new mongoose.Schema(
    {
        consultant: {
            type: mongoose.Schema.ObjectId,
            ref: 'Consultant',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        count: {
            type: Number,
            default: 0,
        },
        loggedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

DailyAdmissionSchema.index({ consultant: 1, date: 1 }, { unique: true });
DailyAdmissionSchema.index({ date: 1 });

module.exports = mongoose.model('DailyAdmission', DailyAdmissionSchema);
