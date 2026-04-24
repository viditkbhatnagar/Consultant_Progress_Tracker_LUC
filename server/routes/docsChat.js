const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const docsRagEnabled = require('../middleware/docsRagEnabled');
const docsRag = require('../services/docsRagService');
const DocChunk = require('../models/DocChunk');
const QueryCache = require('../models/QueryCache');
const DocsChatLog = require('../models/DocsChatLog');
const Student = require('../models/Student');
const { PROGRAMS } = DocChunk;

const router = express.Router();

// Kill switch (Phase 4.1): DOCS_RAG_ENABLED=false in Render returns 503 on
// every docs-chat route except /health (needed for monitoring) and /stats
// (admins may want stats while the feature is disabled for ops work).
router.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/stats') return next();
    return docsRagEnabled(req, res, next);
});

// ── Lead-context resolver (Phase 2 + Phase 3 C) ────────────────────────
async function resolveLeadContext({ studentId, leadId, programHint }, user) {
    const id = studentId || leadId;
    if (id) {
        try {
            const doc = await Student.findOne({
                _id: id,
                organization: 'luc',
            })
                .select('program teamLead organization')
                .lean();
            if (
                doc &&
                (user.role === 'admin' ||
                    String(doc.teamLead) === String(user._id))
            ) {
                const slug = docsRag.mapFreeTextToSlug(doc.program);
                return {
                    rawProgram: doc.program,
                    program: slug || null,
                };
            }
        } catch (_) {
            /* fall through */
        }
    }
    if (programHint && PROGRAMS[programHint]) {
        return { program: programHint };
    }
    return null;
}

