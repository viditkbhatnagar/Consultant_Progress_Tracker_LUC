// Docs RAG runtime config — reads env with spec-aligned defaults (§13).
// Parsed once at require-time; env changes require a process restart.

const toBool = (v, fallback) => {
    if (v == null) return fallback;
    return String(v).toLowerCase() === 'true';
};
const toInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};
const toFloat = (v, fallback) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
};

module.exports = {
    enabled: toBool(process.env.DOCS_RAG_ENABLED, true),
    topK: toInt(process.env.DOCS_RAG_TOPK, 5),
    minScore: toFloat(process.env.DOCS_RAG_MIN_SCORE, 0.35),
    exactMatchThreshold: toFloat(
        process.env.DOCS_RAG_EXACT_MATCH_THRESHOLD,
        0.82
    ),
    cacheTtl: toInt(process.env.DOCS_RAG_CACHE_TTL_SECONDS, 86400),
    embeddingModel:
        process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    groqModel: process.env.GROQ_CHAT_MODEL || 'llama-3.3-70b-versatile',
    llmPrimary: process.env.LLM_PRIMARY || 'groq',
    llmFallback: process.env.LLM_FALLBACK || 'openai',
};
