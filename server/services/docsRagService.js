/**
 * Docs RAG service — phase 2 (spec §6).
 *
 * Brute-force in-memory retrieval over ~200 chunks. Three-tier logic:
 *   Tier 1 — exact-match on QNA questions (cosine ≥ exactMatchThreshold)
 *   Tier 2 — hybrid dense + BM25 with RRF fusion
 *   Tier 3 — refuse when top score < minScore
 *
 * Generation: Groq llama-3.3-70b primary, OpenAI gpt-4o-mini fallback.
 * Answers cached in QueryCache (24h TTL) keyed by sha1(normalize(query) +
 * '|' + programFilter).
 */
const https = require('https');
const crypto = require('crypto');
const OpenAI = require('openai');
const Groq = require('groq-sdk');
const bm25Factory = require('wink-bm25-text-search');

const DocChunk = require('../models/DocChunk');
const QueryCache = require('../models/QueryCache');
const DocsChatLog = require('../models/DocsChatLog');
const config = require('../config/docsRagConfig');
const { PROGRAMS, PROGRAM_SLUGS } = DocChunk;

// ── HTTP keep-alive for both LLM APIs (spec §6e-bis) ─────────────────────
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

let openaiClient;
const getOpenAI = () => {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            httpAgent: keepAliveAgent,
        });
    }
    return openaiClient;
};

let groqClient;
const getGroq = () => {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not configured');
        }
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
            httpAgent: keepAliveAgent,
        });
    }
    return groqClient;
};

// ── Program aliases (spec §3e) ──────────────────────────────────────────
// Lowercased. The detector matches on whole-word boundaries where possible.
const PROGRAM_ALIASES = {
    'ssm-dba': ['dba', 'doctorate', 'ph.d', 'doctor of business', 'ssm dba'],
    'ioscm-l7': [
        'ioscm',
        'level 7 supply chain',
        'supply chain management l7',
        'ofqual supply chain',
    ],
    'knights-bsc': [
        'knights bsc',
        'bsc business management',
        'bachelor science knights',
        'cmbs bsc',
    ],
    'knights-mba': [
        'knights mba',
        'work-based mba',
        'work based mba',
        'cmbs mba',
    ],
    'malaysia-mba': [
        'malaysia',
        'must',
        'malaysian mba',
        'malaysia university',
    ],
    'othm-l5': ['othm', 'level 5', 'l5 diploma', 'extended diploma'],
    'ssm-bba': ['bba', 'bachelor business administration', 'ssm bba'],
    'ssm-mba': ['ssm mba', 'swiss mba', 'swiss school mba'],
};

// ── Module-level in-memory state ─────────────────────────────────────────
let docChunks = []; // [{ ...metadata, embedding: Float32Array, contentLower: string }]
let questionIndex = []; // QNA chunks with questionText, same shape
let bm25 = null;
let loaded = false;
let loadedAt = null;

// ── Math helpers ─────────────────────────────────────────────────────────
// OpenAI text-embedding-3-small returns unit-normalized vectors, so cosine
// similarity reduces to dot product. ~1536 mults × 200 chunks ≈ <1ms.
const dot = (a, b) => {
    let s = 0;
    const n = a.length;
    for (let i = 0; i < n; i += 1) s += a[i] * b[i];
    return s;
};

const toFloat32 = (arr) => {
    const f = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i += 1) f[i] = arr[i];
    return f;
};

// ── Query normalization + cache key ─────────────────────────────────────
const normalize = (q) =>
    q.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.?!,;:]+$/g, '');

const cacheKeyFor = (query, programFilter) =>
    crypto
        .createHash('sha1')
        .update(normalize(query) + '|' + (programFilter || ''))
        .digest('hex');

// ── BM25 configuration ──────────────────────────────────────────────────
const stopwords = new Set(
    ('the a an and or of to in for on at is are was were be been being it this ' +
        'that these those with by from as its it\'s')
        .split(' ')
);
const tokenize = (text) =>
    (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 2 && !stopwords.has(t));

const prepForBm25 = (text) => tokenize(text);

