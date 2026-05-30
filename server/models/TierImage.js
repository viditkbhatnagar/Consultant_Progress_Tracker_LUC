const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

// One generated tier-standings image. The AI draws a varied motivational scene
// (no text); the exact tier labels + amounts are overlaid as real text on the
// client, so numbers are always crisp. We keep a snapshot of the tier totals at
// generation time so the overlay matches the moment it was generated.
const TierImageSchema = new mongoose.Schema(
    {
        organization: { type: String, enum: ORGANIZATIONS, default: ORG_LUC, required: true },
        // The AI scene as a data URL (data:image/png;base64,...).
        image: { type: String, required: true },
        theme: { type: String, default: '' },
        headline: { type: String, default: 'Month-End Race Is On!' },
        month: { type: Number },
        year: { type: Number },
        tiers: [
            {
                _id: false,
                tier: Number,
                label: String,
                mtdAchieved: Number,
            },
        ],
        generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true }
);

TierImageSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model('TierImage', TierImageSchema);
