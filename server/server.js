require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');
const orgGate = require('./middleware/orgGate');
const docsRagEnabled = require('./middleware/docsRagEnabled');
const docsRag = require('./services/docsRagService');

// Connect to database
connectDB();

const app = express();

// Security headers (plan §13.9). `crossOriginResourcePolicy` is loosened
// because we serve auth-blob PDFs + image snippets to the same SPA origin.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'same-site' },
        contentSecurityPolicy: false, // CRA inline-styles + dynamic chunks; defer CSP tuning to a later pass.
    })
);

// CORS configuration - allow all origins in development
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/commitments', require('./routes/commitments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/consultants', require('./routes/consultants'));
app.use('/api/students', require('./routes/students'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/hourly', require('./routes/hourly'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/reconciliation', require('./routes/reconciliation'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/docs-chat', require('./routes/docsChat'));

// Auth-gated static PDFs (spec §7). Must sit before the SPA catch-all so
// that /program-docs/* never falls through to index.html. JWT + LUC-only.
// Kill switch first: when disabled, don't even hint at 401/403 — return
// 503 so the chat drawer and the PDF route fail in lockstep.
app.use(
    '/program-docs',
    docsRagEnabled,
    protect,
    orgGate('luc'),
    express.static(path.join(__dirname, '..', 'client', 'public', 'program-docs'), {
        fallthrough: false,
        index: false,
    })
);

// Phase 5 — single-page, pre-highlighted PDFs used by the in-drawer
// preview panel. Same middleware stack as /program-docs/* so the kill
// switch, auth, and LUC-only gating all apply identically.
app.use(
    '/program-docs-highlighted',
    docsRagEnabled,
    protect,
    orgGate('luc'),
    express.static(
        path.join(__dirname, '..', 'client', 'public', 'program-docs-highlighted'),
        { fallthrough: false, index: false }
    )
);

// Phase 5.3 — PNG snippet crops (highlight region + context) used by
// the split-pane preview. Same auth/org stack. Tiny compared to the
// full-page PDFs (~40-80 KB each at 150 DPI).
app.use(
    '/program-docs-snippets',
    docsRagEnabled,
    protect,
    orgGate('luc'),
    express.static(
        path.join(__dirname, '..', 'client', 'public', 'program-docs-snippets'),
        { fallthrough: false, index: false }
    )
);

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
    });
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));

    // All other GET requests not handled by API routes serve the React app
    app.get(/^(?!\/api).*/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
}

// Error handler (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Load the Docs RAG in-memory index. Mongoose buffers operations until
// connection is up, so calling loadChunks() immediately is safe regardless
// of whether connectDB has resolved. Don't block boot on failure — if the
// index can't load, /api/docs-chat returns 503 until an admin triggers
// /api/docs-chat/admin/reingest.
const t0 = Date.now();
docsRag
    .loadChunks()
    .then((s) =>
        console.log(
            `Docs RAG: loaded ${s.chunks} chunks (${s.questions} questions in exact-match index) in ${Date.now() - t0}ms`
        )
    )
    .catch((err) =>
        console.error(`Docs RAG: failed to load chunks — ${err.message}`)
    );

// Daily drift monitor — bell admins when LUC closed commitments older
// than 7 days are still missing a linked Student record. Runs once on
// boot (delayed) and every 24h. Skipped in test mode.
if (process.env.NODE_ENV !== 'test') {
    const { startDriftMonitor } = require('./services/driftMonitor');
    startDriftMonitor();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});
