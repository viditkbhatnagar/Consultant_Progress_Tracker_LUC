const mongoose = require('mongoose');

// One row per docs-chat request (cache hits included). Not TTL — this is
// the analytical trail admins use to see what consultants are asking about
// and where the corpus has gaps. Kept indefinitely.
const FeedbackSchema = new mongoose.Schema(
    {
        rating: { type: String, enum: ['up', 'down'], required: true },
        comment: { type: String, default: '' },
        submittedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const DocsChatLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userOrg: { type: String },
    query: { type: String, required: true },
    normalizedQuery: { type: String, required: true, index: true },
    programFilter: { type: String, default: null },
    detectedVia: {
        type: String,
        enum: ['lead_context', 'alias_match', 'free_text_map', 'program_hint', null],
        default: null,
    },
    tier: { type: Number, required: true }, // 1 | 2 | 3
    exactMatch: { type: Boolean, default: false },
    cached: { type: Boolean, default: false },
    topScore: { type: Number, default: null },
    retrievalMethods: { type: [String], default: [] },
    sourceChunkIds: { type: [String], default: [] },
    provider: { type: String, default: null }, // 'groq' | 'openai' | null
    latencyMs: { type: Number },
    refusalReason: { type: String, default: null }, // 'low_score' | 'no_candidates' | null
    feedback: { type: FeedbackSchema, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
});

DocsChatLogSchema.index({ userId: 1, createdAt: -1 });
DocsChatLogSchema.index({ tier: 1, createdAt: -1 });
DocsChatLogSchema.index({ programFilter: 1, createdAt: -1 });

module.exports = mongoose.model('DocsChatLog', DocsChatLogSchema);
