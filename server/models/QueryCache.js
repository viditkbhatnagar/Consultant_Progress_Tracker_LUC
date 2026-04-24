const mongoose = require('mongoose');
const config = require('../config/docsRagConfig');

const SourceSchema = new mongoose.Schema(
    {
        chunkId: String,
        program: String,
        programDisplayName: String,
        docType: String,
        section: String,
        sourceFile: String,
        pageNumber: Number,
        pdfUrl: String,
        score: Number,
        retrievalMethod: String,
    },
    { _id: false }
);

const QueryCacheSchema = new mongoose.Schema(
    {
        cacheKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        query: { type: String, required: true },
        programFilter: { type: String, default: null },
        answer: { type: String, required: true },
        sources: { type: [SourceSchema], default: [] },
        tier: { type: Number, required: true }, // 1 or 2 (refusals not cached)
        // TTL: MongoDB auto-deletes after `expires` seconds past createdAt.
        createdAt: {
            type: Date,
            default: Date.now,
            expires: config.cacheTtl,
        },
    },
    { timestamps: { createdAt: false, updatedAt: true } }
);

module.exports = mongoose.model('QueryCache', QueryCacheSchema);
