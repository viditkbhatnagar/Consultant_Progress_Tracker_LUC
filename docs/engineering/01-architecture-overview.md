# Architecture Overview

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Purpose

A precise picture of how the Team Progress Tracker is built, deployed, and
scoped per tenant. Audience: engineers (existing + new), security auditors,
DPO. Every claim cites a file or `file:line`.

## High-level

A MERN-stack monorepo:

- **Backend**: Node.js + Express v5 + Mongoose v9 (`server/`), CommonJS.
- **Frontend**: React 19 + MUI v7 + React Router v7 (`client/`), CRA-based.
- **Auth**: JWT bearer tokens, HS256, signed on login (no refresh-token
  rotation in code).
- **Multi-tenant**: a single `organization` enum (`luc`, `skillhub_training`,
  `skillhub_institute`) on every tenant-scoped collection
  ([`server/config/organizations.js`](../../server/config/organizations.js)).
- **AI integration**: Groq (primary, Docs RAG) → OpenAI (fallback +
  embeddings + dashboard analysis).
- **Real-time / streaming**: SSE for chat (`/api/chat/stream`,
  `/api/docs-chat`).

## Hosting topology

| Component | Vendor | Region | Notes |
|---|---|---|---|
| Application runtime | Render | Singapore (`ap-southeast-1`) | Build = `npm run build`, start = `npm start` |
| Primary database | MongoDB Atlas | Ireland (`eu-west-1`) | All 17 collections |
| Primary LLM (Docs RAG) | Groq | US | `llama-3.3-70b-versatile` (default) |
| Fallback LLM + embeddings + analysis | OpenAI | US | `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small` |
| Object storage | None | n/a | No S3/GCS; static PDFs ship inside `client/public/program-docs/` and are served by Express |

A request from a typical UAE user therefore traverses four jurisdictions
(UAE → Singapore → Ireland → optionally US). See
[`docs/legal/01-privacy-policy.md`](../legal/01-privacy-policy.md) for
disclosure language and
[`docs/legal/06-subprocessor-list.md`](../legal/06-subprocessor-list.md) for
the canonical list.

## Repo layout

```
teamProgressTracker/
├── server/                     # Express API (port 5001 by env, defaults 5000)
│   ├── server.js               # Entry — middleware mount order, static-PDF gate, health, prod static serve
│   ├── config/
│   │   ├── db.js               # Mongoose connect; exits process if MONGODB_URI missing
│   │   └── organizations.js    # Tenant enum + helpers (isLuc, isSkillhub)
│   ├── middleware/
│   │   ├── auth.js             # protect / authorize / buildScopeFilter / canAccessDoc / resolveOrganization
│   │   ├── orgGate.js          # Per-org route gate (used for /program-docs, docs-chat)
│   │   ├── docsRagEnabled.js   # Kill-switch for Docs RAG
│   │   ├── exportRateLimit.js  # 5 req/min/user limiter
│   │   └── errorHandler.js     # Mongoose error → JSON envelope mapper
│   ├── routes/                 # 12 route files mounted under /api/*
│   ├── controllers/            # 11 controllers; raw try/catch + next(error)
│   ├── services/
│   │   ├── aiService.js        # OpenAI dashboard analysis
│   │   ├── chatService.js      # Tracker chatbot
│   │   ├── chatTools.js        # Tool definitions exposed to LLM
│   │   ├── classifierService.js# Routes chat queries to tracker vs docs
│   │   ├── docsRagService.js   # Groq+OpenAI Docs RAG; in-memory chunk index
│   │   ├── tenantSnapshot.js   # Aggregated tenant stats for AI prompts
│   │   └── exports/pivots/     # Per-dataset pivot builders + _shared helpers
│   ├── models/                 # 17 Mongoose models (see data-dictionary.md)
│   └── scripts/                # Seed, migrate, ingest, verification scripts
├── client/                     # CRA React 19 app (port 3001)
│   ├── src/
│   │   ├── pages/              # 14 top-level pages
│   │   ├── components/         # Feature-grouped components (commitments/, students/, exports/, chat/, etc.)
│   │   ├── services/           # Axios-based API clients (one per backend resource)
│   │   ├── contexts/           # AuthContext, ThemeContext
│   │   ├── utils/              # Constants, week math, classifyQuery, etc.
│   │   └── theme.js            # MUI theme
│   └── public/program-docs/    # 16 LUC program PDFs (auth-gated, LUC-only)
└── docs/                       # This documentation set
```

