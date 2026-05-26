const mongoose = require('mongoose');
const { ALL_SLUGS } = require('../services/execOverview/bucketing');

// One row per (consultant, year, month). Mirrors a single row in the
// Excel team sheet: target + achieved + AGI counts + the 14 program
// bucket counts. Total Admissions, % Revenue, TEAM TOTAL row and YTD
// strip are derived (matching the formulas in the source workbook).
//
// All numeric fields default to 0 so callers can upsert just the cell
// they edited without re-supplying the rest.

const numField = () => ({ type: Number, default: 0, min: 0 });

const fields = {
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

    monthlyTarget: numField(),
    achievedRevenue: numField(),

    notes: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
};

// Add one Number field per bucket slug (14 program + 2 AGI = 16 fields).
// Keeping them flat (rather than nested under `buckets`) so the Mongoose
// $inc/$set queries and JSON payloads stay simple.
for (const slug of ALL_SLUGS) fields[slug] = numField();

const TeamMonthlyEntrySchema = new mongoose.Schema(fields, { timestamps: true });

TeamMonthlyEntrySchema.index(
    { consultant: 1, year: 1, month: 1 },
    { unique: true }
);

module.exports = mongoose.model('TeamMonthlyEntry', TeamMonthlyEntrySchema);
