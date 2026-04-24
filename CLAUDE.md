# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Team Progress Tracker — a MERN stack app for tracking team commitments, consultant performance, and student admissions. Now multi-tenant: hosts **LUC** (Learners Education — original org with 9 team leads) and **Skillhub** (Training branch + Institute branch — coaching institute for IGCSE/CBSE students). Four user roles: **admin** (cross-org; sees both LUC and Skillhub bifurcated), **team_lead** (LUC, scoped to own team), **manager** (LUC, `/student-database` only), **skillhub** (one login per Skillhub branch — `training@skillhub.com` and `institute@skillhub.com` — scoped to own branch).

## Multi-tenancy

- Every tenant-scoped collection has an `organization` field. Enum: `'luc' | 'skillhub_training' | 'skillhub_institute'`.
- Config in `server/config/organizations.js` exports the enum + helpers `isSkillhub(org)`, `isLuc(org)`.
- Scoping helper `buildScopeFilter(req)` in `server/middleware/auth.js`: returns `{}` for admin (or `{ organization: req.query.organization }` when admin opts in); else `{ organization: user.organization }`. For `team_lead` and `skillhub` it also appends `{ teamLead: user._id }`.
- `canAccessDoc(user, doc)` is the corresponding single-doc check used by controllers on GET/PUT/DELETE.
- Non-admin creates auto-set `organization` from `req.user.organization`. Admin creates use `resolveOrganization(req)` which falls back to `'luc'` unless `body.organization` is explicit.
- Frontend: admin dashboard has a top-level `[LUC] [Skillhub]` switch. Skillhub view is rendered by `client/src/components/skillhub/AdminSkillhubView.js` (with Training/Institute sub-tabs). The Skillhub branch logins hit `/skillhub/dashboard` (`client/src/pages/SkillhubDashboard.js`).
- Backfill script: `server/scripts/migrateOrganization.js` (idempotent) sets `organization: 'luc'` on any pre-existing doc missing the field across all 7 collections.

## Development Commands

```bash
# Install all dependencies (root + server + client)
npm run install:all

# Run both servers concurrently (backend :5001, frontend :3001)
npm run dev

# Run backend only
npm run dev:server

# Run frontend only
npm run dev:client

# Build frontend for production
npm run build

# Seed database (wipes + creates: LUC admin + 9 team leads + LUC consultants
# + 2 Skillhub branch logins (training@skillhub.com, institute@skillhub.com)
# + 4 Skillhub counselors. Writes credentials to LOGIN_CREDENTIALS.md)
npm run seed
# Runs: cd server && node scripts/seedDatabase.js

# Backfill organization field on pre-existing docs (idempotent, production-safe)
cd server && node scripts/migrateOrganization.js

# Backfill commitmentDate on legacy Commitment docs (idempotent, production-safe;
# sets commitmentDate = weekStartDate for any row missing it so the required
# field doesn't break old data).
cd server && node scripts/backfillCommitmentDate.js

# Run frontend tests (Jest + React Testing Library)
cd client && npm test
```

**No backend tests exist** — `npm test` in `server/` is a no-op.

Legacy seed scripts exist in `server/utils/` (`seedUsers.js`, `seed2025.js`, `seedTeamBased2025.js`) but are not used by `npm run seed`. Other one-off scripts live in `server/scripts/`: `createManager.js` (adds a manager user), `seedSkillhub.js` (non-destructive Skillhub-only seed — safe to run in production; does not touch LUC data), `importStudents.js` / `clearAndImportStudents.js` (Excel imports), `fixAdmissionClosedStatus.js`, `analyzeExcel.js`, `analyzeExcelData.js`.

## Architecture