// ── loadChunks: called once at server boot ──────────────────────────────
async function loadChunks() {
    const rows = await DocChunk.find({})
        .select(
            'chunkId program programDisplayName docType section questionText content embedding questionEmbedding sourceFile pageNumber pdfPath highlightedPdfPath tokens'
        )
        .lean();

    docChunks = rows
        .filter((r) => r.embedding && r.embedding.length > 0)
        .map((r) => ({
            ...r,
            embedding: toFloat32(r.embedding),
            // questionEmbedding is persisted per spec §6 phase-3 carry-over;
            // Tier 1 no longer calls OpenAI at boot. Leave as undefined for
            // overview chunks / QNA chunks lacking a questionText.
            qEmbedding:
                r.questionEmbedding && r.questionEmbedding.length > 0
                    ? toFloat32(r.questionEmbedding)
                    : null,
            contentLower: (r.content || '').toLowerCase(),
        }));

    // Questions-only index for Tier 1 exact-match.
    questionIndex = docChunks.filter(
        (c) =>
            c.docType === 'qna' &&
            c.questionText &&
            c.questionText.trim() &&
            c.qEmbedding
    );

    // BM25 over chunk content.
    bm25 = bm25Factory();
    bm25.defineConfig({
        fldWeights: { body: 1 },
        bm25Params: { k1: 1.2, b: 0.75, k: 1 },
    });
    bm25.definePrepTasks([prepForBm25]);
    for (const c of docChunks) {
        bm25.addDoc({ body: c.content }, c.chunkId);
    }
    bm25.consolidate();

    loaded = true;
    loadedAt = new Date();
    return {
        chunks: docChunks.length,
        questions: questionIndex.length,
        loadedAt,
    };
}

function isLoaded() {
    return loaded;
}

function getStats() {
    return { chunks: docChunks.length, questions: questionIndex.length, loadedAt };
}

// ── Embedding ───────────────────────────────────────────────────────────
async function embedQuery(query) {
    const client = getOpenAI();
    const res = await client.embeddings.create({
        model: config.embeddingModel,
        input: query,
    });
    return toFloat32(res.data[0].embedding);
}

// ── mapFreeTextToSlug (spec Phase 3 C) ──────────────────────────────────
// Student.program is free-text ("MBA Swiss School Rome", "Doctorate Business").
// Score every slug by how many of its aliases appear as substrings in the
// normalized text. Returns the winner if unambiguous (strictly > runner-up),
// otherwise null. Keeps the matcher intentionally loose — ambiguous records
// fall through to the alias matcher over the query text.
function mapFreeTextToSlug(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.toLowerCase();
    const scores = {};
    for (const [slug, aliases] of Object.entries(PROGRAM_ALIASES)) {
        let hits = 0;
        for (const a of aliases) {
            if (t.includes(a.toLowerCase())) hits += 1;
        }
        if (hits > 0) scores[slug] = hits;
    }
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) return null;
    if (ranked.length === 1) return ranked[0][0];
    if (ranked[0][1] > ranked[1][1]) return ranked[0][0];
    return null;
}

// ── pickProgramFilter: single entry-point returning both slug + source tag
// Priority: verified lead-context (from studentId / programHint) → alias
// matcher over query text → null. The source tag is logged in DocsChatLog
// so admins can see why a given filter fired (or didn't).
function pickProgramFilter(query, leadContext) {
    if (leadContext && leadContext.program && PROGRAMS[leadContext.program]) {
        // Distinguish: free-text mapped from Student.program vs explicit hint.
        const via = leadContext.rawProgram ? 'free_text_map' : 'lead_context';
        return { slug: leadContext.program, via };
    }
    const aliasHit = detectProgram(query, null, null);
    if (aliasHit) return { slug: aliasHit, via: 'alias_match' };
    return { slug: null, via: null };
}

// ── detectProgram (spec §6c) ────────────────────────────────────────────
function detectProgram(query, user, leadContext) {
    if (leadContext && leadContext.program && PROGRAMS[leadContext.program]) {
        return leadContext.program;
    }
    const q = (query || '').toLowerCase();
    const hits = [];
    for (const [slug, aliases] of Object.entries(PROGRAM_ALIASES)) {
        for (const a of aliases) {
            // word-boundary match where alias is plain words; substring match
            // for multi-word aliases containing spaces/dashes.
            const alias = a.toLowerCase();
            if (/[\s-]/.test(alias)) {
                if (q.includes(alias)) {
                    hits.push(slug);
                    break;
                }
            } else {
                const re = new RegExp(
                    '\\b' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
                    'i'
                );
                if (re.test(q)) {
                    hits.push(slug);
                    break;
                }
            }
        }
    }
    const unique = [...new Set(hits)];
    if (unique.length === 1) return unique[0];
    return null; // ambiguous or no match — search all
}

