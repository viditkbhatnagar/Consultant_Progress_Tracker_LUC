const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

// A competition tier (1, 2, 3) grouping consultants across teams. Members are
// Consultant refs (stable — no name-matching at calc time). Each tier's "MTD
// amount" is computed live as the sum of its members' current-month achieved
// revenue. Admin-editable. Seeded once via scripts/seedTiers.js.
const TierSchema = new mongoose.Schema(
    {
        organization: { type: String, enum: ORGANIZATIONS, default: ORG_LUC, required: true },
        tier: { type: Number, required: true, min: 1, max: 3 },
        label: { type: String, default: '', trim: true },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Consultant' }],
    },
    { timestamps: true }
);

TierSchema.index({ organization: 1, tier: 1 }, { unique: true });

module.exports = mongoose.model('Tier', TierSchema);
