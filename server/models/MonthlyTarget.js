const mongoose = require('mongoose');

const MonthlyTargetSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ['luc'],
            default: 'luc',
            required: true,
            index: true,
        },
        teamLead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        consultant: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Consultant',
            required: true,
            index: true,
        },
        consultantName: { type: String, required: true, trim: true },
        year: { type: Number, required: true, min: 2020, max: 2100 },
        month: { type: Number, required: true, min: 1, max: 12 },
        targetAmount: { type: Number, required: true, min: 0, default: 0 },
        notes: { type: String, default: '', trim: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

MonthlyTargetSchema.index(
    { consultant: 1, year: 1, month: 1 },
    { unique: true }
);

module.exports = mongoose.model('MonthlyTarget', MonthlyTargetSchema);