// ── retrieve (spec §6d) ─────────────────────────────────────────────────
function sourceFromChunk(chunk, score, retrievalMethod) {
    return {
        chunkId: chunk.chunkId,
        program: chunk.program,
        programDisplayName: chunk.programDisplayName,
        docType: chunk.docType,
        section: chunk.section,
        sourceFile: chunk.sourceFile,
        pageNumber: chunk.pageNumber,
        pdfUrl: `${chunk.pdfPath}#page=${chunk.pageNumber}`,
        // Phase 5: pre-highlighted single-page PDF for the inline preview
        // panel. May be null on chunks ingested before the highlight
        // script ran; the client falls back to pdfUrl in that case.
        highlightedPdfPath: chunk.highlightedPdfPath || null,
        score: Number(score.toFixed(4)),
        retrievalMethod,
    };
}

async function retrieve(query, opts = {}) {
    if (!loaded) throw new Error('Docs RAG: index not loaded yet');
    const { programFilter = null, topK = config.topK } = opts;

    const qEmb = await embedQuery(query);

    // ── TIER 1: exact-match on question embeddings ─────────────────────
    let bestQ = null;
    let bestQScore = -Infinity;
    for (const q of questionIndex) {
        if (programFilter && q.program !== programFilter) continue;
        if (!q.qEmbedding) continue;
        const s = dot(qEmb, q.qEmbedding);
        if (s > bestQScore) {
            bestQScore = s;
            bestQ = q;
        }
    }
    if (bestQ && bestQScore >= config.exactMatchThreshold) {
        return {
            tier: 1,
            exactMatch: true,
            chunks: [bestQ],
            sources: [sourceFromChunk(bestQ, bestQScore, 'exact-match')],
            topScore: bestQScore,
        };
    }

    // ── TIER 2: hybrid dense + BM25 with RRF fusion ────────────────────
    const candidates = programFilter
        ? docChunks.filter((c) => c.program === programFilter)
        : docChunks;

    if (candidates.length === 0) {
        return { tier: 3, refuse: true, chunks: [], sources: [], topScore: 0 };
    }

    // Dense
    const dense = candidates
        .map((c) => ({ chunk: c, score: dot(qEmb, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

    // BM25 — search returns [[chunkId, score], ...]. Filter by programFilter.
    const bmRaw = bm25.search(query) || [];
    const byId = new Map(docChunks.map((c) => [c.chunkId, c]));
    const bm = bmRaw
        .map(([id, score]) => ({ chunk: byId.get(id), score }))
        .filter((r) => r.chunk && (!programFilter || r.chunk.program === programFilter))
        .slice(0, 20);

    // RRF fusion (k = 60)
    const K = 60;
    const fused = new Map(); // chunkId → { chunk, rrf, methods }
    dense.forEach((r, rank) => {
        const id = r.chunk.chunkId;
        const entry = fused.get(id) || {
            chunk: r.chunk,
            denseScore: r.score,
            bmScore: 0,
            rrf: 0,
            methods: new Set(),
        };
        entry.rrf += 1 / (K + rank);
        entry.methods.add('dense');
        entry.denseScore = r.score;
        fused.set(id, entry);
    });
    bm.forEach((r, rank) => {
        const id = r.chunk.chunkId;
        const entry = fused.get(id) || {
            chunk: r.chunk,
            denseScore: 0,
            bmScore: r.score,
            rrf: 0,
            methods: new Set(),
        };
        entry.rrf += 1 / (K + rank);
        entry.methods.add('bm25');
        entry.bmScore = r.score;
        fused.set(id, entry);
    });

    const top = [...fused.values()]
        .sort((a, b) => b.rrf - a.rrf)
        .slice(0, topK);

    // Refusal threshold: max dense cosine in the top slice. If nothing in the
    // top was retrieved via dense, use the dense score we computed anyway.
    const topDenseScore = top.length ? Math.max(...top.map((t) => t.denseScore)) : 0;
    if (topDenseScore < config.minScore) {
        return {
            tier: 3,
            refuse: true,
            chunks: [],
            sources: [],
            topScore: topDenseScore,
        };
    }

    const chunks = top.map((t) => t.chunk);
    const sources = top.map((t) => {
        let method;
        if (t.methods.has('dense') && t.methods.has('bm25')) method = 'hybrid';
        else if (t.methods.has('dense')) method = 'dense';
        else method = 'bm25';
        return sourceFromChunk(t.chunk, t.denseScore, method);
    });

    return { tier: 2, chunks, sources, topScore: topDenseScore };
}

// ── Prompt building (spec §6f) ──────────────────────────────────────────
const SYSTEM_PROMPT = `You are the documents assistant for Learners Education sales consultants. Answer strictly from the provided document chunks about our 8 education programs. If the chunks do not contain enough information to answer confidently, respond exactly: "I don't have that in the program documents. Please check with your team lead."

Rules:
- Never invent accreditation bodies, credit counts, fees, dates, or partner institutions.
- When citing, reference the specific program and section (e.g. "Per the SSM MBA QNA, Section 1").
- Keep answers concise and consultant-friendly (3–6 sentences unless the query explicitly asks for detail).
- When a question spans multiple programs, clearly delineate what each program says.
- Do not use bullet points unless the source chunk itself is a list.`;

function buildUserMessage(query, chunks) {
    const blocks = chunks
        .map((c, i) => {
            const header = `[Chunk ${i + 1} — Program: ${c.programDisplayName}, DocType: ${c.docType}, Section: ${c.section}, Page: ${c.pageNumber}]`;
            return `${header}\n${c.content}`;
        })
        .join('\n\n');
    return `CONTEXT CHUNKS:\n${blocks}\n\nQUESTION: ${query}\n\nRespond with a direct answer grounded in the chunks above. Do not include citation markers like [1] inline — the UI will render source chips separately.`;
}

// ── SSE helpers ─────────────────────────────────────────────────────────
const sse = (res, event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const REFUSAL =
    "I don't have that in the program documents. Please check with your team lead.";

// Persist one analytical row per request (including cache hits). Returns
// the new log _id as a string so the caller can ship it back to the client
// in the SSE `done` event — used for the thumbs-up/down feedback flow.
// Never throws: logging must never break the user-facing response.
async function writeLog(fields) {
    try {
        const doc = await DocsChatLog.create(fields);
        return String(doc._id);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[docsRag] log write failed: ${err.message}`);
        return null;
    }
}

// ── Generation: Groq primary, OpenAI fallback ───────────────────────────
async function* streamGroq(messages) {
    const client = getGroq();
    const stream = await client.chat.completions.create({
        model: config.groqModel,
        messages,
        stream: true,
        temperature: 0.1,
        max_tokens: 500,
    });
    for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content || '';
        if (token) yield token;
    }
}

async function* streamOpenAI(messages) {
    const client = getOpenAI();
    const stream = await client.chat.completions.create({
        model: config.chatModel,
        messages,
        stream: true,
        temperature: 0.1,
        max_tokens: 500,
    });
    for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content || '';
        if (token) yield token;
    }
}

// Pre-flight Groq: try to get the first token. If the SDK throws during
// setup (auth/network/rate-limit), fall back to OpenAI before any bytes
// have gone to the client. Once the first token arrives, we stay with the
// chosen provider for the rest of the stream.
async function chooseGenerator(messages) {
    if (config.llmPrimary === 'openai') {
        return { gen: streamOpenAI(messages), provider: 'openai' };
    }
    try {
        const gen = streamGroq(messages);
        // Peek at the first chunk. If iterator resolves (even with empty
        // token), Groq is live; otherwise we'll fall through.
        const iter = gen[Symbol.asyncIterator]();
        const first = await iter.next();
        // Re-wrap so the caller sees the first token again.
        const wrapped = (async function* () {
            if (!first.done && first.value) yield first.value;
            while (true) {
                const next = await iter.next();
                if (next.done) return;
                if (next.value) yield next.value;
            }
        })();
        return { gen: wrapped, provider: 'groq' };
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[docsRag] Groq failed pre-flight (${err.message}); falling back to OpenAI.`);
        return { gen: streamOpenAI(messages), provider: config.llmFallback || 'openai' };
    }
}

// ── answer (spec §6e) ───────────────────────────────────────────────────
async function answer(query, { user, leadContext = null, res }) {
    const t0 = Date.now();
    const { slug: programFilter, via: detectedVia } = pickProgramFilter(
        query,
        leadContext
    );
    const normalizedQuery = normalize(query);
    const cacheKey = cacheKeyFor(query, programFilter);

    const baseLog = {
        userId: user?._id,
        userOrg: user?.organization,
        query,
        normalizedQuery,
        programFilter,
        detectedVia,
    };

    // ── Cache lookup ────────────────────────────────────────────────────
    let cached = null;
    try {
        cached = await QueryCache.findOne({ cacheKey }).lean();
    } catch (_) {
        /* cache lookup failures shouldn't block */
    }

    if (cached) {
        sse(res, 'delta', { text: cached.answer });
        const logId = await writeLog({
            ...baseLog,
            tier: cached.tier,
            exactMatch: cached.tier === 1,
            cached: true,
            topScore: null,
            retrievalMethods: (cached.sources || [])
                .map((s) => s.retrievalMethod)
                .filter(Boolean),
            sourceChunkIds: (cached.sources || []).map((s) => s.chunkId),
            provider: null,
            latencyMs: Date.now() - t0,
            refusalReason: null,
        });
        sse(res, 'done', {
            sources: cached.sources || [],
            exactMatch: cached.tier === 1,
            programFilter,
            tier: cached.tier,
            cached: true,
            logId,
            latencyMs: Date.now() - t0,
        });
        res.end();
        return;
    }

    const result = await retrieve(query, { programFilter });

    // ── Tier 3 — refusal ───────────────────────────────────────────────
    if (result.refuse) {
        sse(res, 'delta', { text: REFUSAL });
        const logId = await writeLog({
            ...baseLog,
            tier: 3,
            exactMatch: false,
            cached: false,
            topScore: result.topScore || 0,
            retrievalMethods: [],
            sourceChunkIds: [],
            provider: null,
            latencyMs: Date.now() - t0,
            refusalReason: 'low_score',
        });
        sse(res, 'done', {
            sources: [],
            exactMatch: false,
            programFilter,
            tier: 3,
            cached: false,
            logId,
            latencyMs: Date.now() - t0,
        });
        res.end();
        return;
    }

    // ── Tier 1 — stream curated answer verbatim ────────────────────────
    if (result.tier === 1) {
        const chunk = result.chunks[0];
        const answerText = `From your QNA guide:\n\n${chunk.content}`;
        sse(res, 'delta', { text: answerText });

        const logId = await writeLog({
            ...baseLog,
            tier: 1,
            exactMatch: true,
            cached: false,
            topScore: result.topScore,
            retrievalMethods: (result.sources || [])
                .map((s) => s.retrievalMethod)
                .filter(Boolean),
            sourceChunkIds: (result.sources || []).map((s) => s.chunkId),
            provider: null,
            latencyMs: Date.now() - t0,
            refusalReason: null,
        });
        sse(res, 'done', {
            sources: result.sources,
            exactMatch: true,
            programFilter,
            tier: 1,
            cached: false,
            logId,
            latencyMs: Date.now() - t0,
        });
        res.end();

        // Fire-and-forget cache write
        QueryCache.create({
            cacheKey,
            query,
            programFilter,
            answer: answerText,
            sources: result.sources,
            tier: 1,
        }).catch(() => {});
        return;
    }

    // ── Tier 2 — RAG generation ────────────────────────────────────────
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(query, result.chunks) },
    ];

    let provider = 'groq';
    let aggregated = '';
    try {
        const { gen, provider: p } = await chooseGenerator(messages);
        provider = p;
        for await (const token of gen) {
            aggregated += token;
            sse(res, 'delta', { text: token });
        }
    } catch (err) {
        // Still log the failure so admins see a pattern if Groq+OpenAI
        // both fall over. No done event — the UI shows the error banner.
        await writeLog({
            ...baseLog,
            tier: 2,
            exactMatch: false,
            cached: false,
            topScore: result.topScore,
            retrievalMethods: (result.sources || []).map((s) => s.retrievalMethod),
            sourceChunkIds: (result.sources || []).map((s) => s.chunkId),
            provider,
            latencyMs: Date.now() - t0,
            refusalReason: 'generation_error',
        });
        sse(res, 'error', { message: err.message || 'Generation failed' });
        res.end();
        return;
    }

    const logId = await writeLog({
        ...baseLog,
        tier: 2,
        exactMatch: false,
        cached: false,
        topScore: result.topScore,
        retrievalMethods: (result.sources || [])
            .map((s) => s.retrievalMethod)
            .filter(Boolean),
        sourceChunkIds: (result.sources || []).map((s) => s.chunkId),
        provider,
        latencyMs: Date.now() - t0,
        refusalReason: null,
    });

    sse(res, 'done', {
        sources: result.sources,
        exactMatch: false,
        programFilter,
        tier: 2,
        provider,
        cached: false,
        logId,
        latencyMs: Date.now() - t0,
    });
    res.end();

    // Cache Tier 2 answers
    if (aggregated.trim()) {
        QueryCache.create({
            cacheKey,
            query,
            programFilter,
            answer: aggregated,
            sources: result.sources,
            tier: 2,
        }).catch(() => {});
    }
}

module.exports = {
    loadChunks,
    isLoaded,
    getStats,
    embedQuery,
    detectProgram,
    mapFreeTextToSlug,
    retrieve,
    answer,
    // Constants exposed for routes / tests
    PROGRAM_ALIASES,
    REFUSAL,
};