### Backend (server/)
- **Express v5** + **Mongoose v9** with CommonJS modules, MongoDB Atlas
- Entry point: `server/server.js` (port 5001)
- Auth: JWT tokens via `Authorization: Bearer <token>` header
- Middleware: `auth.js` exports `protect` (JWT verification, checks `isActive`) and `authorize(...roles)` (role check)
- Routes all prefixed `/api`: auth, users, consultants, commitments, students, notifications, ai, hourly
- Health check: `GET /api/health` (defined inline in `server.js`)
- Error handler middleware (`middleware/errorHandler.js`): catches Mongoose CastError (→404), duplicate key (→400), ValidationError (→400). All error responses: `{ success: false, message }`
- Controllers use raw `try/catch` with `next(error)` — no `asyncHandler` wrapper
- Role-based data scoping is done inline per controller (team leads filter by `teamLead: req.user.id`, admins see all)
- In production, Express serves the React build as static files with SPA fallback via regex `(/^(?!\/api).*/)`

### Frontend (client/)
- **React 19** + **MUI v7** + React Router v7 (port 3001)
- State: React Context for auth (`AuthContext`), local `useState` for everything else — no Redux
- API calls: service modules in `client/src/services/` using Axios with interceptors for auth tokens
- Route guard: `PrivateRoute` component checks auth + role
- Routes: `/login`, `/admin/dashboard` (admin), `/team-lead/dashboard` (team_lead), `/student-database` (admin + team_lead + manager), `/hourly-tracker` (admin + team_lead + skillhub), `/skillhub/dashboard` (skillhub). `HomeRedirect` in `App.js` routes users by role after login; unmatched paths redirect to `/`.
- Charts: Recharts (`recharts`). Heatmap: `react-calendar-heatmap`
- Client-side Excel/CSV export via `xlsx` + `file-saver` in `exportService.js`
- Central constants in `client/src/utils/constants.js`: lead stages, statuses, roles, colors, `API_BASE_URL`
- Week utilities in `client/src/utils/weekUtils.js` (date-fns, `weekStartsOn: 1`)
- Theme (`client/src/theme.js`): Inter font, 12px border radius, gradient buttons/AppBar, hover-lift cards

