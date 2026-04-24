// Phase 5.3 — LLM fallback for the client-side classifyQuery.
// Called when the keyword/alias rules can't decide between tracker and
// docs. Groq (llama-3.3-70b-versatile) is the primary; OpenAI gpt-4o-
// mini is the fallback if Groq throws. Results are cached in-process
// for an hour so repeat ambiguous queries don't pay the LLM round-trip
// twice.
//
// Never throws — callers get { route: 'tracker' } on any error so a
// classifier outage never breaks the chat drawer.

const https = require('https');
const OpenAI = require('openai');
const Groq = require('groq-sdk');

const SYSTEM_PROMPT = [
    'You are a router for an internal chatbot. Classify the user query as one of two routes:',
    "  'tracker' — internal CRM: admissions, revenue, consultants, meetings, pipeline, attendance, conversion, targets, student database counts (today/this week/this month/etc).",
    "  'docs' — education programs: DBA, MBA, BBA, Knights, SSM, Malaysia MBA, IOSCM, OTHM — accreditations, credits, curriculum, specializations, eligibility, fees, duration, dissertation, recognition.",
    "Reply with ONE word only: tracker or docs.",
].join('\n');

const CACHE = new Map(); // normalized query -> { route, ts }
const TTL_MS = 60 * 60 * 1000; // 1 hour

const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });
let openaiClient;
let groqClient;

const getOpenAI = () => {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not set');
        }
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            httpAgent: keepAliveAgent,
        });
    }
    return openaiClient;
};
const getGroq = () => {
    if (!groqClient) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY not set');
        }
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
            httpAgent: keepAliveAgent,
        });
    }
    return groqClient;
};

const normalise = (q) =>
    (q || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.?!,;:]+$/g, '');

const cacheGet = (key) => {
    const hit = CACHE.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > TTL_MS) {
        CACHE.delete(key);
        return null;
    }
    return hit.route;
};
const cacheSet = (key, route) => {
    CACHE.set(key, { route, ts: Date.now() });
};

const parseReply = (text) => {
    const t = (text || '').trim().toLowerCase();
    if (t.startsWith('docs')) return 'docs';
    // Default to tracker on anything unexpected so we don't accidentally
    // 403 a non-LUC user through the docs route.
    return 'tracker';
};

async function callGroq(query) {
    const client = getGroq();
    const resp = await client.chat.completions.create({
        model: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: query },
        ],
        temperature: 0,
        max_tokens: 3,
    });
    return parseReply(resp.choices?.[0]?.message?.content);
}

async function callOpenAI(query) {
    const client = getOpenAI();
    const resp = await client.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: query },
        ],
        temperature: 0,
        max_tokens: 3,
    });
    return parseReply(resp.choices?.[0]?.message?.content);
}

// Public API. Returns { route, cached }.
async function classify(query) {
    const key = normalise(query);
    if (!key) return { route: 'tracker', cached: false };

    const cached = cacheGet(key);
    if (cached) return { route: cached, cached: true };

    let route = 'tracker';
    try {
        route = await callGroq(query);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[classifier] Groq failed (${err.message}); falling back to OpenAI`);
        try {
            route = await callOpenAI(query);
        } catch (err2) {
            // eslint-disable-next-line no-console
            console.warn(`[classifier] OpenAI also failed (${err2.message}); defaulting to tracker`);
            // Don't cache failures — next call retries.
            return { route: 'tracker', cached: false };
        }
    }
    cacheSet(key, route);
    return { route, cached: false };
}

module.exports = { classify, _cache: CACHE };
