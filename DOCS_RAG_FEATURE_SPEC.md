# Program Docs RAG Chatbot — Implementation Spec

**Audience:** Claude Code, building inside the `teamProgressTracker` repo.
**Author context:** Spec derived from sales consultant workflow analysis. PDFs live outside the repo at `/sessions/.../mnt/PPT's-QNA/` in the source session — they must be copied into this repo as part of this task (see "PDF hosting" below).

---

## 1. Feature summary

Sales consultants in the tracker currently have a chatbot that only answers queries about tracker data (meetings, commitments, students). Extend it to also answer questions about **Learners Education program documents** — 8 programs, each with a sales/program-overview PDF + a counselor objection-handling QNA PDF. 16 PDFs total.

Consultants must be able to ask things like *"What accreditations does the Knights MBA have?"* or *"How does SSM MBA compare to AACSB-only schools?"* and get accurate, doc-grounded answers without opening the PDFs — while still being shown a source link to the exact page if they want to verify.

**Non-goals:** do NOT build a general-purpose RAG that ingests arbitrary uploads, do NOT add authentication for end consumers outside the tracker, do NOT add Skillhub program docs (IGCSE/CBSE) — this feature is LUC-only (see §10 scope).

---

## 2. Architecture — decisions and rationale

| Decision | Choice | Why |
|---|---|---|
| Where to run | **Inside existing Node/Express server** (`server/`), no separate Python service | No extra Render service, no network hop, reuses existing `OPENAI_API_KEY` and JWT auth. The tracker is a $25 Render plan — adding another service is both costly and slower. |
| Vector store | **In-memory array loaded at server boot**, persisted to MongoDB for durability | Corpus is ~200 chunks × 1536-dim float32 ≈ 1.2 MB RAM. Brute-force cosine in JS is <1 ms. Atlas Vector Search requires M10+ ($57/mo) AND adds 30–80 ms query latency — it's both slower AND more expensive than RAM for this corpus size. |
| Embeddings | **OpenAI `text-embedding-3-small`** (1536-dim, $0.02/M tokens) | Cheap, fast, already provisioned. Good enough for this corpus. |
| Generation | **Groq `llama-3.3-70b-versatile`** streamed, temperature 0.1, with GPT-4o-mini fallback | Groq TTFT is 80-200ms and stream speed is 500+ tok/sec vs OpenAI's 100-150 tok/sec. Needed to hit sub-900ms total on generated answers. Groq has a free tier; paid is ~$0.60/M output tokens, same order of magnitude as GPT-4o-mini. |
| Caching | **MongoDB `QueryCache` collection** with 24h TTL | Hash of (normalized query + programFilter) → full answer. Repeat queries return in <50ms. |
| Chunking | **Structure-aware parser** using QNA section markers — NOT generic sliding window | The QNA files have explicit `SECTION \d:` and `Q\d+:` markers. Each Q&A is an author-curated, self-contained chunk. Exploit this. |
| Retrieval | **Dense + BM25 hybrid**, RRF fusion, then top-5; NO cross-encoder reranker | 200-chunk corpus is too small to benefit from reranking latency. BM25 is essential for acronym queries ("Ofqual", "MOFA UAE", "DEAC"). |
| Grounding | **Strict** — refuse if chunks don't support the answer | Consultants will quote the bot to prospects; hallucinations about accreditations/fees are unacceptable. |
| Citations | **Full PDF link with `#page=N` deep-link** | Consultant answer decision was "Full source doc link (opens the PDF)". Page anchoring is critical. |
| Program filter | **Infer from CRM context first**, keyword classifier fallback, LLM classifier last resort | When a consultant is on a Lead/Student/Commitment record with a program field, pre-filter by that program. Cuts candidate pool from ~200 to ~15–25 chunks, improves precision, speeds retrieval. |

---

## 3. Document chunking strategy (most important section — read carefully)

The QNA PDFs are already **pre-chunked semantically** by the authors — every QNA file follows the identical template:

```
SECTION 1: ACCREDITATION & RECOGNITION QUESTIONS
Q1: "..."
COMPLETE ANSWER:
...answer text...

Q2: "..."
COMPLETE ANSWER:
...answer text...

SECTION 2: PRODUCT-RELATED QUESTIONS
Q7: "..."
...

SECTION 3: SCENARIO-BASED QUESTIONS & ANSWERS
...

SECTION 4: CLOSING FRAMEWORK
...

SECTION 5: QUICK REFERENCE
...
```

