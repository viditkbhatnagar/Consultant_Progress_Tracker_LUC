const mongoose = require('mongoose');

const DailyReferenceSchema = new mongoose.Schema(
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

DailyReferenceSchema.index({ consultant: 1, date: 1 }, { unique: true });
DailyReferenceSchema.index({ date: 1 });

module.exports = mongoose.model('DailyReference', DailyReferenceSchema);