## Server entry — middleware order

[`server/server.js`](../../server/server.js) wires up:

1. `helmet({ crossOriginResourcePolicy: 'same-site', contentSecurityPolicy: false })`
   — `server.js:20-25`. CSP is intentionally **off**; see
   [Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).
2. `cors()` with no options — `server.js:28`. **All origins allowed**;
   tracked as a P0 in the gap roadmap.
3. `express.json()` and URL-encoded body parsers — `server.js:31-32`.
4. API routers under `/api/*` — `server.js:35-46`.
5. Auth-gated static PDFs at `/program-docs`,
   `/program-docs-highlighted`, `/program-docs-snippets` — `server.js:52-89`.
   All three sit behind `docsRagEnabled` (kill switch) → `protect` (JWT) →
   `orgGate('luc')`.
6. `GET /api/health` — `server.js:92-97`. Public, no auth.
7. In `NODE_ENV=production`, serve the React build with SPA fallback
   `/^(?!\/api).*/` — `server.js:100-107`.
8. `errorHandler` — must be last — `server.js:110`.

Boot side-effect: `docsRag.loadChunks()` is fired at `server.js:124` and the
result logged to stdout. Failure is **non-fatal** — Docs RAG endpoints return
503 until an admin triggers a force-reingest.

## Multi-tenancy model

Every tenant-scoped document carries an `organization` field with enum
`{ 'luc' | 'skillhub_training' | 'skillhub_institute' }`. The model is
defined in [`server/config/organizations.js`](../../server/config/organizations.js).

Three primitives enforce isolation
([`server/middleware/auth.js`](../../server/middleware/auth.js)):

- **`buildScopeFilter(req)`** — `auth.js:69-86`. Returns a Mongoose filter
  fragment. Admin sees all orgs unless they opt into
  `?organization=<value>`; non-admins are pinned to their own organization.
  Team leads and Skillhub branch logins are additionally pinned to their own
  `teamLead` ownership.
- **`canAccessDoc(user, doc)`** — `auth.js:91-100`. Single-doc check used
  before returning, updating, or deleting a fetched document. Same matrix.
- **`resolveOrganization(req)`** — `auth.js:105-110`. Picks the org for new
  documents. Non-admins get pinned; admin uses the request body or defaults
  to `'luc'`.

Roles (`User.role` enum at [`server/models/User.js:30-34`](../../server/models/User.js)):

| Role | Sees | Can write |
|---|---|---|
| `admin` | All orgs | All orgs (carve-out: `?organization=` switch on read; org defaults to `'luc'` on write) |
| `team_lead` | Own org (LUC), own team only | Own team's data only |
| `manager` | Own org (LUC) on `/student-database` only | Read-only via Export Center, with a cross-org carve-out for the Students dataset (see Access Control Policy) |
| `skillhub` | Own branch only (`skillhub_training` or `skillhub_institute`), own counselor data | Own data only |

## Authentication & session model

[`server/controllers/authController.js`](../../server/controllers/authController.js)
exposes:

- `POST /api/auth/login` — public, no rate limiter (gap, see roadmap).
  Compares bcrypt hash via `User.matchPassword`
  ([`server/models/User.js:92-94`](../../server/models/User.js)). On success
  returns a signed JWT via `User.getSignedJwtToken`
  ([`server/models/User.js:85-89`](../../server/models/User.js); HS256,
  `expiresIn: process.env.JWT_EXPIRE`).
- `POST /api/auth/register` — gated by `protect` + `authorize('admin')`
  ([`server/routes/auth.js:14`](../../server/routes/auth.js)). Only admins
  can create accounts.
- `GET /api/auth/me` — current user.
- `GET /api/auth/logout` — **stateless**; the JWT remains valid until expiry.
  Tracked as a P1 gap.
- `PUT /api/auth/updatepassword` — requires `currentPassword`.

Tokens and the user profile object are persisted on the client in
**localStorage**
([`client/src/contexts/AuthContext.js`](../../client/src/contexts/AuthContext.js))
— there are **no cookies**. Disclosure lives in
[`docs/legal/04-cookie-and-local-storage-disclosure.md`](../legal/04-cookie-and-local-storage-disclosure.md).

## Request lifecycle (representative)

