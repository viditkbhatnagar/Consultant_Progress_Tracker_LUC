const mongoose = require('mongoose');

// User-saved Pivot Builder configurations. Plan §11 — server-side
// persistence so the same user gets their templates across devices.

const SavedExportTemplateSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        dataset: {
            type: String,
            required: true,
            enum: ['students', 'commitments', 'meetings', 'hourly'],
        },
        // Pivot config: { rowDim, colDim?, measure?, agg, filters?, columns? }.
        // Stored as a free-form subdocument so the schema doesn't have to
        // chase every dim/measure addition.
        config: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // Org scope the template was saved under (admin-only — others are
        // locked to their own scope at run time anyway).
        organization: {
            type: String,
            enum: ['luc', 'skillhub_training', 'skillhub_institute', 'all'],
            default: 'luc',
        },
    },
    { timestamps: true }
);

// One name per user. Re-saving with the same name returns 409 in the
// controller — UI prompts a rename.
SavedExportTemplateSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SavedExportTemplate', SavedExportTemplateSchema);