// ── Public health probe (Render readiness) ─────────────────────────────
// No auth — Render needs to hit this without a JWT. Returns 503 if the
// in-memory index hasn't loaded or BM25 training failed so Render marks
// the instance unready before it gets user traffic.
router.get('/health', (req, res) => {
    const stats = docsRag.getStats();
    const ok = stats.chunks > 0 && docsRag.isLoaded();
    const payload = {
        ok,
        chunksLoaded: stats.chunks,
        questionsIndexed: stats.questions,
        bm25Ready: stats.chunks > 0,
        groqConfigured: Boolean(process.env.GROQ_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        lastIngestAt: stats.loadedAt,
        uptime: Math.round(process.uptime()),
    };
    res.status(ok ? 200 : 503).json(payload);
});

// ── Admin: re-ingest (must come before any /:id-shaped path) ───────────
router.post('/admin/reingest', protect, authorize('admin'), (req, res) => {
    const script = path.join(__dirname, '..', 'scripts', 'ingestProgramDocs.js');
    const args = req.query.force === 'true' ? ['--force'] : [];
    const child = spawn('node', [script, ...args], {
        cwd: path.join(__dirname, '..'),
        env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
        stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
        stderr += d.toString();
    });
    child.on('close', async (code) => {
        if (code === 0) {
            try {
                const stats = await docsRag.loadChunks();
                return res.json({
                    success: true,
                    exitCode: code,
                    stats,
                    stdout: stdout.slice(-4000),
                });
            } catch (err) {
                return res.status(500).json({
                    success: false,
                    message: `Ingest ok but reload failed: ${err.message}`,
                    stdout: stdout.slice(-4000),
                });
            }
        }
        res.status(500).json({
            success: false,
            exitCode: code,
            stdout: stdout.slice(-4000),
            stderr: stderr.slice(-2000),
        });
    });
});

// ── Admin: stats (chunks + cache + tiers + top/refusal/low-conf queries) ──
router.get('/stats', protect, authorize('admin'), async (req, res, next) => {
    try {
        const now = Date.now();
        const since24h = new Date(now - 24 * 3600 * 1000);
        const since7d = new Date(now - 7 * 24 * 3600 * 1000);

        // Chunks by program (and docType)
        const byProgramDetailed = await DocChunk.aggregate([
            {
                $group: {
                    _id: { program: '$program', docType: '$docType' },
                    n: { $sum: 1 },
                },
            },
        ]);
        const chunkCountsByProgram = {};
        for (const r of byProgramDetailed) {
            const k = r._id.program;
            if (!chunkCountsByProgram[k]) chunkCountsByProgram[k] = 0;
            chunkCountsByProgram[k] += r.n;
        }

        // Last ingest: freshest DocChunk.createdAt (since `--force` resets
        // every row atomically at ingest time, this is the ingest moment).
        const latestChunk = await DocChunk.findOne({})
            .sort({ createdAt: -1 })
            .select('createdAt')
            .lean();
        const lastIngestAt = latestChunk ? latestChunk.createdAt : null;

        // Cache + tier rollups (24h) — one aggregation pass over DocsChatLog.
        const last24hLogs = await DocsChatLog.aggregate([
            { $match: { createdAt: { $gte: since24h } } },
            {
                $group: {
                    _id: { tier: '$tier', cached: '$cached' },
                    n: { $sum: 1 },
                    avgLatency: { $avg: '$latencyMs' },
                },
            },
        ]);
        const tierDistribution24h = { tier1: 0, tier2: 0, tier3: 0 };
        const latencySums = { tier1: [0, 0], tier2: [0, 0], tier3: [0, 0] };
        let cacheHits = 0;
        let totalReqs = 0;
        for (const row of last24hLogs) {
            const tk = `tier${row._id.tier}`;
            if (tierDistribution24h[tk] !== undefined) {
                tierDistribution24h[tk] += row.n;
            }
            if (row._id.cached) cacheHits += row.n;
            totalReqs += row.n;
            if (latencySums[tk]) {
                latencySums[tk][0] += row.avgLatency * row.n;
                latencySums[tk][1] += row.n;
            }
        }
        const cacheStats24h = {
            hits: cacheHits,
            misses: totalReqs - cacheHits,
            hitRate:
                totalReqs > 0 ? Number((cacheHits / totalReqs).toFixed(3)) : 0,
            total: totalReqs,
        };
        const avgLatencyByTier24h = {
            tier1:
                latencySums.tier1[1] > 0
                    ? Math.round(latencySums.tier1[0] / latencySums.tier1[1])
                    : null,
            tier2:
                latencySums.tier2[1] > 0
                    ? Math.round(latencySums.tier2[0] / latencySums.tier2[1])
                    : null,
            tier3:
                latencySums.tier3[1] > 0
                    ? Math.round(latencySums.tier3[0] / latencySums.tier3[1])
                    : null,
        };

        // Top queries (7d) — grouped on normalizedQuery.
        const topQueries7d = await DocsChatLog.aggregate([
            { $match: { createdAt: { $gte: since7d } } },
            {
                $group: {
                    _id: '$normalizedQuery',
                    count: { $sum: 1 },
                    avgTier: { $avg: '$tier' },
                    avgLatency: { $avg: '$latencyMs' },
                    lastQuery: { $last: '$query' },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 20 },
            {
                $project: {
                    _id: 0,
                    normalizedQuery: '$_id',
                    sampleQuery: '$lastQuery',
                    count: 1,
                    avgTier: { $round: ['$avgTier', 2] },
                    avgLatency: { $round: ['$avgLatency', 0] },
                },
            },
        ]);

        // Low-confidence: tier !== 3 but top cosine below 0.5.
        const lowConfidenceQueries24h = await DocsChatLog.find({
            createdAt: { $gte: since24h },
            tier: { $ne: 3 },
            topScore: { $gt: 0, $lt: 0.5 },
        })
            .sort({ createdAt: -1 })
            .limit(25)
            .select('query topScore tier programFilter createdAt')
            .lean();

        // Tier 3 refusals — the gaps in the corpus.
        const refusalQueries24h = await DocsChatLog.find({
            createdAt: { $gte: since24h },
            tier: 3,
        })
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(50)
            .select('query programFilter createdAt userId topScore')
            .lean();

        const rag = docsRag.getStats();
        res.json({
            success: true,
            data: {
                chunks: {
                    total: rag.chunks,
                    questions: rag.questions,
                    byProgram: byProgramDetailed,
                },
                chunkCountsByProgram,
                cache: { last24h: await QueryCache.countDocuments({}) },
                cacheStats24h,
                tierDistribution24h,
                avgLatencyByTier24h,
                topQueries7d,
                lowConfidenceQueries24h,
                refusalQueries24h,
                lastIngestAt,
                loadedAt: rag.loadedAt,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ── Feedback: thumbs up/down on a logged answer ────────────────────────
router.post('/feedback', protect, async (req, res, next) => {
    try {
        const { logId, rating, comment } = req.body || {};
        if (!logId || !['up', 'down'].includes(rating)) {
            return res.status(400).json({
                success: false,
                message: 'logId and rating (up|down) are required',
            });
        }
        // Only allow the original requester to submit feedback on their own
        // log entry. Admins can feedback anyone's for triage.
        const match = {
            _id: logId,
            ...(req.user.role === 'admin'
                ? {}
                : { userId: req.user._id }),
        };
        const updated = await DocsChatLog.findOneAndUpdate(
            match,
            {
                $set: {
                    feedback: {
                        rating,
                        comment: comment ? String(comment).slice(0, 500) : '',
                        submittedAt: new Date(),
                    },
                },
            },
            { new: true }
        )
            .select('_id feedback')
            .lean();
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Log entry not found',
            });
        }
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// ── Consultant chat (LUC only, SSE) ─────────────────────────────────────
router.post('/', protect, orgGate('luc'), async (req, res) => {
    const { query, leadId, studentId, programHint } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({
            success: false,
            message: 'query (string) is required',
        });
    }

    if (!docsRag.isLoaded()) {
        return res.status(503).json({
            success: false,
            message: 'Docs RAG index is still loading. Try again shortly.',
        });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    try {
        const leadContext = await resolveLeadContext(
            { studentId, leadId, programHint },
            req.user
        );
        await docsRag.answer(query, {
            user: req.user,
            leadContext,
            res,
        });
    } catch (err) {
        if (!res.writableEnded) {
            res.write(`event: error\n`);
            res.write(
                `data: ${JSON.stringify({ message: err.message || 'server error' })}\n\n`
            );
            res.end();
        }
    }
});

module.exports = router;