```
Browser ──► CORS preflight (OPTIONS) ──► Render Singapore
        ──► Helmet headers
        ──► JSON body parse
        ──► /api/* router
            ├── protect          (JWT verify, User.findById, isActive check)
            ├── authorize(...)   (role gate, optional)
            ├── exportPivotLimiter (only on /exports/pivot, /exports/template/:id)
            ├── controller       (raw try/catch; buildScopeFilter / canAccessDoc applied)
            └── Mongoose         ──► MongoDB Atlas Ireland (TLS)
        ◄── JSON envelope { success, data | message }
```

Standard error envelope (`{ success: false, message }`) is emitted by
[`server/middleware/errorHandler.js`](../../server/middleware/errorHandler.js).
The handler maps Mongoose `CastError` → 404, duplicate-key → 400,
`ValidationError` → 400; everything else → 500. **Note**: `console.log(err)`
at `errorHandler.js:6` writes the full stack to stdout — a P1 PII-leak
concern (gap roadmap).

## AI integration

Three distinct call-paths:

1. **Dashboard analysis** —
   [`server/services/aiService.js`](../../server/services/aiService.js).
   `POST /api/ai/analysis` aggregates tenant snapshots
   ([`tenantSnapshot.js`](../../server/services/tenantSnapshot.js)) and
   sends them to OpenAI for narrative output. Cost tracked in `AIUsage`.
2. **Tracker chatbot** —
   [`server/services/chatService.js`](../../server/services/chatService.js)
   + [`chatTools.js`](../../server/services/chatTools.js). LLM exposes tools
   that query Mongo (e.g., `searchStudents`, `getCommitmentsByConsultant`).
   Tool results may include personal data and are sent back to OpenAI
   inside the prompt. SSE streamed.
3. **Docs RAG** —
   [`server/services/docsRagService.js`](../../server/services/docsRagService.js).
   In-memory chunk + question index (BM25 + embeddings) loaded at boot from
   the `DocChunk` collection. Groq is primary; OpenAI is fallback with the
   same prompt. 24-hour `QueryCache` TTL. Logged in `DocsChatLog`.

The Docs RAG retrieval surface is LUC-only (`orgGate('luc')`); the tracker
chatbot is available to every authenticated org.

The frontend's `classifyQuery` in
[`client/src/utils/classifyQuery.js`](../../client/src/utils/classifyQuery.js)
client-side-routes each chat turn to either `/api/chat/stream` (tracker) or
`/api/docs-chat` (docs).

## Export Center pipeline

Mounted at `/api/exports/*`
([`server/routes/exports.js`](../../server/routes/exports.js)). Per-dataset
builders live under
[`server/services/exports/pivots/`](../../server/services/exports/pivots/).
The shared helper
[`_shared.js`](../../server/services/exports/pivots/_shared.js) carries
`withSkillhubFinancials` (virtual `outstandingAmount` resolution),
`normalizeHourlyActivities` (LUC vs Skillhub shape), and the pivot
accumulator.

`POST /pivot` and `POST /template/:templateId` are rate-limited by
`exportPivotLimiter` (5 req/min/user — see
[`server/middleware/exportRateLimit.js`](../../server/middleware/exportRateLimit.js)).
`/raw`, `/dimensions`, and saved-template endpoints are not rate-limited.

## Frontend data flow

Each backend resource has an Axios-based service in
[`client/src/services/`](../../client/src/services/). Auth token is attached
by interceptors. State is React Context (`AuthContext`, `ThemeContext`) plus
local `useState`; no Redux. Charting via Recharts; tabular data via
`react-data-grid` (pinned at `7.0.0-beta.59`).

## Production build & static serve

Root `npm run build` runs `cd client && npm install && npm run build`. The
output `client/build/` is served by Express in `NODE_ENV=production` along
with an SPA catch-all
([`server/server.js:100-107`](../../server/server.js)). There is no separate
CDN.

## What lives outside this repo

- MongoDB Atlas (database, automated snapshots, region: Ireland).
- Render dashboard (env vars, scaling, deploy hooks; region: Singapore).
- Groq + OpenAI account dashboards (usage, billing, key rotation).

## Related documents

- [Data Dictionary](03-data-dictionary.md)
- [API Reference](02-api-reference.md)
- [Deployment Runbook](04-deployment-runbook.md)
- [Environment & Secrets](05-environment-and-secrets.md)
- [Threat Model](../security/12-threat-model.md)
- [Security Gap Analysis](../security/14-security-gap-analysis-and-remediation-roadmap.md)