### Key Models & Relationships
- **User** — login accounts. Role enum: `admin`, `team_lead`, `manager`, `skillhub`. Has `organization` field (required, default `'luc'`) and `isActive` for soft delete. Password field has `select: false`. JWT payload includes `id` and `role` — `organization` is loaded from DB per request in `protect`.
- **Consultant** — sales consultants managed by team leads (no login account). Ref: `teamLead → User`
- **Commitment** — weekly sales tracking records. Ref: `teamLead → User`. Indexed on `(consultantName, weekNumber, year)`. Tracks `createdBy`/`lastUpdatedBy`. Status enum: `pending`, `in_progress`, `achieved`, `missed`. `commitmentDate` is **required** — the actual calendar day the team lead/counselor is logging the commitment for (separate from `weekStartDate` which is always the Monday of the committed week). For non-admin creates/updates the controller enforces that `commitmentDate ∈ [weekStartDate, weekEndDate]`; admins can set any date. Run `server/scripts/backfillCommitmentDate.js` once to populate the field on pre-existing rows (`commitmentDate = weekStartDate`).
- **Student** — admitted student records. Refs: `teamLead → User`, `consultant → Consultant`. Dual-mode schema: LUC fields (`program`, `university`, `source`, `companyName`, etc.) are required only when `organization === 'luc'`; Skillhub fields (`enrollmentNumber`, `curriculum`, `academicYear`, `yearOrGrade`, `mode`, `courseDuration`, `emis[]`, `phones{}`, `emails{}`, etc.) are required only for Skillhub. `sno` auto-increments per team (LUC) or per organization (Skillhub). **Skillhub `enrollmentNumber` is entered manually by the counselor** (required + unique; UI hints the `SH/IGCSE/26/11/042` shape but does not enforce it). The old auto-gen pre-validate hook was removed in commit c5effc2 — `curriculumSlug` is still derived in a pre-validate hook from `curriculum` (which itself is composed in the UI from cascading Board + IGCSE-Variant dropdowns, e.g. `IGCSE-Cambridge`). `academicYear` enum: `2024-25 | 2025-26 | 2026-27`. `studentStatus` enum: `new_admission | active | inactive`. `outstandingAmount` is a virtual derived from `courseFee - admissionFeePaid - registrationFee - sum(emis.paidAmount)`.
- **Counter** — atomic sequence generator kept in the repo but **currently unused** (was the backing store for auto-generated Skillhub enrollment numbers before c5effc2 made them manual). Do not reuse the collection key `enroll:{organization}:{IGCSE|CBSE}:{year}` without coordinating.
- **Notification** — in-app notifications. Ref: `user → User`. Has `priority` (low/medium/high) and `type` enum (`follow_up_reminder`, `weekly_summary`, `commitment_due`, `team_update`). Controller aligned with model as of Skillhub integration — prior bug (controller used `recipient`/`isActive` which don't exist) is fixed. Delete is a hard delete now; there is no soft-delete flag on Notification.
- **AIUsage** — tracks OpenAI API usage per user (tokens, cost, date range queried). Indexed on `createdAt` and `(user, createdAt)`.
- **WeeklySummary** — aggregated weekly metrics (appears unused — no controller or route references it)
- **HourlyActivity** — per-consultant per-day slot tracking for the Hourly Tracker feature. Fixed slot IDs (`s0930`..`s1900`) and an `activityType` enum. The Skillhub-only `sh_meeting` type is duration-based (30min–3hr, no count) and scored between Calling and Demo Meeting in the leaderboard. Served via `/api/hourly`.
- **DailyAdmission** / **DailyReference** — per-day counts tied to consultants, also served via `/api/hourly` (admissions, references endpoints).

### Hourly Tracker Feature
- `/api/hourly/*` routes cover slot upserts, day/month reads, leaderboard, and an AI analysis endpoint (`GET /api/hourly/ai-analysis`). All require auth but no role gate — scoping is done inline in `hourlyController.js`.
- Frontend page: `client/src/pages/HourlyTrackerPage.js`, route `/hourly-tracker`.

### AI Analysis Feature
- `POST /api/ai/analysis` — generates dashboard analysis via OpenAI. Available to both admins and team leads (role-scoped data aggregation).
- `GET /api/ai/usage` — admin-only usage/cost stats.
- Backend service in `server/services/aiService.js` uses the `openai` npm package. Requires `OPENAI_API_KEY` env var.

### Business Logic
- **Weeks**: Monday–Sunday, ISO week numbers via `date-fns` (`weekStartsOn: 1`)
- **Admission closure is irreversible**: once `admissionClosed = true` on a Commitment, the server rejects any attempt to unset it
- **Lead stages**: Dead → Cold → Warm → Hot → Offer Sent → Awaiting Confirmation → Meeting Scheduled → Admission → CIF (+ Unresponsive)
- **Student serial numbers** (`sno`): auto-incremented per team lead via `Student.getNextSno(teamLeadId)`
- **Soft delete**: Users and Consultants use `isActive: false`
- **Permanent delete**: Deletes the entity without checks. Historical data (commitments, students) is preserved via denormalized string fields (`consultantName`, `teamLeadName`, `teamName`)

## Environment

Server env (`server/.env`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, `NODE_ENV`, `OPENAI_API_KEY`

Client env (`client/.env`): `REACT_APP_API_URL=http://localhost:5001/api` (production uses relative `/api`)

## Known Issues

- **Client/server route mismatches**: Close admission (server: `PUT /:id/close-admission`, client: `PATCH /:id/close`), update meetings (server: `PUT`, client: `PATCH`), team consultants (server: `GET /api/users/team/:teamLeadId`, client: `GET /api/users/teamlead/:id/consultants`)
- **Client status mismatch**: `constants.js` `STATUS_LIST` includes `not_achieved` but the backend Commitment model enum uses `missed`
- **Duplicate `leadStage` field** in Commitment model — defined twice, second definition silently overwrites the first
- **`ConsultantDashboard.js`** in `client/src/pages/` is dead code (not imported or routed)
- **`express-validator`** is installed but never imported — all validation is manual in controllers

## Gotchas

- Client port is **3001** (not 3000), server port is **5001** (not 5000). If `server/.env` is missing, `server.js` defaults to port 5000 (not 5001).
- Multiple Axios interceptors set the auth token independently (in `commitmentService.js`, `userService.js`, and globally in `authService.js`). The `commitmentService` and `userService` interceptors are global (not instance-specific), so they stack up on the shared axios instance.
- `userService.js` uses `process.env.REACT_APP_API_URL` and sets `axios.defaults.baseURL`, while most other services import `API_BASE_URL` from `utils/constants.js`
- The `consultant` role exists in some legacy controller code but Users can only be `admin`, `team_lead`, or `manager`. Managers have no dashboard — they're hard-redirected to `/student-database` on login and should only appear in role-gates that explicitly include `manager`.
- Commitment route file has careful ordering: specific routes (`/date-range`, `/week/:weekNumber/:year`) must come before the generic `/:id` catch-all
- No rate limiting or Helmet.js — security hardening is pending

## Docs RAG (program-docs chatbot, LUC-only)

Extends the tracker's existing "Ask me" chat drawer with grounded answers
from 16 LUC program PDFs (8 programs × overview + QNA).

- **Endpoints** (`/api/docs-chat/*`):
  - `POST /` — consultant query, SSE stream. LUC-only (`orgGate('luc')`).
    Body: `{ query, studentId?, leadId?, programHint? }`.
  - `POST /feedback` — thumbs-up/down on an answer. Body: `{ logId, rating, comment? }`.
  - `POST /admin/reingest?force=true` — admin only; shells `ingestProgramDocs.js`.
  - `GET /stats` — admin only; chunk counts, tier distribution, cache hit rate, top/refusal/low-confidence queries.
  - `GET /health` — **public, no auth** (Render readiness probe). 503 when `chunksLoaded === 0`.
- **Models**:
  - `DocChunk` — persisted chunks, both `embedding` (content) + `questionEmbedding` (QNA question text). `organization: 'luc'` always. 215 chunks at current corpus size.
  - `QueryCache` — 24h TTL, keyed `sha1(normalize(query) + '|' + programFilter)`.
  - `DocsChatLog` — one row per request (cache hits included). Analytical, no TTL. `feedback` subdoc for thumbs-up/down.
- **Service**: `server/services/docsRagService.js`. In-memory `docChunks[]`, `questionIndex[]`, wink-BM25 index — all populated once at boot via `loadChunks()`. Groq primary generation, OpenAI fallback. Keep-alive HTTP agent shared by both SDKs.
- **Frontend**: chat drawer in `ChatPanel.js` client-side-routes every turn via `classifyQuery` → `/api/chat/stream` (tracker) or `/api/docs-chat` (docs). LUC-only — other orgs hard-locked to tracker path. Source chips render from the SSE `done` event's `sources[]`. Auth-blob PDF viewer at `/pdf-viewer`. Admin dashboard at `/admin/docs-rag`.
- **Static PDFs**: served by Express at `/program-docs/*` behind `protect` + `orgGate('luc')`. Files live in `client/public/program-docs/<slug>/`.
- **Adding a new program**: drop two PDFs in `client/public/program-docs/<new-slug>/`, extend `PROGRAMS` in `server/models/DocChunk.js`, extend `DOC_TYPE_MAP` in `server/scripts/ingestProgramDocs.js`, run `npm run ingest:docs:force`, deploy, admin clicks "Force re-ingest".
- **Logs**: `DocsChatLog.createdAt` for time-range queries; `tier: 3` entries surface in the admin dashboard's "Refusals (last 24h)" table as corpus-gap signals.
- **Spec**: full details live in `DOCS_RAG_FEATURE_SPEC.md` (16 sections). Deploy steps + env vars in `DEPLOYMENT.md § Docs RAG Feature — Render Deploy Cutover`.
