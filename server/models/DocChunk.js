const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

const PROGRAMS = {
    'ssm-dba': 'Swiss School of Management DBA',
    'ioscm-l7': 'IOSCM Level 7 Supply Chain Management',
    'knights-bsc': 'Knights College BSc Business Management',
    'knights-mba': 'Knights College Work-Based MBA',
    'malaysia-mba': 'Malaysia University MBA (MUST)',
    'othm-l5': 'OTHM Level 5 Extended Diploma',
    'ssm-bba': 'Swiss School of Management BBA',
    'ssm-mba': 'Swiss School of Management MBA',
};
const PROGRAM_SLUGS = Object.keys(PROGRAMS);

const DOC_TYPES = ['overview', 'qna'];
const SECTIONS = [
    'accreditation',
    'product',
    'scenario',
    'closing',
    'quick_ref',
    'overview',
];

const DocChunkSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },
        chunkId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        program: {
            type: String,
            enum: PROGRAM_SLUGS,
            required: true,
        },
        programDisplayName: {
            type: String,
            required: true,
        },
        docType: {
            type: String,
            enum: DOC_TYPES,
            required: true,
        },
        section: {
            type: String,
            enum: SECTIONS,
            required: true,
        },
        questionText: {
            type: String,
            default: null,
        },
        content: {
            type: String,
            required: true,
        },
        embedding: {
            type: [Number],
            default: [],
        },
        // questionEmbedding: separate 1536-dim vector for the questionText
        // alone (QNA chunks only). Used by Tier 1 exact-match retrieval so
        // the cosine threshold applies to "does this query match this
        // question?" rather than "does this query match this entire Q+A
        // body?" (which scores low for short natural-language queries).
        questionEmbedding: {
            type: [Number],
            default: [],
        },
        sourceFile: {
            type: String,
            required: true,
        },
        pageNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        pdfPath: {
            type: String,
            required: true,
        },
        // Phase 5: path to a single-page PDF with the chunk's text pre-
        // highlighted (yellow over content, light-blue over questionText
        // on QNA chunks). Populated by generateHighlightedPdfs.py after
        // the embedding ingest. Null until that script runs.
        highlightedPdfPath: {
            type: String,
            default: null,
        },
        contentHash: {
            type: String,
            required: true,
            index: true,
        },
        tokens: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

DocChunkSchema.index({ program: 1, docType: 1 });

module.exports = mongoose.model('DocChunk', DocChunkSchema);
module.exports.PROGRAMS = PROGRAMS;
module.exports.PROGRAM_SLUGS = PROGRAM_SLUGS;
module.exports.DOC_TYPES = DOC_TYPES;
module.exports.SECTIONS = SECTIONS;