### 3a. Parsing rules per doc type

**QNA files** (longer, ~20–55 pages, one per program):
- Extract text via `pdf-parse`.
- **CRITICAL — dedupe consecutive duplicate lines FIRST.** Measured on `knights-mba/Knights-MBA.pdf`: 19% of lines appear twice because of a text-layer rendering quirk in the source PDFs. Before any chunking, run:
  ```javascript
  const dedupedLines = rawText.split('\n').filter((line, i, arr) =>
    i === 0 || line.trim() === '' || line !== arr[i-1]
  );
  const text = dedupedLines.join('\n');
  ```
- Split on regex `/(?=(?:SECTION\s+\d+[:.]|Q\d+[:.]|SCENARIO\s+\d+[:.]))/m` — this yields one chunk per Section header, per Q&A, AND per scenario (don't keep Section 3 as one mega-chunk — scenarios are distinct from each other).
- Each chunk runs from its marker until the next marker. The question/scenario text appears at the top of the chunk followed by its complete answer body.
- Sections 4 (closing framework) and 5 (quick reference) usually have their own internal headings — split on those where present; otherwise keep the full section as one chunk (cap at ~2000 tokens, split on paragraph boundaries if larger).
- Extract `questionText` verbatim into metadata when chunk is a Q&A or scenario.

**Measured chunk sizes with this strategy** (on `Knights-MBA.pdf`, the largest QNA): 19 chunks produced, median 3,695 chars (~923 tokens), max 12,826 chars (~3,206 tokens), min 101 chars. All well within `text-embedding-3-small`'s 8,191-token limit.

**Overview files** (shorter, ~10–17 pages, more graphical):
- Extract text via `pdf-parse`, retain page numbers.
- Use `r.pages[i].extract_text()` per page — each page usually represents one logical section ("Program Structure", "Eligibility", "Accreditations", etc.).
- Start with 1 chunk per page as baseline. If a page has a clear H1-style heading (ALL CAPS line or title case followed by body), use that as the `section` metadata.

### 3b. Chunk target size

- Sweet spot: 200–800 tokens per chunk. Each QNA Q&A typically lands in this range naturally.
- If a chunk exceeds ~1200 tokens, split on paragraph boundaries.
- Never go below ~100 tokens — merge small chunks with the next one.

### 3c. Metadata schema (attach to every chunk)

```javascript
{
  chunkId: String,          // stable: `${program}_${docType}_${sectionSlug}_${ord}`
  program: String,          // enum below
  programDisplayName: String, // "Swiss School of Management MBA"
  docType: String,          // 'overview' | 'qna'
  section: String,          // 'accreditation' | 'product' | 'scenario' | 'closing' | 'quick_ref' | 'overview'
  questionText: String,     // only for QNA Q-chunks: the verbatim Q text
  content: String,          // the chunk body (plus the Q: line for QNA chunks)
  embedding: [Number],      // 1536 floats
  sourceFile: String,       // e.g. 'MBA-SSM.pdf'
  pageNumber: Number,       // 1-indexed
  pdfPath: String,          // web-relative: '/program-docs/ssm-mba/MBA-SSM.pdf'
  contentHash: String,      // sha1 of content — for idempotent re-ingest
  tokens: Number            // tiktoken count, for debugging
}
```

### 3d. Program enum (8 values, match folder names)

```javascript
const PROGRAMS = {
  'ssm-dba': 'Swiss School of Management DBA',
  'ioscm-l7': 'IOSCM Level 7 Supply Chain Management',
  'knights-bsc': 'Knights College BSc Business Management',
  'knights-mba': 'Knights College Work-Based MBA',
  'malaysia-mba': 'Malaysia University MBA (MUST)',
  'othm-l5': 'OTHM Level 5 Extended Diploma',
  'ssm-bba': 'Swiss School of Management BBA',
  'ssm-mba': 'Swiss School of Management MBA'
};
```

### 3e. Program alias map (for classifier)

Each program should have an alias list so the classifier can match common phrasings:

```javascript
const PROGRAM_ALIASES = {
  'ssm-dba': ['dba', 'doctorate', 'ph.d', 'doctor of business', 'ssm dba'],
  'ioscm-l7': ['ioscm', 'level 7 supply chain', 'supply chain management l7', 'ofqual supply chain'],
  'knights-bsc': ['knights bsc', 'bsc business management', 'bachelor science knights', 'cmbs bsc'],
  'knights-mba': ['knights mba', 'work-based mba', 'work based mba', 'cmbs mba'],
  'malaysia-mba': ['malaysia', 'must', 'malaysian mba', 'malaysia university'],
  'othm-l5': ['othm', 'level 5', 'l5 diploma', 'extended diploma'],
  'ssm-bba': ['bba', 'bachelor business administration', 'ssm bba'],
  'ssm-mba': ['ssm mba', 'swiss mba', 'swiss school mba']
};
```

---

## 4. Data model

New file: `server/models/DocChunk.js` — Mongoose model matching §3c schema. Notes:
- `embedding` field: `[Number]` — do NOT add a Mongoose index on it (Atlas Vector Search index would need M10+; we're using in-memory instead).
- Index on `{ program: 1, docType: 1 }` for ingest queries.
- Unique index on `chunkId`.
- Add the `organization: 'luc'` field (matching the multi-tenancy convention in CLAUDE.md §Multi-tenancy) — all chunks are LUC-scope; this future-proofs in case Skillhub gets its own program docs later.

---

## 5. Ingestion script

New file: `server/scripts/ingestProgramDocs.js`

### 5a. Behavior
1. Accepts `--force` flag to wipe & reindex from scratch.
2. Walks `client/public/program-docs/<program-slug>/` (see §7 for PDF hosting).
3. For each PDF: parse → chunk per §3 → for each chunk, compute `contentHash`. If hash unchanged from DB, skip. If new/changed, compute embedding and upsert.
4. Batches embedding calls: OpenAI accepts up to 2048 inputs per call, but cap at 100 per batch to keep payloads small.
5. Logs counts: chunks created / updated / skipped / failed.
6. Writes `server/program-docs-manifest.json` — summary of chunks per program/doc for the ops dashboard.

### 5b. Run locally
```bash
cd server && node scripts/ingestProgramDocs.js
cd server && node scripts/ingestProgramDocs.js --force   # wipe and redo
```

### 5c. Run on Render
Add a Render "Job" (not a web service) that runs this script on deploy, OR add an admin-only endpoint `POST /api/docs-chat/admin/reingest` that triggers it. Prefer the endpoint — simpler, no separate Render service.

---

## 6. RAG service

New file: `server/services/docsRagService.js`

### 6a. Public API

```javascript
async function loadChunks()           // called once at server boot, populates in-memory array
async function embedQuery(query)      // returns 1536-dim vector
function detectProgram(query, user, leadContext) // returns program slug | null
async function retrieve(query, {programFilter, topK = 5})
async function answer(query, {user, leadContext, res}) // streams to res
```

### 6b. In-memory index

Module-level:
```javascript
let docChunks = [];           // [{...metadata, embedding: Float32Array}]
let bm25 = null;              // rank_bm25 index over `content`
let questionIndex = [];       // [{chunkId, embedding, questionText}] for QNA Q chunks only
```

At server boot: `DocChunk.find().lean()` → convert `embedding` arrays to `Float32Array` (faster cosine) → populate `docChunks`, build BM25 over `content`, build `questionIndex` from QNA chunks with `questionText`.

### 6c. `detectProgram(query, user, leadContext)` logic

1. If `leadContext.program` is set → return it.
2. Else, run keyword matcher over `PROGRAM_ALIASES` on the query. If exactly one program's alias matches → return it.
3. If ambiguous (multiple programs match) → return `null` (search all; the retriever will handle it).
4. If zero match → return `null` (search all).

**Do NOT spend an LLM call on program detection by default** — the aliases handle 90%+ of cases and an LLM round-trip adds ~300ms. Only if zero-match AND retrieval confidence ends up low, re-ask with an LLM classifier as fallback.

### 6d. Three-tier retrieval logic (latency-optimized)

1. Compute `queryEmbedding = await embedQuery(query)`.

2. **TIER 1 — Exact-match shortcut (target: 80% of queries, ~250ms total):**
   - Compare `queryEmbedding` to every entry in `questionIndex` (the QNA Q embeddings only, ~80 entries).
   - If top match ≥ **0.82** cosine AND (no programFilter OR match's program == programFilter) AND chunk is a QNA Q-chunk:
     - Return `{tier: 1, chunks: [matched], exactMatch: true}`.
     - The caller skips LLM generation entirely and returns the matched chunk's curated answer verbatim. This is safe because the curated answers were author-written specifically to answer these questions.

3. **TIER 2 — Retrieval-augmented generation (novel queries, ~700-900ms total with Groq):**
   - Filter `docChunks` by `programFilter` (if set) → `candidates`.
   - **Dense search:** cosine similarity, top 20.
   - **BM25 search:** top 20 from `bm25` index over `content`.
   - **RRF fusion** (k=60): `score = 1/(60 + rank_dense) + 1/(60 + rank_bm25)`. Take top 5.
   - If top score < **0.35** cosine: return `{tier: 3, chunks: [], refuse: true}` — the caller returns the canned refusal without an LLM call.
   - Otherwise return `{tier: 2, chunks: [top5], retrievalMethods: [...]}` for generation.

4. Tag each chunk with its retrieval method: `'dense' | 'bm25' | 'hybrid'` (mirror technova-rag's convention).

### 6d-bis. Why Tier 1 matters for accuracy, not just speed

The curated Q&A answers in the QNA PDFs were written by your sales team specifically to handle counselor objections — they're the authoritative, pre-approved wording. Tier 1 returns those verbatim rather than re-synthesizing, which means:
- Zero hallucination risk (the bot is quoting vetted copy)
- Zero LLM cost
- <250ms latency
- Consultants see the EXACT wording they're trained on

This is the single biggest accuracy + latency win in the design. Push Tier 1 coverage as high as possible by tuning the threshold (start at 0.82, sample-test, adjust).

### 6e. `answer(query, {user, leadContext, res})` logic

1. `programFilter = detectProgram(...)`.
2. **Cache check:** `cacheKey = sha1(normalize(query) + '|' + (programFilter||''))`. `QueryCache.findOne({cacheKey})` with TTL index (24h). If hit and not expired, stream cached answer → ~50ms total. Done.
3. `result = await retrieve(query, {programFilter})`.
4. **Tier 1 path:** stream the matched chunk's answer verbatim with a leading "From your QNA guide:" label + source. No LLM call. Cache the result. Target: ~250ms total.
5. **Tier 3 refusal:** if `result.refuse`, return `"I don't have that in the program documents. Please check with your team lead or refer directly to [program name]."`. Don't cache refusals. Target: ~200ms.
6. **Tier 2 path (Groq with OpenAI fallback):**
   - Build the prompt (§6f).
   - Try Groq: `groq.chat.completions.create({model: 'llama-3.3-70b-versatile', stream: true, temperature: 0.1, max_tokens: 500, ...})`.
   - On Groq error (rate limit, network, any 4xx/5xx): fall back to `openai.chat.completions.create({model: 'gpt-4o-mini', ...})`.
   - Pipe tokens to `res`. On completion, write to cache, then append a JSON source block.
   - Target: ~700-900ms full answer on Groq, ~2s on OpenAI fallback.

### 6e-bis. HTTP keepalive for both APIs

Both OpenAI and Groq clients need persistent connections to avoid TLS handshake on every request. In the service module:

```javascript
const https = require('https');
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// OpenAI
const openai = new OpenAI({ apiKey: ..., httpAgent: keepAliveAgent });
// Groq
const groq = new Groq({ apiKey: ..., httpAgent: keepAliveAgent });
```

Saves 100-200ms on every call after the first.

### 6e-tris. `QueryCache` model

New file: `server/models/QueryCache.js`

```javascript
{
  cacheKey: String,       // sha1(normalize(query) + '|' + programFilter)
  query: String,          // original query (for debugging)
  programFilter: String,  // for debugging
  answer: String,         // full text of the cached answer
  sources: [Object],      // the sources array that went with it
  tier: Number,           // 1 | 2 — don't cache tier 3 refusals
  createdAt: { type: Date, default: Date.now, expires: 86400 }  // 24h TTL
}
```

Mongoose TTL index handles expiration automatically.

Query normalization: lowercase, trim, collapse whitespace, strip trailing punctuation. This means "what accreditations does the DBA have?" and "What accreditations does the DBA have" cache to the same key.

### 6f. Prompt template

```
SYSTEM:
You are the documents assistant for Learners Education sales consultants. Answer strictly from the provided document chunks about our 8 education programs. If the chunks do not contain enough information to answer confidently, respond exactly: "I don't have that in the program documents. Please check with your team lead."

Rules:
- Never invent accreditation bodies, credit counts, fees, dates, or partner institutions.
- When citing, reference the specific program and section (e.g. "Per the SSM MBA QNA, Section 1").
- Keep answers concise and consultant-friendly (3–6 sentences unless the query explicitly asks for detail).
- When a question spans multiple programs, clearly delineate what each program says.
- Do not use bullet points unless the source chunk itself is a list.

USER:
CONTEXT CHUNKS:
[Chunk 1 — Program: {{programDisplayName}}, DocType: {{docType}}, Section: {{section}}, Page: {{pageNumber}}]
{{content}}

[Chunk 2 — ...]
...

QUESTION: {{userQuery}}

Respond with a direct answer grounded in the chunks above. Do not include citation markers like [1] inline — the UI will render source chips separately.
```

### 6g. Source format returned to client

```json
{
  "answer": "...",
  "sources": [
    {
      "chunkId": "ssm-mba_qna_accreditation_q1",
      "program": "ssm-mba",
      "programDisplayName": "Swiss School of Management MBA",
      "docType": "qna",
      "section": "accreditation",
      "sourceFile": "MBA-SSM.pdf",
      "pageNumber": 3,
      "pdfUrl": "/program-docs/ssm-mba/MBA-SSM.pdf#page=3",
      "score": 0.83,
      "retrievalMethod": "hybrid"
    }
  ],
  "exactMatch": false,
  "programFilter": "ssm-mba"
}
```

---

## 7. PDF hosting

**Status: DONE.** The 16 PDFs have already been placed at `client/public/program-docs/<slug>/` with slugified folder names matching the §3d enum. Do NOT re-copy. The old `PPT's-QNA/` folder at the repo root is now redundant — delete it as part of cleanup (it's not referenced by any code).

Final layout (verified):

```
client/public/program-docs/
├── ssm-dba/
│   ├── Doctorate-of-Business-Administration.pdf
│   └── DBA.pdf
├── ioscm-l7/
│   ├── IOSCM-Level-7-Supply-Chain-Management.pdf
│   └── IOSCM-QNA.pdf
├── knights-bsc/
│   ├── Knights-College-BSc-Business-Management.pdf
│   └── Knights-BSC.pdf
├── knights-mba/
│   ├── Knights-College-Work-Based-MBA.pdf
│   └── Knights-MBA.pdf
├── malaysia-mba/
│   ├── Malaysia-University-MBA-Program.pdf
│   └── Malaysia-MBA.pdf
├── othm-l5/
│   ├── OTHM-Level-5-Extended-Diploma-Program.pdf
│   └── OTHM-Level-5-Extended-Diploma-Program-QNA.pdf
├── ssm-bba/
│   ├── Swiss-School-of-Management-Bachelor-of-Business-Administration.pdf
│   └── SSM-BBA.pdf
└── ssm-mba/
    ├── Swiss-School-of-Management-MBA-Program.pdf
    └── MBA-SSM.pdf
```

Total size ≈ 20 MB. Acceptable in the repo. After `npm run build`, they're served by Express static middleware in production at `/program-docs/...`. Locally (dev), React's dev server serves them from `client/public`. Browsers handle `#page=N` natively for PDFs.

**Security note:** these PDFs contain internal sales/objection-handling material. They should not be public. Gate the static route:

- Add middleware in `server.js` that protects `/program-docs/*` with the same `protect` JWT check used by `/api/*`. Something like:
  ```javascript
  app.use('/program-docs', protect, express.static(path.join(clientBuildPath, 'program-docs')));
  ```
- In the React frontend, when the user clicks a source chip, open the PDF in a new tab with the JWT appended as a query param (or attach via a blob fetch). Simplest: the source-chip click opens a React route like `/pdf-viewer?url=...&page=...` which does an authenticated `fetch`, converts to blob URL, and renders in `<iframe>` or via PDF.js.

---

## 8. Routes

New file: `server/routes/docsChat.js`
- `POST /api/docs-chat` — body `{ query: string, leadId?: string, studentId?: string, programHint?: string }`. Requires `protect`. Returns SSE stream of tokens + final JSON source block. Org-gated to LUC users only (see §10).
- `POST /api/docs-chat/admin/reingest` — admin-only. Triggers `ingestProgramDocs.js`. Returns JSON summary.
- `GET /api/docs-chat/stats` — admin-only. Returns chunk counts per program, embedding freshness, last ingest time.

Register in `server.js` with prefix `/api/docs-chat`. Follow the existing route-ordering pattern in `commitments.js` (specific paths before generic `:id`).

---

## 9. Integration with existing chatbot

The existing tracker chatbot (per CLAUDE.md: `POST /api/ai/analysis` via `aiService.js`) answers tracker data questions. Wire in a router upstream of it.

Modify existing chatbot endpoint (or add a new unified `POST /api/chat`):

1. Classify the query into `tracker` | `docs` | `ambiguous`:
   - Keyword regex over tracker terms: `/meeting|commitment|lead stage|consultant|admission|weekly|this week|team lead|manager|hourly|enrollment|student/i` → tracker.
   - Keyword regex over docs terms: `/accredit|ofqual|mfhea|deac|iacbe|eduqua|dba|mba|bba|othm|knights|ssm|malaysia|must|ioscm|specialization|eligibility|fee|ECTS|level 7|dissertation|viva|career/i` → docs.
   - Check `PROGRAM_ALIASES` — if any matches, strong signal for docs.
   - If both match OR neither matches → `ambiguous`.
2. Route:
   - `tracker` → existing `aiService.analyzeTrackerData(...)`.
   - `docs` → new `docsRagService.answer(...)`.
   - `ambiguous` → run both in parallel, show a split response OR pick based on a cheap `gpt-4o-mini` classifier call (single token `tracker|docs`).
3. Lead context passthrough: if the request includes `leadId` / `studentId`, fetch the record server-side and extract `program` for the docs-RAG program filter. Don't trust a client-provided `programHint` without verifying against the record.

---

## 10. Multi-tenant scope (IMPORTANT)

Per CLAUDE.md, the tracker is multi-tenant: LUC + Skillhub. These program docs are **LUC sales collateral only** — Skillhub sells IGCSE/CBSE tutoring, completely different product.

- The docs-RAG endpoints must reject requests from `skillhub` organization users with 403.
- In the chatbot router, if `req.user.organization !== 'luc'`, skip the docs router entirely — Skillhub users only see the tracker chatbot.
- `DocChunk` documents all carry `organization: 'luc'` (future-proofing).

---

## 11. Frontend changes

In `client/src/`:
- Chat UI component (wherever the existing chatbot lives — likely inside `AdminDashboard` / `TeamLeadDashboard`):
  - Parse SSE stream as before.
  - After answer completes, render a source strip below the answer — small chips per source like `SSM MBA · QNA · p.3`, click opens PDF viewer at that page.
- New `PdfViewer.js` page (authenticated) that fetches the PDF blob with the JWT and embeds it with `#page=N`.
- Add the lead-context passthrough: in the chatbot input component, if the user is viewing a specific Lead/Student/Consultant detail page, auto-pass that entity's ID to `/api/docs-chat`.

---

## 12. Dependencies to add to `server/package.json`

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "tiktoken": "^1.0.15",                    // token counting for chunk sizing
    "wink-bm25-text-search": "^3.1.6",        // lightweight JS BM25 — or rank-bm25 equivalent
    "groq-sdk": "^0.9.0"                      // NEW: generation LLM (Llama 3.3 70B) for sub-900ms latency
  }
}
```

Already installed (per CLAUDE.md): `openai`, `express`, `mongoose`, JWT stack. Do NOT install `@qdrant/*` or `langchain/community` — not needed.

Add to `server/.env`: `GROQ_API_KEY=gsk_...` (obtain from console.groq.com — free tier is sufficient for dev).

---

## 13. Configuration

Add to `server/.env` (and Render env vars):
```
DOCS_RAG_ENABLED=true
DOCS_RAG_TOPK=5
DOCS_RAG_MIN_SCORE=0.35
DOCS_RAG_EXACT_MATCH_THRESHOLD=0.82
DOCS_RAG_CACHE_TTL_SECONDS=86400
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
GROQ_API_KEY=gsk_...
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
LLM_PRIMARY=groq
LLM_FALLBACK=openai
```

Read via `server/config/` (new file `docsRagConfig.js`) with sensible defaults.

---

## 14. Latency targets (measure and log)

| Query type | Target | Budget breakdown |
|---|---|---|
| Cache hit (repeat query) | < 100 ms total | Mongo lookup + network |
| Tier 1 exact-match | < 300 ms total | embedding 80-150ms + cosine <1ms + DB lookup 5ms + network 100ms |
| Tier 3 refusal | < 250 ms total | embedding + retrieval only, no LLM |
| Tier 2 via Groq (novel query) | < 900 ms end-to-end | embedding 100ms + retrieval 5ms + Groq TTFT 150ms + streaming 500 tok/s |
| Tier 2 via OpenAI fallback | < 2.5 s end-to-end | embedding 100ms + retrieval 5ms + GPT-4o-mini TTFT 500ms + streaming 100 tok/s |

**Expected distribution** (based on the structured QNA corpus):
- ~90% of queries hit Tier 1 (exact-match) or cache — all under 300ms
- ~8% hit Tier 2 via Groq — under 900ms
- ~2% fall back to OpenAI or hit refusal — under 2.5s worst case

**Perceived latency:** all paths stream the answer to the consultant as tokens arrive, so even the 2.5s worst case starts showing text around ~700ms.

Log these in `server/logs/docs-rag.log` (or to stdout on Render): timestamp, userId, org, query, programFilter, topScore, retrievalMethod, exactMatch, totalMs, generationMs.

---

## 15. Testing checklist (no backend test suite exists — do manual curl tests)

Run all of these from the frontend after building, against seeded data:

1. Exact-match: ask verbatim "What accreditations does the DBA have?" → should be exact-match shortcut, ~150 ms.
2. Paraphrase: "Is the Knights MBA recognized in India?" → should go full LLM pipeline, answer from Knights-MBA QNA Section 1.
3. Acronym: "What's MOFA?" → BM25 should catch it (dense might miss).
4. Cross-program: "Which programs are European-accredited?" → should span SSM, Knights, OTHM chunks.
5. Out-of-scope: "What is the capital of France?" → refusal.
6. Out-of-scope sneaky: "What's the tuition fee for SSM MBA in 2026?" (not in docs) → refusal (docs don't contain fees).
7. Program-filtered: with an active Lead on program=malaysia-mba, ask "Is this AACSB?" → must filter to MUST docs only, not return DBA.
8. Skillhub user: log in as `training@skillhub.com`, call `/api/docs-chat` → expect 403.
9. Citation: every answer must include at least one source chip with valid `#page=N` link that opens the correct page.
10. Latency: observe that exact-match queries return in <250 ms, generated answers <1 s TTFT.

---

## 16. Rollout order (ship in this sequence)

1. **Phase 1 (half a day):** Copy PDFs, write ingestion script, `DocChunk` model, test chunk counts & quality via a simple `console.table` dump. No API yet. Acceptance: ingest produces ~160–220 chunks with clean `questionText` on QNA chunks and sensible `section` tags.
2. **Phase 2 (half a day):** `docsRagService.js` + `/api/docs-chat` route + static `/program-docs/*` hosting with auth. Test via `curl` with JWT. Acceptance: 10 test queries from §15 return correct sources.
3. **Phase 3 (half a day):** chatbot router, frontend integration, source chips, PDF viewer. Acceptance: manual consultant walkthrough works.
4. **Phase 4 (ongoing):** add `/api/docs-chat/stats` admin page, query logging, and the `/admin/reingest` endpoint for content updates.

---

## 17. Known pitfalls to watch for

- **PDF text extraction glitches:** the QNA PDFs have OCR-like artifacts (e.g. `â†'` for arrows, `âœ"` for checkmarks, `â€"` for em-dashes). Sanitize these in the ingestion script: `content.replace(/â†'/g, '→').replace(/âœ"/g, '✓')` etc. Keep a simple mapping table.
- **Line duplication in PDF extraction (confirmed via measurement):** `pdf-parse` returns 19% duplicate consecutive lines on these PDFs due to a text-layer quirk. Dedupe BEFORE chunking (see §3a dedup snippet). Without this step, Q&A chunks will contain every line twice — embeddings still work but it wastes ~20% of context budget when passing chunks to GPT-4o-mini.
- **Page number skew:** pdf-parse reports pages 0-indexed internally. Add 1 before storing.
- **OTHM L5 deck uses different branding:** it references "Learners University College (LUC)" with `inquiry@learnersuae.com` and `learnersuae.com` website — whereas every other deck uses Learners Education and `inquiry@learnerseducation.com`. Don't "normalize" this — keep the source text verbatim; the inconsistency is in the real doc.
- **SSM MBA has two variants:** Regular vs Top-Up. Both share one PDF. The chunker will capture both — make sure the downstream consumer can answer program-variant questions correctly.
- **Existing global axios interceptors:** per CLAUDE.md §Gotchas, multiple axios interceptors stack. When adding the new frontend service, import `API_BASE_URL` from `utils/constants.js` — do NOT set `axios.defaults.baseURL` (that's the `userService.js` anti-pattern to avoid).
- **Route ordering:** register `/admin/*` and `/stats` BEFORE any `/:id` pattern in `docsChat.js` — mirror the pattern warned about in CLAUDE.md §Gotchas for `commitment` routes.

---

## 18. What I decided NOT to do — and why

- **Cross-encoder reranker:** not worth the 300–500 ms latency on a 200-chunk corpus with clean author-defined boundaries. Revisit if retrieval quality disappoints in production.
- **Atlas Vector Search:** requires M10 upgrade ($57/mo) and is slower than in-memory for this corpus size.
- **Qdrant in Docker:** another service on Render → extra cost + network hop.
- **spaCy entity graph / knowledge graph UI** (technova-rag has this): overkill for an internal consultant Q&A tool.
- **Neon Postgres mirror:** MongoDB is already the tracker's DB; use it.
- **Self-correcting retrieve loop** (technova-rag has this): the hybrid BM25+dense + curated chunks makes this unnecessary.
- **Role-based access filtering inside the corpus:** all 16 PDFs are at the same sensitivity level (all LUC sales collateral). No per-document ACL needed — just org-level gating.

---

## 19. Open questions the Claude Code implementer should confirm with the user

1. **Where does the existing tracker chatbot live in the frontend?** Locate it and confirm its integration point before wiring in the router. (Search for `ai/analysis` or `aiService` imports in `client/src/`.)
2. **Should the chatbot router be transparent to users** (single unified chat that auto-routes), or should consultants explicitly select a "Program Docs" tab? User said "they can directly chat to my chatbot in tracker" — implying unified. Confirm before shipping.
3. **PDF auth story:** are we OK gating `/program-docs/*` with JWT middleware and having the frontend fetch+blob the PDF? Or use signed URLs? The JWT middleware approach is simpler and sufficient for an internal tool.
4. **Reingest UX:** should content updates trigger reingest automatically (file watcher) or require an admin button click? Button click is simpler and safer.

---

## Appendix A — Reference: content inventory per program

(Derived from full parse of all 16 PDFs. Claude Code implementer does NOT need to re-read the PDFs — just rely on this summary when writing the aliases and tests.)

**Per program, the QNA covers (same template):**
- Section 1 (Q1–Q6): accreditations, global recognition, equivalence to other credentials, CV/LinkedIn framing, employer acceptance.
- Section 2 (Q7–Q11): program structure, modules/specializations, learning outcomes, assessment methods, capstone/dissertation.
- Section 3: realistic consultant-prospect scenarios with suggested responses.
- Section 4: closing framework and conversion tactics.
- Section 5: quick-reference glossary.

**Key distinguishing facts per program (use these for the alias keywords and test queries):**
- **SSM DBA**: terminal degree, 24 months, DEAC+IACBE+EduQua, "Dr." title, viva voce, Swiss School of Management Rome.
- **IOSCM L7**: 6 months, 121 UK credits, Ofqual+SFEDI, Newcastle UK HQ, positioned above APICS/ASCM.
- **Knights BSc**: 36–45 months, 3 stacked pathways (OTHM L4 → L5 → BSc), 180 ECTS, Malta, formerly CMBS, MFHEA.
- **Knights MBA**: 12 months, 90 ECTS, work-based, 10+ specializations, weekend workshops, WES/CES/ICAS/MOFA-UAE.
- **Malaysia MBA (MUST)**: 16 months, 42 credit hours, MQF L7, AACSB Alliance + EQUIS, MIT 1997 heritage, 5 specs.
- **OTHM L5**: 12–15 months, 240 UK credits, Ofqual, 7 specs, branded as LUC in overview deck.
- **SSM BBA**: 18 months, 180 ECTS, OTHM Diploma + SSM Top-up, 6 specs, DEAC+IACBE+EduQua+Ofqual.
- **SSM MBA**: Regular (15 modules) vs Top-Up (13 modules), 60 ECTS / 120 UK credits, 9 specs, SSM operates from CH+MT+US (US Q1 2026), alumni at Emirates/Etihad/PwC/Kearney.

---

*End of spec.*
