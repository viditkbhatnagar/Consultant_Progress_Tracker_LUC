# 06 — API Reference

This document is the complete, code-verified catalogue of the platform's HTTP API: every route in
all 19 files under `server/routes/`, the middleware that guards it, the controller function behind
it, and the request/response shape it actually accepts and returns. It was written by reading the
route files **and** their controllers at HEAD, not by trusting the older
[`docs/engineering/02-api-reference.md`](../engineering/02-api-reference.md) (drafted 2026-04-26 and
now 207 commits stale — see [What the older doc gets wrong](#what-the-older-api-doc-gets-wrong)).
Where the code and the previous documentation disagree, the code wins and the disagreement is
called out. Where something could not be verified from the code, it is labelled
**UNVERIFIED — needs confirmation** rather than guessed.

---

## Contents

1. [Global conventions](#1-global-conventions)
2. [Route mounting map](#2-route-mounting-map)
3. [Public / unauthenticated endpoints](#3-public--unauthenticated-endpoints)
4. [Rate-limited endpoints](#4-rate-limited-endpoints)
5. [Route ordering — why it matters here](#5-route-ordering--why-it-matters-here)
6. Route reference, one section per file:
   [auth](#61-auth--apiauth) ·
   [users](#62-users--apiusers) ·
   [consultants](#63-consultants--apiconsultants) ·
   [commitments](#64-commitments--apicommitments) ·
   [students](#65-students--apistudents) ·
   [meetings](#66-meetings--apimeetings) ·
   [hourly](#67-hourly-tracker--apihourly) ·
   [institute](#68-skillhub-institute--apiinstitute) ·
   [exports](#69-export-center--apiexports) ·
   [ai](#610-ai-analysis--apiai) ·
   [chat](#611-tracker-chat--apichat) ·
   [docs-chat](#612-docs-rag-chat--apidocs-chat) ·
   [exec-overview](#613-executive-overview--apiexec-overview) ·
   [team-entries](#614-team-entries--apiteam-entries) ·
   [tiers](#615-tier-fight--apitiers) ·
   [payment-plans](#616-payment-plans--apipayment-plans) ·
   [reconciliation](#617-reconciliation--apireconciliation) ·
   [announcements](#618-announcements--apiannouncements) ·
   [notifications](#619-notifications--apinotifications)
7. [SSE streaming endpoints](#7-sse-streaming-endpoints)
8. [Socket.IO real-time layer](#8-socketio-real-time-layer)
9. [Auth-gated static asset routes](#9-auth-gated-static-asset-routes)
10. [Client/server mismatches and authorization gaps](#10-clientserver-mismatches-and-authorization-gaps)
11. [What the older API doc gets wrong](#what-the-older-api-doc-gets-wrong)
12. [Unverified items](#12-unverified-items)
13. [Related documents](#related-documents)

---

## 1. Global conventions

### Base URL and prefix

| Environment | Base | Set by |
|---|---|---|
| Local dev | `http://localhost:5001/api` | `client/.env` → `REACT_APP_API_URL` |
| Production (Render) | `/api` (relative, same origin) | client falls back to relative path |

Every route file is mounted under `/api/<group>` in
[`server/server.js:35–53`](../../server/server.js). There is **no API versioning** — no `/v1`. A
breaking change to a route breaks every deployed client immediately (the client is served from the
same web service, so in practice they deploy together).

### Authentication

```http
Authorization: Bearer <jwt>
```

The JWT is issued by `POST /api/auth/login` and verified by `protect`
([`server/middleware/auth.js:5`](../../server/middleware/auth.js)). Facts worth knowing:

- The token payload is **only** `{ id, role }`
  ([`server/models/User.js:86`](../../server/models/User.js)). `organization` is **not** in the
  token — `protect` re-loads the full `User` document from MongoDB on **every single request**
  (`auth.js:27`). That is one extra DB round-trip per API call, and it means a role/org change
  takes effect immediately without re-login.
- `protect` also rejects deactivated users (`isActive === false` → 401, `auth.js:36`). Soft-deleting
  a user therefore logs them out on their next request.
- Token expiry comes from the `JWT_EXPIRE` env var. **If `JWT_EXPIRE` is unset, `expiresIn` is
  `undefined` and jsonwebtoken issues a token that never expires.** Make sure it is set in Render.
- `JWT_REFRESH_EXPIRE` appears in the documented env list but **is never read anywhere in
  `server/`** — there is no refresh-token flow. When the access token expires the user simply has
  to log in again.
- There are no cookies. `GET /api/auth/logout` is a no-op that returns 200 — the client just drops
  the token from `localStorage`.

### Response envelopes

Success (the overwhelmingly common shape):

```json
{ "success": true, "data": { }  }
```

Variants you will meet, all real:

| Shape | Used by |
|---|---|
| `{ success, data }` | most GET-one / POST / PUT |
| `{ success, count, data }` | list endpoints (`count` = rows in `data`, not the total) |
| `{ success, data, pagination: { page, limit, total, pages } }` | `GET /api/students` (only when a page/limit param is sent), `GET /api/meetings` (always) |
| `{ success, token, user: {...} }` | `POST /api/auth/login`, `POST /api/auth/register`, `PUT /api/auth/updatepassword` |
| `{ success, analysis }` | AI endpoints under `/api/ai` and `/api/commitments/ai-analysis` — note the key is `analysis`, **not** `data` |
| `{ success, data: "<string>" }` | `/api/hourly/ai-analysis` and the leaderboards — same feature, different key. Inconsistent by accident. |
| `{ success, rows, nextCursor, totalEstimate, scopeNote }` | `POST /api/exports/raw` |
| `{ success, cells, rowOrder, colOrder, rowTotals, colTotals, grandTotal, scopeNote }` | `POST /api/exports/pivot` |
| `{ ok, chunksLoaded, ... }` (**no `success` key**) | `GET /api/docs-chat/health` — the only endpoint that breaks the envelope |

Error:

```json
{ "success": false, "message": "..." }
```

### Error handler

[`server/middleware/errorHandler.js`](../../server/middleware/errorHandler.js) is mounted last
(`server.js:117`). Controllers use plain `try/catch` with `next(error)` — there is no
`asyncHandler` wrapper, but none is needed: this is **Express 5**, which auto-forwards a rejected
promise from an async handler straight to this middleware. A controller that forgets its `try/catch`
still returns a 500 here (verified empirically) — it does not hang the request or crash the process.

One route family is outside this handler entirely: `announcementController.js` answers errors inline
with `res.status(500)` and never calls `next`, so the table below does not apply to
`/api/announcements` — a malformed ObjectId there returns 500, not 404.

| Condition | Detected at | Status | `message` |
|---|---|---|---|
| Mongoose `CastError` (malformed ObjectId) | `errorHandler.js:9` | **404** | `"Resource not found"` |
| Duplicate key (`err.code === 11000`) | `errorHandler.js:15` | **400** | `"Duplicate field value entered"` |
| Mongoose `ValidationError` | `errorHandler.js:21` | **400** | an **array** of field messages |
| anything else | `errorHandler.js:26` | `err.statusCode` or **500** | `err.message` or `"Server Error"` |

Three traps here:

1. **A bad ObjectId returns 404, not 400.** `GET /api/students/not-an-id` says "Resource not
   found". This is deliberate but surprises people debugging.
2. **`ValidationError` puts an array in `message`.** Every other error puts a string there. Clients
   that do `String(res.data.message)` render `"a,b,c"`.
3. `console.log(err)` on every error (`errorHandler.js:6`) — full stack traces land in Render logs.

Some controllers bypass the handler and build their own responses:
`exportController` throws errors carrying `err.statusCode` and catches them itself
([`exportController.js:97–102`](../../server/controllers/exportController.js));
`consultantController.createConsultant` returns a raw 500 instead of calling `next`
([`consultantController.js:98–102`](../../server/controllers/consultantController.js));
`tierController.generateImage` does the same
([`tierController.js:290`](../../server/controllers/tierController.js)).

### Common status codes

| Code | Meaning in this codebase |
|---|---|
| 200 | OK |
| 201 | created (`POST` on auth/register, consultants, students, meetings, commitments, payment-plans, teachers, timetable, saved-templates, roster) |
| 400 | missing/invalid body, business-rule violation (e.g. reopening a closed admission) |
| 401 | no token / bad token / user not found / user deactivated / wrong current password |
| 403 | wrong role (`authorize`), wrong org (`orgGate`), or `canAccessDoc` denial |
| 404 | document not found, or a CastError, **or no route matched at all** (Express default HTML page) |
| 409 | duplicate saved-template name; already-linked student/commitment on `/reconciliation/pair` |
| 413 | upload over the multer size cap |
| 429 | rate limit hit; also the saved-template 200-per-user cap |
| 501 | export dataset recognised but its builder is not implemented |
| 502 | upstream AI provider rate-limited (`err.status === 429` from OpenAI) |
| 503 | feature switched off (`DOCS_RAG_ENABLED=false`), `OPENAI_API_KEY` missing, or RAG index not loaded |

### Multi-tenant scoping — read this before any route table

Scoping is **not** done by route. It is done inside controllers with three helpers in
[`server/middleware/auth.js`](../../server/middleware/auth.js):

| Helper | Line | Behaviour |
|---|---|---|
| `buildScopeFilter(req)` | `auth.js:69` | admin → `{}` (or `{ organization: req.query.organization }` if the admin opts in); everyone else → `{ organization: user.organization }`; **plus** `{ teamLead: user._id }` for `team_lead` and `skillhub` |
| `canAccessDoc(user, doc)` | `auth.js:91` | admin → always true; else org must match; `team_lead`/`skillhub` must also own the doc via `teamLead` |
| `resolveOrganization(req)` | `auth.js:105` | non-admin → own org (body ignored); admin → `body.organization` or `'luc'` |

Consequences you must internalise:

- **`?organization=` is honoured only for admins.** A `team_lead` sending it is silently ignored.
- **Admin with no `?organization=` sees every tenant merged together.** This is the default for
  most list endpoints and is a frequent source of "why are Skillhub rows in my LUC report".
- `manager` gets org scoping but **not** ownership scoping — a manager sees all LUC rows on any
  endpoint that doesn't exclude the role. See
  [authorization gaps](#10-clientserver-mismatches-and-authorization-gaps).
- The Hourly Tracker deliberately **strips** the `teamLead` clause
  ([`hourlyController.js:18`](../../server/controllers/hourlyController.js)) so team leads see the
  whole org grid.

### Pagination

There is no shared pagination convention. Three different ones exist:

| Endpoint | Style | Cap |
|---|---|---|
| `GET /api/students` | `?page` + `?limit`; `pagination` block only appears if one of them is sent | 500/page (`studentController.js:213`) |
| `GET /api/meetings` | `?page` + `?limit`, always returns `pagination` | 20,000/page (`meetingController.js:73`) |
| `POST /api/exports/raw` | opaque base64 `cursor` + `nextCursor` | 5,000/page server-side; client loops to 100,000 (`client/src/services/exportsApi.js:17`) |

Everything else returns an unpaginated array, sometimes with a hard `.limit()` baked in (e.g.
notifications: last 50; chat conversations: last 50; AI-analysis inputs: 1,000 commitments).

---

## 2. Route mounting map

All mounts are in [`server/server.js:35–53`](../../server/server.js), in this order:

| # | Mount | Route file | Endpoints | Feature area |
|---|---|---|---|---|
| 1 | `/api/auth` | `routes/auth.js` | 5 | login / session |
| 2 | `/api/users` | `routes/users.js` | 6 | user admin |
| 3 | `/api/commitments` | `routes/commitments.js` | 12 | Commitment (Demo) Tracker |
| 4 | `/api/notifications` | `routes/notifications.js` | 5 | in-app bell |
| 5 | `/api/consultants` | `routes/consultants.js` | 5 | consultant records |
| 6 | `/api/students` | `routes/students.js` | 9 | Student Database |
| 7 | `/api/ai` | `routes/ai.js` | 6 | OpenAI dashboard analysis |
| 8 | `/api/hourly` | `routes/hourly.js` | 15 | Hourly Activity Tracker |
| 9 | `/api/meetings` | `routes/meetings.js` | 7 | Meeting Tracker |
| 10 | `/api/reconciliation` | `routes/reconciliation.js` | 5 | commitment↔student drift |
| 11 | `/api/exports` | `routes/exports.js` | 8 | Export Center |
| 12 | `/api/chat` | `routes/chat.js` | 6 | tracker chatbot (SSE) |
| 13 | `/api/docs-chat` | `routes/docsChat.js` | 5 | program-docs RAG (SSE) |
| 14 | `/api/exec-overview` | `routes/execOverview.js` | 4 | Leadership dashboards |
| 15 | `/api/team-entries` | `routes/teamEntries.js` | 5 | manual monthly entry grid |
| 16 | `/api/announcements` | `routes/announcements.js` | 2 | org-wide banners |
| 17 | `/api/tiers` | `routes/tiers.js` | 5 | Tier Fight |
| 18 | `/api/payment-plans` | `routes/paymentPlans.js` | 4 | LUC payment plans |
| 19 | `/api/institute` | `routes/institute.js` | 24 | Skillhub Institute |
| — | `GET /api/health` | inline, `server.js:99` | 1 | liveness probe |

**≈138 HTTP endpoints total.** Mount order matters only for the three static asset mounts and the
SPA catch-all, which are registered *after* all API routes (`server.js:59–113`).

Global middleware, in execution order (`server.js:20–32`):

1. `helmet()` — with `contentSecurityPolicy: false` (CSP deliberately off; CRA inline styles) and
   `crossOriginResourcePolicy: 'same-site'` (needed for auth-blob PDFs and image snippets).
2. `cors()` — **no options, so all origins are allowed**, in production too.
3. `express.json()` and `express.urlencoded({ extended: false })`.

There is **no global rate limiter**, no request-id middleware, and no access logging.

---

## 3. Public / unauthenticated endpoints

Exactly two endpoints answer without a token. Both are deliberate.

| Endpoint | File:line | Why it is public | Response |
|---|---|---|---|
| `GET /api/health` | [`server.js:99`](../../server/server.js) | Render/uptime liveness probe | `200 { success: true, message: "Server is running" }` — **it does not check MongoDB**, so it returns 200 even with the database down |
| `GET /api/docs-chat/health` | [`routes/docsChat.js:61`](../../server/routes/docsChat.js) | Render readiness probe for the RAG index; Render cannot present a JWT | `200`/`503` with `{ ok, chunksLoaded, questionsIndexed, bm25Ready, groqConfigured, openaiConfigured, lastIngestAt, uptime }` |

Notes on the docs-chat probe:

- It is `503` whenever `chunksLoaded === 0` or the index has not finished loading
  (`docsChat.js:63`), which is exactly what you want for a readiness gate.
- It is **exempt from the `DOCS_RAG_ENABLED` kill switch** (`docsChat.js:20–23`) so monitoring keeps
  working while the feature is off.
- It leaks two booleans about server configuration (`groqConfigured`, `openaiConfigured`) and the
  process uptime to anyone on the internet. No key material, but it is unauthenticated surface —
  worth knowing before a security review asks.

Everything else, including all static PDF routes, requires `protect`.

---

## 4. Rate-limited endpoints

Rate limiting is per-endpoint, not global. Two limiters exist, both `express-rate-limit`, both keyed
on `req.user._id` with an IP fallback.

| Limiter | Defined at | Window / max | Applied to |
|---|---|---|---|
| `exportPivotLimiter` | [`server/middleware/exportRateLimit.js:8–15`](../../server/middleware/exportRateLimit.js) | 60 s / **5 requests per user** | `POST /api/exports/pivot`, `POST /api/exports/template/:templateId` |
| `importLimiter` | [`server/routes/institute.js:29–36`](../../server/routes/institute.js) | 60 s / **10 requests per user** | `POST /api/institute/timetable/import` |

Both return `429` with `{ success: false, message: ... }` and `standardHeaders: true`
(`RateLimit-*` response headers), `legacyHeaders: false`.

**Deliberately not limited:** `POST /api/exports/raw`, `GET /api/exports/dimensions/:dataset`, and
all saved-template routes ([`routes/exports.js:20–28`](../../server/routes/exports.js)). Also
unlimited, and far more expensive: every OpenAI-billed endpoint —
`POST /api/ai/*`, `GET /api/hourly/ai-analysis`, `GET /api/hourly/leaderboard*`,
`GET /api/meetings/ai-analysis`, `GET /api/commitments/ai-analysis`,
`POST /api/chat/stream`, `POST /api/chat/transcribe`, `POST /api/tiers/generate-image`
(gpt-image-2 — the single most expensive call in the system). A logged-in user can run any of these
in a loop. **This is the biggest uncapped-cost risk in the API** and should be the first thing you
put a limiter on.

A separate, non-rate-limit quota: `POST /api/exports/saved-templates` returns **429** once a user
holds 200 saved templates ([`exportController.js:313–319`](../../server/controllers/exportController.js)).

---

## 5. Route ordering — why it matters here

Express matches routes in registration order. Several files carry literal paths that would be
swallowed by a `/:id` pattern registered first. The affected files carry comments saying so; keep
them.

| File | Must come first | Would otherwise be eaten by |
|---|---|---|
| `routes/commitments.js:34–55` | `/date-range`, `/linkable`, `/ai-analysis`, `/week/:weekNumber/:year`, `/consultant/:consultantName/performance`, `/:id/close-admission`, `/:id/meetings` | `router.route('/:id')` at line 58 |
| `routes/students.js:22–35` | `/stats`, `/programs`, `/:id/activate`, `/:id/status` | `router.route('/:id')` at line 37 |
| `routes/meetings.js:27–30` | `/stats`, `/ai-analysis` | `router.route('/:id')` at line 32 |
| `routes/institute.js:66,73–90` | `/timetable/import`, `/attendance/meta`, `/attendance/roster`, `/attendance/entry`, `/attendance/student`, `/tests/meta` | `/timetable/:id`, `/tests/:id`, and the generic `/attendance` |
| `routes/exports.js:24–25` | `/templates` | `/template/:templateId` (different words, but the comment warns anyway) |
| `routes/execOverview.js:17–19` | `/teams`, `/consultant-performance` | `/team/:teamLeadId` |
| `routes/docsChat.js:61–275` | `/health` (`:61`), `/admin/reingest` (`:78`), `/stats` (`:121`), `/feedback` (`:275`) | the `POST /` chat route at `:320` |

If you add a route, add it **above** the parameterised block, and re-run the relevant test suite —
a mis-ordered route usually fails as a confusing `CastError → 404 "Resource not found"` (Mongoose
tries to cast the literal string as an ObjectId), not as a routing error.

---

## 6. Route reference

Legend for every table below:

- **Auth** — `protect` means a valid JWT is required. All routes require it unless stated.
- **Roles** — the `authorize(...)` list at the route. `any` means no route-level role check (the
  controller may still restrict).
- Line references are `file:line` at HEAD.

---

### 6.1 Auth — `/api/auth`

Routes: [`server/routes/auth.js`](../../server/routes/auth.js) ·
Controller: [`server/controllers/authController.js`](../../server/controllers/authController.js)

| Method | Path | Auth | Roles | Controller | Purpose |
|---|---|---|---|---|---|
| POST | `/register` | ✅ | `admin` | `register` (`authController.js:7`) | create a user |
| POST | `/login` | ❌ | — | `login` (`:59`) | exchange credentials for a JWT |
| GET | `/logout` | ✅ | any | `logout` (`:112`) | no-op 200; client discards the token |
| GET | `/me` | ✅ | any | `getMe` (`:123`) | current user, `teamLead` populated |
| PUT | `/updatepassword` | ✅ | any | `updatePassword` (`:139`) | change own password |

**`POST /login`** — body `{ email, password }`. Returns
`{ success, token, user: { id, name, email, role, organization, teamName, teamLead } }`
(`authController.js:161–177`). `401 "Invalid credentials"` for both unknown email and wrong
password (correct — no user enumeration). `401 "Account is deactivated"` when `isActive` is false —
this one *does* distinguish, which is a minor enumeration leak. Side effect: `lastLogin` is written
on every successful login (`:100`).

**`POST /register`** — body `{ email, password, name, role, teamLead?, teamName?, phone? }`.
Two traps:

1. **`organization` is never read from the body** (`authController.js:35–43`). The `User` schema
   defaults to `'luc'` ([`models/User.js:35–41`](../../server/models/User.js)), so **every user
   created through this endpoint is a LUC user.** New Skillhub branch logins cannot be created via
   the API — use `server/scripts/seedSkillhub.js`, or update `organization` directly in Atlas.
2. The response contains **the new user's JWT**, not the admin's (`sendTokenResponse(user, 201)`).
   Harmless in practice (the client ignores it) but do not wire it into anything.

The validation branch `role === 'consultant'` (`:20`) is dead — `consultant` is not in the `User`
role enum (`models/User.js:32`).

**`PUT /updatepassword`** — body `{ currentPassword, newPassword }`; `401 "Password is incorrect"`
on mismatch. Hashing happens in a `pre('save')` hook (`models/User.js:75–82`), so it only applies on
`.save()` — a `findByIdAndUpdate` that sets `password` would store plaintext. Nothing does that
today; do not add one.

---

### 6.2 Users — `/api/users`

Routes: [`server/routes/users.js`](../../server/routes/users.js) ·
Controller: [`server/controllers/userController.js`](../../server/controllers/userController.js) ·
`router.use(protect)` at `users.js:16`.

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | `admin`, `team_lead`, `skillhub` | `getUsers` (`:7`) | list users, role-shaped |
| GET | `/team/:teamLeadId` | `admin`, `team_lead`, `skillhub` | `getConsultantsByTeamLead` (`:206`) | **always returns `[]`** — see below |
| GET | `/:id` | **any** | `getUser` (`:49`) | one user |
| PUT | `/:id` | **any** | `updateUser` (`:87`) | update profile |
| DELETE | `/:id` | `admin` | `deleteUser` (`:144`) | soft delete (`isActive = false`) |
| DELETE | `/:id/permanent` | `admin` | `permanentDeleteUser` (`:172`) | hard delete |

`GET /` returns different sets per role (`userController.js:11–31`): `team_lead` sees team leads +
admins in their org; `skillhub` sees skillhub logins + admins in their org; `admin` sees everyone,
narrowable with `?organization=`. Response `{ success, count, data }`.

**`GET /team/:teamLeadId` is dead weight.** It queries `User.find({ teamLead: ..., role:
'consultant' })` (`userController.js:216–219`), but `'consultant'` is not a legal `User.role` — the
real consultant records live in the separate `Consultant` collection. It returns
`{ success: true, count: 0, data: [] }` every time. Use `GET /api/consultants` instead. (The client
wrapper at `client/src/services/userService.js:54` was fixed to hit this path and now gets a clean
empty array instead of a 404 — the *path* mismatch listed in CLAUDE.md is fixed; the endpoint is
still useless.)

`DELETE /:id/permanent` refuses to delete an `admin` (`400 "Cannot delete admin accounts"`,
`userController.js:184`). `DELETE /:id` has no such guard — an admin can soft-delete themselves and
be locked out on the next request (`protect` rejects `isActive: false`).

**Authorization gap:** `GET /:id` and `PUT /:id` have **no `authorize()`** at the route, and the
controller's checks only cover the (impossible) `consultant` role and `team_lead`
(`userController.js:60–72`, `:99–110`). A `manager` or `skillhub` login can therefore read **any**
user document — including users in other organisations — and can `PUT` any user's `name` and
`phone`. Role/`isActive`/`teamLead` changes remain admin-only (`:119–125`), so this is a
confidentiality/integrity issue rather than a privilege-escalation one. See
[§10](#10-clientserver-mismatches-and-authorization-gaps).

---

### 6.3 Consultants — `/api/consultants`

Routes: [`server/routes/consultants.js`](../../server/routes/consultants.js) ·
Controller: [`server/controllers/consultantController.js`](../../server/controllers/consultantController.js)

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | `admin`, `team_lead`, `manager`, `skillhub` | `getConsultants` (`:9`) | list, scoped |
| POST | `/` | `admin`, `team_lead`, `skillhub` | `createConsultant` (`:40`) | create |
| PUT | `/:id` | `admin`, `team_lead`, `skillhub` | `updateConsultant` (`:110`) | update |
| DELETE | `/:id` | `admin`, `team_lead`, `skillhub` | `deleteConsultant` (`:170`) | soft delete |
| DELETE | `/:id/permanent` | `admin` | `permanentDeleteConsultant` (`:206`) | hard delete |

`GET /` query param **`?scope=all`** (`consultantController.js:15`): for `admin` and `team_lead`
only, this replaces the scope filter with `{ organization: <own org> }`, i.e. it drops the ownership
clause so a team lead can list every LUC consultant. This backs the read-only cross-team Executive
Overview. `team_lead` and `skillhub` also get an implicit `isActive: true` (`:19`) — admins see
deactivated consultants, team leads do not.

`POST /` body `{ name (required), email?, phone?, teamName?, teamLead? }`. `teamLead`/`teamName`
are read from the body **only for admin**; team leads and skillhub logins always own what they
create (`:57–71`). The org is taken from the target team lead's own user document
(`:70–71`), not from the body — which is why an admin can create a Skillhub consultant even though
they cannot create a Skillhub *user*.

Failure mode note: `createConsultant` catches its own errors and returns a raw
`500 { success:false, message: error.message }` (`:98–102`) instead of calling `next(error)`. A
duplicate-key error therefore surfaces as 500 here, not the usual 400.

Deleting emits Socket.IO `consultant:deactivated` / `consultant:deleted` — see
[§8](#8-socketio-real-time-layer).

---

### 6.4 Commitments — `/api/commitments`

Routes: [`server/routes/commitments.js`](../../server/routes/commitments.js) ·
Controller: [`server/controllers/commitmentController.js`](../../server/controllers/commitmentController.js) ·
`router.use(protect)` at `commitments.js:22`. **Route order is load-bearing here** — see
[§5](#5-route-ordering--why-it-matters-here).

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | **any** | `getCommitments` (`:76`) | list, filtered by `?weekNumber&year&status` |
| POST | `/` | `team_lead`, `skillhub`, `admin` | `createCommitment` (`:170`) | create |
| GET | `/date-range` | `team_lead`, `admin`, `skillhub` | `getCommitmentsByDateRange` (`:566`) | `?startDate&endDate` (both required) |
| GET | `/linkable` | `admin`, `team_lead` | `getLinkableCommitments` (`:521`) | unlinked LUC commitments for the pairing pickers |
| GET | `/ai-analysis` | `admin`, `team_lead` | `getAIAnalysis` (`:682`) | OpenAI narrative over the current filter |
| GET | `/week/:weekNumber/:year` | **any** | `getWeekCommitments` (`:492`) | one ISO week |
| GET | `/consultant/:consultantName/performance` | `team_lead`, `admin`, `skillhub` | `getConsultantPerformance` (`:607`) | monthly rollup for one consultant |
| PUT | `/:id/close-admission` | `team_lead`, `admin`, `skillhub` | `closeAdmission` (`:412`) | close an admission (**client calls the wrong path — see §10**) |
| PUT | `/:id/meetings` | `team_lead`, `admin`, `skillhub` | `updateMeetings` (`:455`) | set `meetingsDone` (**same problem**) |
| GET | `/:id` | **any** | `getCommitment` (`:109`) | one commitment |
| PUT | `/:id` | `team_lead`, `admin`, `skillhub` | `updateCommitment` (`:252`) | update |
| DELETE | `/:id` | `admin` | `deleteCommitment` (`:378`) | delete |

#### Business rules enforced server-side

These are the rules a new developer will otherwise trip over. All of them are in the controller,
not the schema.

| Rule | Where | Behaviour |
|---|---|---|
| **`commitmentDate` fallback** | `ensureCommitmentDate` (`:141`) | if the body omits `commitmentDate`, it is set to `weekStartDate`. Defends against stale client bundles. |
| **No cross-week backdating** | `validateCommitmentDateInWeek` (`:151`) | for `team_lead` only, `commitmentDate` must be in `[weekStartDate, weekEndDate]` → else `400 "Commitment date must fall within the selected week"`. **`skillhub` is exempt** (`:188–193`, so branches can backfill history); admin is exempt. |
| **Auto-close** | create `:206–224`, update `:270–294` | `leadStage === 'Admission'` **and** `status === 'achieved'` ⇒ `admissionClosed = true`, `status = 'achieved'`, `achievementPercentage = 100`, `admissionClosedDate = now`. On update the incoming patch is merged over the stored doc first, so flipping only `status` still triggers it. `closedAmount` is **not** set — revenue stays 0 until someone edits it. |
| **Closing is irreversible** | update `:296–302` | sending `admissionClosed: false` on an already-closed row → `400 "Cannot reopen a closed admission - this action is irreversible"`. A closed row also cannot be moved off `status: 'achieved'` → `400 "This admission is closed - its status stays Achieved"` (`:309–318`). |
| **`demos[]` is Skillhub-only** | create `:226–236` | validated/normalised by `normalizeDemos` for Skillhub orgs; **silently `delete`d** from LUC payloads. |
| **Ownership from token** | create `:176–204` | `team_lead`/`skillhub` creates always stamp `teamLead`, `teamName`, `organization` from `req.user`. Admin **must** supply `teamLead` + `teamName` or gets `400`. |

`GET /date-range` and `GET /consultant/:name/performance` filter on **`commitmentDate`**, not
`weekStartDate` (`:587`, `:634`) — this matters because `weekStartDate` is always a Monday, so a
month-boundary week would leak into the wrong month. Both push `endDate` to `23:59:59.999`.

`GET /consultant/:consultantName/performance` response is **not** the standard envelope:
`{ success, consultant: { name }, totalCommitments, monthlyStats: [...], allCommitments: [...] }`
(`:664–670`). It also accepts `?months` (default 3) when `startDate`/`endDate` are not both given
(`:610–623`).

`GET /ai-analysis` deliberately **removes the ownership clause for LUC team leads**
(`:687–689`) so a TL can benchmark against the whole org. Filters: `startDate`, `endDate`,
`teamLead` (admin only), `consultantName`, `leadStage`, `status`. Caps input at 1,000 commitments
(`:707`). Returns `{ success, analysis: "<markdown>" }`, and returns a friendly "no data" analysis
string rather than an error when nothing matches (`:711`).

`GET /linkable` params: `?consultantName`, `?search` (regex on `studentName`), `?limit` (default
50, capped 500). Hard-filters `organization: 'luc'` and `studentId: null` (`:525–534`), so a
Skillhub caller always gets an empty list.

---

### 6.5 Students — `/api/students`

Routes: [`server/routes/students.js`](../../server/routes/students.js) ·
Controller: [`server/controllers/studentController.js`](../../server/controllers/studentController.js)

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/stats` | `admin`, `team_lead`, `manager`, `skillhub` | `getStudentStats` (`:758`) | KPI overview block |
| GET | `/programs` | `admin`, `team_lead` | `getPrograms` (`:80`) | distinct LUC `program` values |
| GET | `/` | `admin`, `team_lead`, `manager`, `skillhub` | `getStudents` (`:96`) | list, heavily filtered |
| POST | `/` | `admin`, `team_lead`, `skillhub` | `createStudent` (`:286`) | create |
| PATCH | `/:id/activate` | `admin`, `skillhub` | `activateStudent` (`:641`) | Skillhub: new_admission → active, collecting extra fields |
| PATCH | `/:id/status` | `admin`, `skillhub` | `changeStudentStatus` (`:706`) | Skillhub: any status transition |
| GET | `/:id` | `admin`, `team_lead`, `manager`, `skillhub` | `getStudent` (`:253`) | one student |
| PUT | `/:id` | `admin`, `team_lead`, `skillhub` | `updateStudent` (`:468`) | update |
| DELETE | `/:id` | `admin`, `team_lead`, `skillhub` | `deleteStudent` (`:608`) | hard delete |

#### `GET /` query parameters (all optional, all `studentController.js:98–216`)

| Param | Effect |
|---|---|
| `startDate`, `endDate` | date window. **Which field it filters is inferred**: `createdAt` for Skillhub scope, `closingDate` for LUC (`:141–147`). Either bound alone works. `endDate` is pushed to end-of-day. |
| `consultant` | exact `consultantName`; comma-separated becomes `$in` |
| `university`, `program`, `source` | exact match |
| `team` | **admin only**; comma-separated `teamName` `$in` |
| `month` | comma-separated `$in` on the denormalised `month` string |
| `search` | case-insensitive regex on `studentName`, **regex-escaped** (`:186`) |
| `studentStatus` | `new_admission` / `active` / `inactive` |
| `curriculumSlug` | Skillhub; `CBSE`/`IGCSE` also match legacy rows that only stored `curriculum` (`:107–130`) |
| `conversionOperator` + `conversionDays` | `gt`/`lt` on `conversionTime` |
| `page`, `limit` | pagination; `limit` capped at 500 |
| `organization` | admin only, via `buildScopeFilter` |

#### The LUC zero-fee hide — the single most important behaviour on this endpoint

`applyHideLucZeroFeeFilter(filter)`
([`studentController.js:58–74`](../../server/controllers/studentController.js)) is applied to
**every** student list and aggregate query, and is re-used by the Export Center builders and the
reconciliation controller (`reconciliationController.js:3`). It appends
`{ $or: [ { organization: { $ne: 'luc' } }, { admissionFeePaid: { $gt: 0 } } ] }`, hiding ~626 LUC
rows where an importer bug left `admissionFeePaid = 0`.

**There is no toggle and no query param to disable it.** Those rows exist in MongoDB and in the
backup dump under `server/dumps/`, but no API surface returns them. If someone reports "the student
count is lower than the database", this is why. The function **mutates** the filter object it is
given and also returns it — callers rely on the mutation.

`GET /stats` accepts the same filters as `GET /` and returns
`{ success, data: { overview: { totalStudents, totalRevenue, totalPaid, totalOutstanding,
avgConversionTime, minClosingDate, maxClosingDate, minCreatedAt, maxCreatedAt, consultantCount,
universityCount } } }` (`:880–941`). `avgConversionTime` **excludes rows over 90 days**
(`:888–897`) because legacy imports contain 700-day outliers — the other KPIs in the same response
do not exclude them, so the numbers are intentionally not mutually consistent.

`POST /` runs `validateStudentPayload` first (`:16`) — LUC money guard: total paid must not exceed
`courseFee`, and `admissionFeePaid` alone must not exceed `courseFee` (`:40–48`), returning `400`
with an AED-formatted message. Non-admins get `teamLead`/`teamName`/`organization` from the token;
admin **must** send `teamLeadId` (`:334`). `sno` auto-increments per team (LUC) or per org
(Skillhub) inside the model.

`PATCH /:id/activate` (Skillhub only, `400` for LUC rows, `400` if already active) additionally
accepts `{ addressEmirate?, registrationFee?, dateOfEnrollment?, emis? }` (`:672–681`) — this is
the "collect the rest of the paperwork at activation" step. `PATCH /:id/status` is the generic
version, accepts `{ studentStatus }` ∈ `new_admission|active|inactive`, is a no-op 200 when the
status already matches, and is Skillhub-only too.

`PUT /:id` merges the patch over the stored document before validating (`:487–495`) so a partial
update is checked against its would-be final state.

**Schema trap that bites on update, not create:** `Student.js` marks LUC-only fields with
`required: lucOnly` (a validator function, e.g. `models/Student.js:90`, `:112`) and Skillhub-only
fields with `required: skillhubOnly` (`:145`, `:151`, `:154`). `findByIdAndUpdate` runs validators in *query* context, where
`this.organization` is `undefined`, so **every `required: lucOnly` / `required: skillhubOnly` rule
silently passes on update**. `meetingController.updateMeeting` re-checks `program` in JS for this
exact reason (`meetingController.js:299–314`); the equivalent re-checks for `Student` are **not**
all present. Treat any conditional-required field as unenforced on `PUT`.

---

### 6.6 Meetings — `/api/meetings`

Routes: [`server/routes/meetings.js`](../../server/routes/meetings.js) ·
Controller: [`server/controllers/meetingController.js`](../../server/controllers/meetingController.js)

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | `admin`, `team_lead`, `skillhub` | `getMeetings` (`:55`) | paginated list |
| POST | `/` | `admin`, `team_lead`, `skillhub` | `createMeeting` (`:202`) | create |
| GET | `/stats` | `admin`, `team_lead`, `skillhub` | `getMeetingStats` (`:135`) | lean rows for the KPI strip |
| GET | `/ai-analysis` | `admin`, `team_lead` | `getAIAnalysis` (`:378`) | OpenAI narrative — **LUC-shaped, no Skillhub UI calls it** |
| GET | `/:id` | `admin`, `team_lead`, `skillhub` | `getMeeting` (`:173`) | one meeting |
| PUT | `/:id` | `admin`, `team_lead`, `skillhub` | `updateMeeting` (`:274`) | update |
| DELETE | `/:id` | `admin` | `deleteMeeting` (`:339`) | delete |

Shared query params for `/`, `/stats` and `/ai-analysis`: `startDate`, `endDate` (end-of-day
pushed), `teamLead` (**admin only** — guarded so it can't collide with a TL's own scope, `:87`),
`consultant`, `status`, `mode`. `/` additionally takes `search` (regex-escaped on `studentName`),
`page`, `limit` (default 20, **capped at 20,000** because the tracker defaults to "show all",
`:73`).

`GET /` always returns a `pagination` block. `GET /stats` returns only
`{ meetingDate, status }` per row, unpaginated — deliberately small so the KPI strip reflects the
whole window rather than one page.

**LUC admission invariant** (`createMeeting`, `:229–262`): a LUC meeting with `status: 'Admission'`
must either carry a valid `commitmentId` **or** set `manualEntry: true` **with** a non-empty
`manualEntryReason`. Otherwise `400 "Pick a linked commitment or enable Manual Entry with a
reason"`. Manual rows then surface on the reconciliation page. Skillhub bypasses the whole check.

**The `program` update trap** (`:299–314`): the schema's `required: lucOnly` on `program` cannot
fire under `findByIdAndUpdate` (query context ⇒ `this.organization === undefined`), so the
controller re-checks it against the *stored* document's org and returns `400 "Program is
required"`. This is the canonical example of the conditional-required trap — copy this pattern for
any similar field you add. Specs: `server/tests/meetings/meetings.test.js`.

Non-admins cannot reassign ownership: `teamLead` and `organization` are stripped from the body
(`:293–296`).

`Meeting.demoDoneBy` is a plain name string sourced from `GET /api/institute/teachers`, and is only
rendered when the viewing org is `skillhub_institute` — a Training login 403s on the teachers
endpoint. Admin-created Skillhub meetings derive `teamLead` from the chosen counsellor's populated
`teamLead._id`, because an admin has no branch token of their own.

---

### 6.7 Hourly Tracker — `/api/hourly`

Routes: [`server/routes/hourly.js`](../../server/routes/hourly.js) ·
Controller: [`server/controllers/hourlyController.js`](../../server/controllers/hourlyController.js)

**`router.use(protect)` and nothing else — there is no `authorize()` anywhere in this file**
(`hourly.js:24`, with the comment "All routes require authentication (any role)"). Scoping is
entirely inline.

| Method | Path | Controller | Purpose | Key params |
|---|---|---|---|---|
| GET | `/ai-analysis` | `getAIAnalysis` (`:1087`) | OpenAI day analysis | `?date` (required) |
| GET | `/leaderboard` | `getLeaderboard` (`:1315`) | AI daily leaderboard | `?date` (required), `?groupBy=team` |
| GET | `/leaderboard/weekly` | `getWeeklyLeaderboard` (`:1616`) | Mon–Sun leaderboard | `?date`, `?groupBy=team` |
| GET | `/consultants` | `getConsultants` (`:231`) | tracker grid rows | `?scope=org` (team_lead escape hatch) |
| GET | `/day` | `getDayActivities` (`:261`) | all slots for a day | `?date` (required) |
| PUT | `/slot` | `upsertSlot` (`:285`) | write one slot | body |
| DELETE | `/slot` | `clearSlot` (`:463`) | clear a slot + continuations | **body** |
| DELETE | `/day` | `clearDay` (`:522`) | clear a whole day | `?date` (required) |
| GET | `/month` | `getMonthActivities` (`:560`) | month of slots | `?year&month` (**`month` is 0-based**) |
| GET | `/admissions` | `getDayAdmissions` (`:589`) | daily admission counts | `?date` |
| PUT | `/admissions` | `upsertAdmission` (`:611`) | set a count | body `{ consultantId, date, count }` |
| GET | `/admissions/month` | `getMonthAdmissions` (`:668`) | month rollup | `?year&month` |
| GET | `/references` | `getDayReferences` (`:695`) | daily reference counts | `?date` |
| PUT | `/references` | `upsertReference` (`:715`) | set a count | body `{ consultantId, date, count }` |
| GET | `/references/month` | `getMonthReferences` (`:763`) | month rollup | `?year&month` |

Things that will surprise you:

- **`DELETE /slot` takes a JSON body** (`{ consultantId, date, slotId }`, `:465`). The client sends
  it via axios `{ data }` (`client/src/services/hourlyService.js:42`). Some proxies drop DELETE
  bodies — if slot-clearing mysteriously stops working behind a new proxy, that's the cause.
- **`?month` is 0-based** — `new Date(Date.UTC(y, m, 1))` (`:572`). `month=0` is January. The
  admissions/references month endpoints use the same convention.
- **`hourlyScopeFilter` deliberately drops the ownership clause** (`:18–21`): `const { teamLead,
  ...rest } = buildScopeFilter(req)`. A `team_lead` sees and can edit **the whole organisation's**
  hourly grid. That is the intended product behaviour, but combined with "no `authorize()` on this
  router" it means a `manager` (org `luc`) can also read and write LUC hourly data. See §10.
- `DELETE /day` refuses non-admins on any date other than today
  (`403 "Can only clear today's data"`, `:531`), and skips `LOCKED_TYPES` slots for non-admins
  (`:547`; the list itself — `call`, `followup`, `call_followup` — is at `:103`).
- `getConsultants` hides "self-consultant" rows — a consultant record whose name equals its team
  lead's, holding the lead's personal sales (`excludeSelfConsultants`, `:250`).
- The org being viewed is `resolveViewOrg(req)` (`:786`): admin uses `?organization=` defaulting to
  `'luc'`; everyone else uses their own org. Skillhub orgs branch into entirely separate
  aggregation + prompt paths (`runSkillhubAnalysis` / `runSkillhubLeaderboard`).
- All three AI endpoints (`/ai-analysis`, `/leaderboard`, `/leaderboard/weekly`) return
  `{ success: true, data: "<markdown string>" }` — `data` is a
  **string**, not an object — and return a plain "No activity data found for this date." string
  (still 200) when there is nothing to analyse.
- `HourlyActivity` has two shapes: legacy flat (`activityType`/`count`/`duration`, LUC) and
  `activities[]` (Skillhub multi-activity). `upsertSlot` normalises both into one `items` list
  (`:305–322`). Anywhere else that reads activities must use `getActivityItems`
  (`hourlyController.js:113–125` — note CLAUDE.md still cites the pre-refactor line 88–103) or, in aggregation pipelines,
  `normalizeHourlyActivities` (`server/services/exports/pivots/_shared.js`). **Do not write a third
  normaliser.**

---

### 6.8 Skillhub Institute — `/api/institute`

Routes: [`server/routes/institute.js`](../../server/routes/institute.js) ·
Controller: [`server/controllers/instituteController.js`](../../server/controllers/instituteController.js)

Two gates apply to **every** route here:

1. Route level: `router.use(protect)` then `router.use(authorize('admin', 'skillhub'))`
   (`institute.js:58–59`).
2. Controller level: `assertInstitute(req, res)` (`instituteController.js:22–28`) — admin always
   passes; a `skillhub` login passes **only if its own organisation is `skillhub_institute`**.
   A Training branch login gets `403 "Restricted to Skillhub Institute."`.

Every query and every write is pinned to `organization: 'skillhub_institute'` (the `INSTITUTE`
constant, `:19`). There is no way to reach another org's data through this router.

#### Teachers

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | `/teachers` | `getTeachers` (`:33`) | `?active=true` filters to active. `{ success, count, data }` |
| POST | `/teachers` | `createTeacher` (`:45`) | body `{ name (required), subjects? }` → 201 |
| PUT | `/teachers/:id` | `updateTeacher` (`:65`) | body `{ name?, subjects?, isActive? }` |
| DELETE | `/teachers/:id` | `deleteTeacher` (`:82`) | **soft delete** (`isActive = false`) — timetable rows denormalise `teacherName`, so history survives |

#### Timetable

| Method | Path | Controller | Notes |
|---|---|---|---|
| POST | `/timetable/import` | `importTimetable` (`:205`) | multipart; rate-limited 10/min; see below |
| GET | `/timetable` | `getTimetable` (`:98`) | `?teacher`, `?gradeOrYear`; sorted by `dayOfWeek`,`startMinutes` |
| POST | `/timetable` | `createTimetableEntry` (`:128`) | requires `teacher`, `dayOfWeek`, `time`; `startMinutes` is derived by `parseStartMinutes` (`:113`) |
| PUT | `/timetable/:id` | `updateTimetableEntry` (`:158`) | changing `teacher` re-denormalises `teacherName` |
| DELETE | `/timetable/:id` | `deleteTimetableEntry` (`:186`) | hard delete |

**`POST /timetable/import` — the most complex endpoint in the codebase.** Read this before touching
it.

- Upload field name: **`file`**. Multer memory storage, **8 MB cap**, `files: 1`, `fields: 10`,
  `parts: 15`; extension allowlist `.xlsx|.xlsm|.xls|.csv` (`institute.js:13–25`). Multer errors
  are translated into the app envelope by the `uploadSchedule` wrapper (`:40–53`):
  `413` for oversize, `400` for wrong type or any other MulterError.
- Body field **`dryRun`** arrives as the *string* `'true'`/`'false'` (multipart), compared as such
  (`instituteController.js:212`). `dryRun=true` parses and reports, writing nothing.
- One **sheet per teacher**, sheet name = teacher name. Teachers are matched
  case-insensitively, created if new, **re-activated** if previously soft-deleted, and their
  `subjects` are unioned so manual additions survive a re-import (`:344–366`).
- **Applying replaces only the teachers present in the file.** One teacher's upload can never wipe
  another's schedule.
- **Every row is validated before the first write** (`:304–332`) — a bad row anywhere rejects the
  whole upload with `400` and zero writes. There is **no transaction**; within a teacher the order
  is capture-old-ids → `insertMany(new)` → `deleteMany(old)`, so a mid-flight failure leaves
  *duplicates* (visible, fixable) rather than an emptied schedule, and the 500 response names
  exactly which teachers were already updated (`:396–405`).
- **Merged Day cells are normal and must keep working.** Excel merges the Day column down each
  day's block, so continuation rows arrive blank and the parser forward-fills the last day. A
  *non-blank* day cell that cannot be parsed is reported in `warnings` with its Excel row number —
  never dropped silently. Parser: `server/services/institute/scheduleParser.js` (pure: Buffer in,
  `{ teachers, timetable, warnings }` out), shared with
  `server/scripts/importInstituteFromExcel.js`. Specs: `server/tests/institute/scheduleImport.test.js`.
- Response `data` (both modes): `{ teachers: [{ name, sessions, subjects, isNew }], totalSessions,
  grades, subjects, unmatchedStudents, warnings, replacingSessions, applied }`, plus `inserted`
  when applied (`:270–283`, `:407`).

#### Students, birthdays, roster, attendance

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | `/students` | `getInstituteStudents` (`:504`) | institute students for the "add to class" picker; grade labels returned verbatim (they are inconsistent in the source data and are never auto-matched) |
| GET | `/birthdays` | `getUpcomingBirthdays` (`:488`) | `?days` (default 45, clamped 1–365) |
| GET | `/attendance/meta` | `getAttendanceMeta` (`:417`) | `{ gradesOrYears, subjects }`. Grades are data-derived; **subjects come from the canonical list** `config/instituteSubjects.js`, not `distinct()` — deriving them is what let duplicate spellings back in |
| GET | `/attendance/roster` | `getRoster` (`:445`) | `?gradeOrYear` (required), `?subject`. Union of `InstituteEnrollment` + `Attendance` + `TestRecord` |
| POST | `/attendance/roster` | `addRosterStudent` (`:520`) | body `{ gradeOrYear, subject, studentName, student? }` — **`subject` is required**; idempotent upsert → 201 |
| DELETE | `/attendance/roster` | `removeRosterStudent` (`:554`) | **body** `{ gradeOrYear, studentName, subject? }`. Without `subject` it removes the student from **every** subject in that grade, deleting enrollments **and** attendance **and** test records |
| DELETE | `/attendance/entry` | `deleteAttendanceEntry` (`:688`) | **body** `{ gradeOrYear, studentName, date, subject? }` — cancels **one** mark |
| DELETE | `/attendance/student` | `deleteAttendanceStudent` (`:724`) | **body** `{ gradeOrYear, studentName }` — wipes all their attendance in that grade |
| GET | `/attendance` | `getAttendance` (`:583`) | `?gradeOrYear`, `?subject`, `?studentName`, `?date` **or** `?startDate&endDate` |
| POST | `/attendance` | `markAttendance` (`:614`) | bulk mark; see below |

`POST /attendance` body: `{ date, gradeOrYear, subject?, curriculum?, teacher?, teacherName?,
entries: [{ studentName, student?, status: 'Present'|'Absent' }] }`. It is **delete-then-insert**
for the exact `(date @ UTC midnight, gradeOrYear, subject)` key (`:632–638`), so re-marking a
session is clean and idempotent. The delete uses `subjectMatchCondition(subject)` so legacy
spellings ("Maths") are replaced when re-marked canonically ("Math"). Marking a student also
best-effort upserts an `InstituteEnrollment` (`:657–673`) so a roster built purely by marking
self-heals.

Why `removeRosterStudent` deletes from three collections: the roster is the *union* of enrollments,
attendance and test records, so leaving any one behind puts the student straight back on the list.
That is exactly why a student who landed in the wrong grade via a stray test result used to be
undeletable.

#### Tests

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | `/tests/meta` | `getTestMeta` (`:766`) | `{ gradesOrYears, subjects }` — same canonical-subject rule as attendance |
| GET | `/tests` | `getTests` (`:785`) | `?gradeOrYear`, `?subject`, `?teacherName`, `?studentName`, `?date` or `?startDate&endDate`. Unparseable dates return **400**, not a CastError-404 (`:802–806`) |
| POST | `/tests` | `createTests` (`:833`) | bulk save; **upsert per student**, not delete-then-insert |
| PUT | `/tests/:id` | `updateTest` (`:908`) | single-row edit; **does** run validators via `row.save()` |
| DELETE | `/tests/:id` | `deleteTest` (`:940`) | hard delete |

`POST /tests` body: `{ date, gradeOrYear, curriculum?, subject?, testTopic?, maxMarks?, teacher?,
teacherName?, entries: [{ studentName, student?, marksObtained }] }`. Response is
`{ success, count }` — **the count of upsert operations, not of documents written**.

Two rules that must stay in step:

1. **The upsert key is `(organization, date@UTC-midnight, gradeOrYear, subject, testTopic,
   studentName)`** and is backed by a unique compound index, so a double-click cannot race two
   inserts. `bulkWrite` runs `ordered: false` and an all-`E11000` failure is swallowed as benign
   (`isAllDuplicateKeyError`, defined `:756`, applied `:897`). Re-recording a session only touches the students in the
   payload — remove a stray result with the per-row `DELETE`.
2. **`bulkWrite` upserts do not run Mongoose validators** (not even with `runValidators`). The
   schema's `min: 0` on marks is enforced by the JS guard `toNonNegativeNumber()` (defined `:746`,
   applied `:851`/`:860`), which
   trims whitespace (`'  '` → skipped, not `0`) and drops negatives. `updateTest` uses `row.save()`
   and *does* validate. **Keep the two paths in step.** Specs:
   `server/tests/institute/tests.test.js`.

Every institute write emits a Socket.IO event (`institute:teacher` / `institute:timetable` /
`institute:attendance` / `institute:test`) — **which no client currently listens for**. See §8.

---

### 6.9 Export Center — `/api/exports`

Routes: [`server/routes/exports.js`](../../server/routes/exports.js) ·
Controller: [`server/controllers/exportController.js`](../../server/controllers/exportController.js)

| Method | Path | Rate-limited | Controller | Purpose |
|---|---|---|---|---|
| POST | `/raw` | no | `getRaw` (`:62`) | cursor-paginated rows |
| POST | `/pivot` | **5/min** | `getPivot` (`:154`) | server-side pivot |
| GET | `/dimensions/:dataset` | no | `getDimensions` (`:106`) | legal dimensions + measures + in-scope distinct values |
| GET | `/templates` | no | `listTemplates` (`:198`) | pre-built catalogue filtered by role |
| POST | `/template/:templateId` | **5/min** | `runTemplate` (`:215`) | run a multi-sheet template |
| GET | `/saved-templates` | no | `listSavedTemplates` (`:293`) | own saved Pivot Builder configs |
| POST | `/saved-templates` | no | `createSavedTemplate` (`:304`) | save one |
| DELETE | `/saved-templates/:id` | no | `deleteSavedTemplate` (`:336`) | delete own |

#### The permission matrix

`assertDatasetAccess(user, dataset, organization)`
([`exportController.js:13–51`](../../server/controllers/exportController.js)) is a hard-wired
matrix, and it is the **only** place this policy lives:

| Dataset | Allowed roles | Date field used by filters |
|---|---|---|
| `students` | `admin`, `team_lead` (LUC own team), `manager`, `skillhub` (own branch) | `closingDate` (LUC) / `createdAt` (Skillhub + `all`) |
| `commitments` | `admin`, `team_lead`, `skillhub` | `commitmentDate` |
| `meetings` | `admin`, `team_lead` | `meetingDate` |
| `hourly` | `admin`, `team_lead`, `skillhub` | `date` |

Plus four explicit rules:

- `team_lead` is locked to `organization === 'luc'` (`:25`).
- **Manager Export Center exception** (`:30`): `manager` keeps `User.organization = 'luc'`
  everywhere else in the app, but on `/exports` it may pick LUC / Skillhub Training / Skillhub
  Institute / `all` — **on the `students` dataset only**. Any other dataset → 403.
- `skillhub` is locked to its own branch (`:35`).
- `organization: 'all'` is `admin`/`manager` only (`:41`). Legal orgs:
  `luc | skillhub_training | skillhub_institute | all` (`:9`).

Errors thrown here carry `err.statusCode` and are caught in the controller (`:97–102`), so they
never reach the global handler.

#### Request/response shapes

`POST /raw` body: `{ dataset, filters, columns?, organization?, cursor?, limit? }`. `limit` is
clamped to 1–5000 per builder (`services/exports/pivots/students.js:204`). Response
`{ success, rows, nextCursor, totalEstimate, scopeNote }`. `nextCursor` is base64 JSON `{ lastId }`
sorted on `_id` ascending — a stable keyset cursor, not an offset. The client loops it up to a
100,000-row hard cap (`client/src/services/exportsApi.js:17`); the grid renders at most 10,000 with
a "download to see all" banner.

`POST /pivot` body: `{ dataset, filters, rowDim, colDim?, measure?, agg, organization? }`. Response
`{ success, cells, rowOrder, colOrder, rowTotals, colTotals, grandTotal, scopeNote }`. Flattening
that envelope into sheet rows is done **only** by `pivotResultToSheet` in
`client/src/services/xlsxBuilder.js` — three call sites share it; do not write a second flattener.

`GET /dimensions/:dataset?organization=` → `{ success, dataset, orgScope, dimensions, measures }`.
Dimensions of `kind: 'distinct'` are resolved to actual in-scope values by the builder
(`:129–142`), which is why the client never hard-codes enums.

`POST /template/:templateId` body `{ filters?, organization? }` → a JSON envelope
`{ success, templateId, name, dataset, organization, orgScope, sheets: [...] }` where each sheet is
`{ name, kind: 'raw'|'pivot', ... }`; the client serialises it to a multi-sheet xlsx. 26 templates
are registered in `server/services/exports/templates.js` — students ×18 (LUC ×8, Skillhub Training
×6, cross-org `all` ×4), commitments ×4, meetings ×2, hourly ×2, every one of the non-students
templates being LUC — each with its own `roles` allowlist checked at `:221`. Raw
sheets inside templates are capped at 5,000 rows (`:251`).

`POST /saved-templates` body `{ name, dataset, config, organization? }` → 201.
`409` on duplicate `(user, name)`; **`429`** once the user holds 200
(`:313–319`). `DELETE /saved-templates/:id` is owner-only and returns 404 for someone else's.

#### Two data rules that live in the builders

- **Skillhub `outstandingAmount` is a Mongoose virtual, and virtuals do not survive `.lean()` or
  `$group`.** Every Skillhub builder must call `withSkillhubFinancials(pipeline)`
  (`services/exports/pivots/_shared.js`) before grouping — it `$addFields` `emiPaid`,
  `totalPaidPerStudent`, `outstandingPerStudent`, `overdueEmiCount`. Bypassing it silently produces
  zeros.
- **`subjects` is an array, so `agg=count` after `$unwind` counts subject-enrolments, not
  students.** The UI shows a disclaimer; `agg=distinct` (`$addToSet: '$_id'` then `$size`) gives
  true student counts.

LUC sheets that surface `admissionFeePaid` (as a raw column or a pivot measure) get a row-1
disclaimer about the mixed net-/gross-of-VAT entries. Sheets without that field, and all Skillhub
sheets, get none.

Adding a dataset is a 7-step checklist — see the "Adding a new dataset" section of `CLAUDE.md`;
step 2 (`getBuilder()`, `exportController.js:53`) and step 3 (`assertDatasetAccess`) are the two
that will silently 501/403 if you forget them.

---

### 6.10 AI analysis — `/api/ai`

Routes: [`server/routes/ai.js`](../../server/routes/ai.js) ·
Controller: [`server/controllers/aiController.js`](../../server/controllers/aiController.js) ·
`router.use(protect)` at `ai.js:14`.

| Method | Path | Roles | Controller | Body / params |
|---|---|---|---|---|
| POST | `/analysis` | `admin`, `team_lead`, `skillhub` | `generateDashboardAnalysis` (`:20`) | `{ startDate, endDate }` (both required) |
| POST | `/student-analysis` | `admin`, `team_lead`, `skillhub` | `generateStudentAnalysis` (`:469`) | `{ startDate, endDate, curriculumSlug?, organization? }` (`organization` honoured for admin only, via `resolveOrganization`) |
| GET | `/analysis-targets` | `admin` | `getAnalysisTargets` (`:119`) | `?startDate&endDate` |
| POST | `/team-analysis` | `admin` | `generateTeamAnalysis` (`:140`) | `{ startDate, endDate, teamLeadId }` |
| POST | `/consultant-analysis` | `admin` | `generateConsultantAnalysis` (`:224`) | `{ startDate, endDate, consultantName, organization? }` |
| GET | `/usage` | `admin` | `getUsageStats` (`:313`) | — |

All the generate endpoints return **`{ success: true, analysis: "<markdown>" }`** — the key is
`analysis`, not `data`. When the aggregation finds nothing they return **200** with an explanatory
`analysis` string rather than an error (`:37`, `:161`, `:243`, `:504`).

Scoping inside `POST /analysis` (`:34–71`) is three-way:
`admin` → org-wide across all tenants; **LUC `team_lead` → org-wide LUC** (so they can benchmark
against other teams); `skillhub` (and any non-LUC `team_lead`) → own branch via the `teamLead` FK.

Error mapping shared by all four generate endpoints:
missing `OPENAI_API_KEY` → **503**; upstream 429 → **502**
(`:95–108`). Every successful call writes an `AIUsage` row asynchronously (`:78–90`) — that is what
`GET /usage` reports on, and it is the only cost telemetry in the system.

`GET /usage` returns `{ success, data: { summary, byTeam, byUser, daily, recentCalls } }`
(`:454`). It reads **every** `AIUsage` document with no date bound (`:315`) and aggregates in
Node — fine today, will get slow. Legacy rows written before the chatbot shipped have no `type`
field and are coerced to `'analysis'` in this endpoint (`:327`).

---

### 6.11 Tracker chat — `/api/chat`

Routes: [`server/routes/chat.js`](../../server/routes/chat.js) ·
Controller: [`server/controllers/chatController.js`](../../server/controllers/chatController.js)

`router.use(protect)` with **no role check** — the deliberate product decision recorded at
`chat.js:15–16`: "every authenticated user can query anything via chat".

| Method | Path | Controller | Purpose |
|---|---|---|---|
| POST | `/stream` | `streamChat` (`:26`) | **SSE** chat turn — see [§7](#7-sse-streaming-endpoints) |
| POST | `/transcribe` | `transcribeAudio` (`:114`) | multipart voice → text (Whisper) |
| GET | `/conversations` | `listConversations` (`:68`) | own threads, last 50 |
| GET | `/conversations/:id` | `getConversation` (`:83`) | full history, own only |
| DELETE | `/conversations/:id` | `deleteConversation` (`:174`) | own only |
| POST | `/classify` | inline (`chat.js:37`) | route a query to `tracker` or `docs` |

`POST /stream` body `{ message, conversationId? }`. Missing/blank `message` → `400` **before** any
SSE headers are set (`:29`). Every conversation read/write is filtered by `user: req.user._id`, so
cross-user access is impossible.

`GET /conversations/:id` **strips `role === 'tool'` messages** before returning (`:94`) so the UI
never sees raw tool JSON. Bear that in mind when debugging: the API response is not the full stored
document.

`POST /transcribe` — multipart, field name **`audio`**, memory storage, **25 MB cap**
(`chat.js:22–25`, matching Whisper's own limit). The file extension handed to OpenAI is inferred
from the mime type (`:130–136`) because Whisper detects format by filename. No language parameter
is sent — Whisper auto-detects, which is why counsellors can dictate in Hindi/Malayalam/Arabic.
Nothing is written to disk. Responses: `{ success, text }`; `400` no file; `503` no
`OPENAI_API_KEY`; `502` upstream 429; `413` upstream 413.

`POST /classify` body `{ query }` → `{ success, route: 'tracker'|'docs', cached }`. Backs the
client's `classifyQuery` when its keyword rules are ambiguous. It **never throws** — any transport
error degrades to `route: 'tracker'` (`classifierService.js:126`). Groq primary, OpenAI fallback,
with a 1-hour in-memory cache.

The chat agent's tool surface (13 tools) is defined in
[`server/services/chatTools.js`](../../server/services/chatTools.js): `search_people`,
`list_team_leads`, `get_team_roster`, `get_commitments`, `commitment_stats`, `leaderboard`,
`get_meetings`, `get_students`, `get_revenue`, `get_hourly_attendance`,
`get_absent_consultants`, `get_daily_admissions`, `today_snapshot`. Tool names appear in the
`tool-start`/`tool-end` SSE frames.

---

### 6.12 Docs RAG chat — `/api/docs-chat`

Routes: [`server/routes/docsChat.js`](../../server/routes/docsChat.js) — this file contains its own
controller logic inline; there is no `docsChatController.js`. Service:
[`server/services/docsRagService.js`](../../server/services/docsRagService.js).

| Method | Path | Auth | Roles | Kill switch | Purpose |
|---|---|---|---|---|---|
| GET | `/health` | ❌ **public** | — | **exempt** | readiness probe (`:61`) |
| GET | `/stats` | ✅ | `admin` | **exempt** | corpus + cache + tier dashboard (`:121`) |
| POST | `/admin/reingest` | ✅ | `admin` | applies | shells `scripts/ingestProgramDocs.js` (`:78`) |
| POST | `/feedback` | ✅ | any | applies | thumbs up/down on an answer (`:275`) |
| POST | `/` | ✅ | any role, **LUC org only** (`orgGate('luc')`) | applies | **SSE** consultant query (`:320`) |

**Kill switch:** `DOCS_RAG_ENABLED=false` (or `config.enabled === false`) makes every route except
`/health` and `/stats` return `503` with a user-facing message
([`middleware/docsRagEnabled.js:13–24`](../../server/middleware/docsRagEnabled.js), wired at
`docsChat.js:20–23`). It reads `process.env` live on every request, so the effective lever in
production is flipping the Render env var and letting the service restart. It is mounted **before**
`protect` on the static `/program-docs` mounts so "disabled" does not leak the 401-vs-403
distinction.

`POST /` body `{ query, studentId?, leadId?, programHint? }`. Guards, in order:
blank `query` → `400`; index not loaded → **`503` "Docs RAG index is still loading"** (`:329`);
then SSE headers are flushed and the answer streams. Lead context is resolved by
`resolveLeadContext` (`:26`), which loads the Student, checks `organization === 'luc'` **and** that
the caller is admin or the owning team lead, and maps the free-text `program` to a slug. Falls back
to `programHint` if it is a known program.

`POST /admin/reingest?force=true` spawns `node server/scripts/ingestProgramDocs.js [--force]` as a
child process, then calls `docsRag.loadChunks()` to hot-reload the in-memory index
(`:93–117`). Response includes `exitCode` and the last 4 KB of stdout (and 2 KB of stderr on
failure). **This is a synchronous shell-out on the single Node process** — the API is sluggish
while it runs.

`GET /stats` returns `{ success, data: { chunks, chunkCountsByProgram, cache, cacheStats24h,
tierDistribution24h, avgLatencyByTier24h, topQueries7d, lowConfidenceQueries24h,
refusalQueries24h, lastIngestAt, loadedAt } }` (`:249–268`). The `refusalQueries24h` table
(`tier: 3`) is the corpus-gap signal — those are questions the docs could not answer.

`POST /feedback` body `{ logId, rating: 'up'|'down', comment? }`. Non-admins may only rate their
own log rows (`:286–291`); comment is truncated to 500 chars. `404` if no matching log.

The three answer tiers (`docsRagService.js`): **tier 1** = exact question-match from the QNA
question index (cheap, no LLM); **tier 2** = hybrid retrieval (cosine + BM25, RRF-fused) then
generation via Groq with OpenAI fallback; **tier 3** = refusal, with the fixed string
`"I don't have that in the program documents. Please check with your team lead."`
(`docsRagService.js:444`). Answers are cached in `QueryCache` for 24 h keyed on
`sha1(normalize(query) + '|' + programFilter)`.

---

### 6.13 Executive Overview — `/api/exec-overview`

Routes: [`server/routes/execOverview.js`](../../server/routes/execOverview.js) ·
Controller: [`server/controllers/execOverviewController.js`](../../server/controllers/execOverviewController.js)

`router.use(protect)` then **`router.use(orgGate('luc'))`** (`execOverview.js:13–14`) — the whole
feature is LUC-only; any Skillhub or non-LUC user gets `403 "This resource is restricted to luc
users."`.

| Method | Path | Roles | Controller | Params |
|---|---|---|---|---|
| GET | `/teams` | `admin`, `team_lead` | `getTeams` (`:77`) | — |
| GET | `/consultant-performance` | `admin`, `team_lead` | `getConsultantPerformanceRankings` (`:63`) | `?year` |
| GET | `/team/:teamLeadId` | `admin`, `team_lead` | `getTeam` (`:42`) | `?year` |
| GET | `/` | `admin`, `team_lead` | `getOverview` (`:27`) | `?year`, `?month` |

`?year` is validated to 2020–2100, defaulting to the current UTC year (`:9–13`); `?month` to 1–12,
defaulting to `null` meaning "use the latest active month" (`:17–21`). Out-of-range values fall
back silently rather than erroring.

**Team leads may read *any* team's detail** — `getTeam` deliberately has no ownership check
(`:47–50`, with the comment explaining that writes are admin-only via `/api/team-entries`, so
read-only cross-team access is safe). If you add a write endpoint here, add the check.

`GET /teams` sorts "Team X"-prefixed names first so `teams[0]` (the default landing team) is always
a real active team rather than a departed lead (`:89–95`).

---

### 6.14 Team entries — `/api/team-entries`

Routes: [`server/routes/teamEntries.js`](../../server/routes/teamEntries.js) ·
Controller: [`server/controllers/teamEntryController.js`](../../server/controllers/teamEntryController.js) ·
`protect` + `orgGate('luc')` (`teamEntries.js:14–15`).

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/meta` | `admin`, `team_lead` | `getBucketMeta` (`:260`) | canonical bucket/column order |
| GET | `/` | `admin`, `team_lead` | `listEntries` (`:60`) | `?year`, `?teamLeadId` |
| POST | `/bulk` | **`admin`** | `bulkUpsert` (`:180`) | paste-from-Excel |
| PUT | `/` | **`admin`** | `upsertEntry` (`:81`) | one consultant × month |
| DELETE | `/:id` | **`admin`** | `deleteEntry` (`:247`) | remove a row |

**Reads are open to team leads; every mutation is admin-only** — the dashboard is treated as a
single admin-maintained source of truth (`teamEntries.js:17–20`).

`PUT /` body: `{ consultant, teamLead, year, month, ...editableFields, notes? }`. Only whitelisted
numeric fields (`monthlyTarget`, `achievedRevenue`, and every bucket slug from
`services/execOverview/bucketing.js`) plus `notes` are accepted; everything else — including
`organization` — is set server-side (`pickEditableFields`, `:45–55`). Non-finite or negative
numbers are dropped, not rejected. `month` must be 1–12, `year` 2020–2100, and the `teamLead` must
be a LUC user (`:97–99`). A duplicate-key race is caught and retried by re-reading the row
(`:154–170`).

Side effect: when an upsert **increases** any course-bucket count, an org-wide "new admission"
announcement is created (`announceTeamAdmission`, `:130–150`), which is what makes the banner pop
for everyone. It is strictly best-effort and never blocks the save.

`POST /bulk` body `{ rows: [...] }`, max 5,000 rows (`:186`). Returns
`{ success, data: { upserted, errors: [{ index, message }] } }` — it is **partially successful by
design**, so always inspect `errors`. One coalesced `teamEntry:bulk` socket event fires at the end
(`:236`).

---

### 6.15 Tier Fight — `/api/tiers`

Routes: [`server/routes/tiers.js`](../../server/routes/tiers.js) ·
Controller: [`server/controllers/tierController.js`](../../server/controllers/tierController.js) ·
`protect` + `orgGate('luc')` (`tiers.js:17–18`).

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | `admin`, `team_lead` | `getTiers` (`:178`) | tier config + MTD totals + trend + theme list; `?year` |
| GET | `/latest-image` | `admin`, `team_lead` | `getLatestImage` (`:295`) | newest poster (presigned S3 URL, inline base64 fallback) |
| GET | `/images` | `admin`, `team_lead` | `getImageHistory` (`:314`) | `?limit` (default 60, max 200) |
| POST | `/generate-image` | **`admin`** | `generateImage` (`:190`) | multipart; generates a poster via **gpt-image-2** |
| PUT | `/:tier` | **`admin`** | `updateTier` (`:351`) | replace a tier's member list |

`POST /generate-image` — multipart, optional base image on field **`image`**, 12 MB memory cap
(`tiers.js:12–15`). Form fields: `theme`, `title`, `message` (alias `thoughts`), `includeTiers`
(string `'false'` disables), plus `?year`. Returns `500` if `OPENAI_API_KEY` is unset (`:193`) —
note this one is a 500, not the 503 the `/api/ai` endpoints use for the same condition.

This is **the most expensive endpoint in the system** and it is not rate-limited. The PNG is
archived to S3 under `tier-images/YYYY/MM/DD/…` with an inline base64 fallback when S3 is
unconfigured (`:218–233`), an `AIUsage` row is written with `type: 'image'` and gpt-image-2 pricing
(`:247–270`), a `tier-image` socket event fires, and an org-wide announcement is created.

`PUT /:tier` — `:tier` must be `1`, `2` or `3` (else `400`, `:355`); body `{ members: [...] }`;
responds with the freshly rebuilt tier payload.

---

### 6.16 Payment plans — `/api/payment-plans`

Routes: [`server/routes/paymentPlans.js`](../../server/routes/paymentPlans.js) ·
Controller: [`server/controllers/paymentPlanController.js`](../../server/controllers/paymentPlanController.js) ·
`protect` + `orgGate('luc')` (`paymentPlans.js:16–17`).

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | `admin`, `team_lead` | `getPaymentPlans` (`:14`) | list, scoped |
| POST | `/` | `admin`, `team_lead` | `createPaymentPlan` (`:30`) | create from a linked LUC student |
| PUT | `/:id` | `admin`, `team_lead` | `updatePaymentPlan` (`:86`) | `{ status?, remarks? }` |
| DELETE | `/:id` | `admin`, `team_lead` | `deletePaymentPlan` (`:112`) | delete |

`POST /` body `{ studentId (required), status?, remarks? }`. Guards: student must exist (404),
must be LUC (`400 "Payment plans are LUC-only"`), must pass `canAccessDoc` (403), and must not
already have a plan (**409**, `:53`). Per-team scoping is `buildScopeFilter`/`canAccessDoc`, not
the route — both roles reach the same routes because the tab lives on the Tier Fight page they
already share.

All three mutations emit `paymentPlan:created|updated|deleted` — the only socket events with a
matching client listener outside the leadership dashboards
(`client/src/components/paymentPlans/PaymentPlanPanel.js:89`).

---

### 6.17 Reconciliation — `/api/reconciliation`

Routes: [`server/routes/reconciliation.js`](../../server/routes/reconciliation.js) ·
Controller: [`server/controllers/reconciliationController.js`](../../server/controllers/reconciliationController.js) ·
`protect` + **`authorize('admin')`** for the whole router (`reconciliation.js:13–14`) — pairing can
flip `admissionClosed = true`, which is irreversible.

| Method | Path | Controller | Purpose |
|---|---|---|---|
| GET | `/counts` | `getCounts` (`:81`) | `{ orphanCommits, orphanStudents, manualStudents }` |
| GET | `/orphan-commitments` | `listOrphanCommitments` (`:12`) | closed commitments with no linked Student |
| GET | `/orphan-students` | `listOrphanStudents` (`:35`) | LUC students with no linked Commitment and not flagged manual |
| GET | `/manual-students` | `listManualStudents` (`:60`) | students explicitly marked `manualEntry: true` |
| POST | `/pair` | `pair` (`:122`) | link one student to one commitment |

All list endpoints take `?limit` (default 200, clamped 1–500) and hard-code
`organization: 'luc'` plus a **fixed scope floor of 2026-01-01** (`SCOPE_FROM`,
`reconciliation­Controller.js:9`) — older drift is deliberately out of scope. The student queries
also run `applyHideLucZeroFeeFilter`, so the 626 hidden rows never appear here either.

`POST /pair` body `{ studentId, commitmentId }`. `400` if either is missing or non-LUC; `404` if
either is not found; **`409`** if either side is already linked. On success it writes both foreign
keys, clears `manualEntry`/`manualEntryReason` on the student, and — if the commitment was not
already closed — sets `admissionClosed = true`, `admissionClosedDate = now`, `status = 'achieved'`,
`achievementPercentage = 100` (`:148–167`). **That close is irreversible**, which is exactly why
this router is admin-only.

A background `driftMonitor` (`server/services/driftMonitor.js`, started at `server.js:150`) posts a
notification to admins when closed LUC commitments older than 7 days are still unlinked.

---

### 6.18 Announcements — `/api/announcements`

Routes: [`server/routes/announcements.js`](../../server/routes/announcements.js) ·
Controller: [`server/controllers/announcementController.js`](../../server/controllers/announcementController.js)

| Method | Path | Auth | Roles | Controller | Purpose |
|---|---|---|---|---|---|
| GET | `/active` | ✅ | any | `getActive` (`:8`) | unexpired, unacknowledged banners for the caller's org |
| POST | `/:id/ack` | ✅ | any | `acknowledge` (`:29`) | dismiss one (idempotent) |

`protect` is applied per-route, not via `router.use` (`announcements.js:7–8`). Org scoping is
inline from `req.user.organization`; last 20, newest first. `POST /:id/ack` pushes into
`acknowledgedBy[]` under a `$ne` guard so a double-click cannot create duplicates, and always
returns `{ success: true }` — even for a non-existent id.

There is **no create/update/delete endpoint.** Announcements are only ever written server-side by
`server/services/announcer.js`, called from `teamEntryController` (new admissions) and
`tierController` (new poster). Both also emit the `announcement` socket event so open tabs get the
banner without polling.

Both handlers catch their own errors and return a bare `500` rather than calling `next` — errors
here never reach the global handler.

---

### 6.19 Notifications — `/api/notifications`

Routes: [`server/routes/notifications.js`](../../server/routes/notifications.js) ·
Controller: [`server/controllers/notificationController.js`](../../server/controllers/notificationController.js) ·
`router.use(protect)` at `notifications.js:15`.

| Method | Path | Roles | Controller | Purpose |
|---|---|---|---|---|
| GET | `/` | any | `getNotifications` (`:7`) | own notifications, newest 50 |
| PATCH | `/read-all` | any | `markAllAsRead` (`:60`) | mark all own as read |
| POST | `/generate-reminders` | `admin`, `team_lead` | `generateFollowUpReminders` (`:97`) | create follow-up reminders |
| PATCH | `/:id/read` | any | `markAsRead` (`:26`) | mark one as read |
| DELETE | `/:id` | any | `deleteNotification` (`:152`) | **hard** delete |

Every per-document route checks `notification.user.toString() !== req.user.id` → `403`
(`:37`, `:163`). There is no soft-delete flag on `Notification` — `DELETE` really removes the row
(`notification.deleteOne()`, `:170`).

`POST /generate-reminders` scans `Commitment` for `followUpDate <= tomorrow`,
`admissionClosed: false`, `isActive: true` (`:106–110`), and creates one `follow_up_reminder`
(priority `high`) per commitment **per day** — the existing-reminder check is scoped to
`createdAt >= today` (`:118–123`), so it is idempotent within a day but will fire again tomorrow.
Response is `{ success, message: "Generated N follow-up reminders" }` — note there is no `data`.
It is **not scheduled**; something has to call it.

The model/controller alignment bug noted in older docs (controller using `recipient`/`isActive`,
fields that do not exist on `Notification`) **is fixed** — the controller uses `user` and
`isRead`/`readAt` throughout.

Notifications are also written by two scheduled jobs (`server.js:149–187`): the drift monitor —
which is **not** node-cron but a boot-delayed `setTimeout` plus a 24 h `setInterval`
(`services/driftMonitor.js:72–73`) — and student birthday reminders, a real `node-cron` job at
08:00 Asia/Dubai (`server.js:177–185`). Both are skipped when `NODE_ENV === 'test'`.

---

## 7. SSE streaming endpoints

Two endpoints stream Server-Sent Events. Neither uses `EventSource` on the client — `EventSource`
cannot send a POST body or an `Authorization` header, so both clients use
`fetch` + `ReadableStream` and parse frames by hand
([`client/src/services/chatService.js:25–79`](../../client/src/services/chatService.js)).

| Endpoint | Auth | Headers set | Terminates with |
|---|---|---|---|
| `POST /api/chat/stream` | `protect` | `text/event-stream`, `no-cache, no-transform`, `keep-alive`, **`X-Accel-Buffering: no`** | `done` or `error` |
| `POST /api/docs-chat` | `protect` + `orgGate('luc')` | same minus `X-Accel-Buffering` | `done` or `error` |

`X-Accel-Buffering: no` matters behind nginx-style proxies — without it the proxy buffers the whole
stream and the user sees nothing until the end. The docs-chat route does not set it
(`docsChat.js:336–338`); if streaming ever appears "chunky" in production, add it there too.

Frame format (both, `chatService.js:471–474` / `docsRagService.js:439–441`):

```
event: <name>\n
data: <JSON>\n
\n
```

### `POST /api/chat/stream` events

| Event | Payload | Emitted at |
|---|---|---|
| `meta` | `{ conversationId }` | immediately, before generation (`chatController.js:43`) — lets the UI bind the thread before any token arrives |
| `delta` | `{ text }` | per token (`chatService.js:531`) |
| `tool-start` | `{ id, name }` | before each tool call (`:576`) |
| `tool-end` | `{ id, name }` | after each tool call (`:578`) |
| `error` | `{ message }` | on provider failure (`:517`) or on a mid-stream throw (`chatController.js:58`) |
| `done` | `{ conversationId, title, usage: { promptTokens, completionTokens, totalTokens } }` | end (`:633`) |

### `POST /api/docs-chat` events

| Event | Payload | Notes |
|---|---|---|
| `delta` | `{ text }` | for a cache hit or tier-1 answer the whole answer arrives as **one** delta (`docsRagService.js:578`, `:650`); tier 2 streams token by token (`:708`) |
| `error` | `{ message }` | generation failure (`:725`) |
| `done` | `{ sources[], exactMatch, programFilter, tier, cached, logId, latencyMs, provider? }` | `sources[]` renders the citation chips; `logId` is what `POST /feedback` needs |

Each `sources[]` entry (`docsRagService.js:283–303`):
`{ chunkId, program, programDisplayName, docType, section, sourceFile, pageNumber,
pdfUrl: "<pdfPath>#page=<n>", highlightedPdfPath, snippetPath, score, retrievalMethod }`.
`highlightedPdfPath` and `snippetPath` may be `null` on chunks ingested before the highlight script
ran — the client falls back to `pdfUrl`.

**Error-handling rule for both:** once headers are flushed you cannot send a JSON error response.
Both handlers check `res.headersSent` / `res.writableEnded` and write an `error` **frame** instead
(`chatController.js:57–61`, `docsChat.js:351–359`). Preserve that when editing — returning
`res.status(500).json(...)` mid-stream throws `ERR_HTTP_HEADERS_SENT` and kills the connection with
no message.

Note the split-brain routing on the client: `ChatPanel.js` classifies each turn locally
(`classifyQuery`) and posts to **either** `/api/chat/stream` **or** `/api/docs-chat`; non-LUC orgs
are hard-locked to the tracker path.

---

## 8. Socket.IO real-time layer

Implementation: [`server/services/realtime.js`](../../server/services/realtime.js), attached to the
same HTTP server at `server.js:127`. Client: `client/src/services/socket.js` +
`client/src/hooks/useRealtimeRefresh.js`.

| Aspect | Value |
|---|---|
| Path | `/socket.io` (`realtime.js:30`) |
| Transports | `['websocket', 'polling']` (client) |
| CORS | `{ origin: true, credentials: true }` — reflects the request origin |
| Auth | `socket.handshake.auth.token`, verified with **the same `JWT_SECRET`** as the REST API (`realtime.js:34–50`); inactive users rejected |
| Disabled when | `NODE_ENV === 'test'`, or `socket.io` is not installed — both degrade to no-ops (`:17–24`) |

### Rooms (joined automatically on connect, `realtime.js:52–61`)

| Room | Who joins |
|---|---|
| `org:<organization>` | every connected user |
| `org:<organization>:admin` | `admin` only |
| `org:<organization>:team:<userId>` | `team_lead` only (forward-compatible; nothing broadcasts to it yet) |

All current broadcasts go to `org:<organization>` via `emitToOrg`. **Events carry thin identifiers
only** — ids, year/month, counts — never computed rows. The contract is "something changed, re-run
your normal fetch".

### Event catalogue

| Event | Payload | Emitted from | Client listener |
|---|---|---|---|
| `teamEntry:upserted` | `{ consultant, teamLead, year, month }` | `teamEntryController.js:126`, `:163` | ExecutiveOverviewPage, TeamDetailPage, ConsultantPerformancePage |
| `teamEntry:bulk` | `{ year, upserted }` | `teamEntryController.js:236` | same three |
| `teamEntry:deleted` | `{ id, year }` | `teamEntryController.js:251` | same three |
| `consultant:created` | `{ id, name, teamLead, teamName }` | `consultantController.js:88` | same three |
| `consultant:updated` | `{ id, ... }` | `consultantController.js:151` | same three |
| `consultant:deactivated` | `{ id }` | `consultantController.js:192` | same three |
| `consultant:deleted` | `{ id }` | `consultantController.js:220` | **none** |
| `user:created` | `{ id, role, teamName }` | `authController.js:45` | ExecutiveOverviewPage only |
| `paymentPlan:created\|updated\|deleted` | `{ id }` | `paymentPlanController.js:76`, `:102`, `:123` | `PaymentPlanPanel.js:89` |
| `tier-image` | `{ _id, month, year, monthName }` | `tierController.js:274` | `TierAnnounceModal.js:22` |
| `announcement` | full announcement payload | `announcer.js:45`, `:79` | `AnnouncementBanner.js:40` |
| `institute:teacher` | `{ id }` | `instituteController.js:58`, `:75`, `:90` | **none** |
| `institute:timetable` | `{ id }` / `{ imported, partial? }` | `instituteController.js:151`, `:179`, `:191`, `:398`, `:407` | **none** |
| `institute:attendance` | `{ gradeOrYear, subject, date\|studentName, removed? }` | `instituteController.js:536`, `:568`, `:677`, `:713`, `:735` | **none** |
| `institute:test` | `{ gradeOrYear, subject, date }` / `{ id }` | `instituteController.js:900`, `:933`, `:945` | **none** |

**The whole `institute:*` family is emitted but never consumed** — the Institute page does not
subscribe. The wiring is there for whoever adds live refresh to that page; until then, two
counsellors editing the same grade will not see each other's changes without a manual reload.

`useRealtimeRefresh(events, refetch, { year, debounceMs = 500 })` also re-fires on socket
`connect`, so a tab that was asleep catches up on wake.

---

## 9. Auth-gated static asset routes

Three `express.static` mounts serve the Docs-RAG PDFs and image crops. They are **not** under
`/api`, but they are fully authenticated (`server.js:59–96`):

| Path | Serves from | Middleware chain |
|---|---|---|
| `/program-docs/*` | `client/public/program-docs/` | `docsRagEnabled` → `protect` → `orgGate('luc')` → static |
| `/program-docs-highlighted/*` | `client/public/program-docs-highlighted/` | same |
| `/program-docs-snippets/*` | `client/public/program-docs-snippets/` | same |

All three use `{ fallthrough: false, index: false }` so a missing file 404s here rather than
falling through to the SPA catch-all.

**The middleware order is deliberate**: `docsRagEnabled` runs *before* `protect`, so when the
feature is off you get `503` rather than a `401`/`403` that would reveal whether the resource
exists. Do not reorder.

**Practical consequence:** because these require an `Authorization` header, you **cannot** put them
in an `<img src>` or `<iframe src>`. The client fetches them with the header and converts to an
object URL (`client/src/services/docsChatService.js:144–167`), which is why the PDF viewer is a
blob viewer. Any new "just link to the PDF" idea will 401.

The SPA catch-all `app.get(/^(?!\/api).*/)` (`server.js:111`, production only) serves
`index.html` for every non-`/api` **GET**. Note what that means:

- A `GET` to a mistyped API path returns JSON 404 (the regex excludes `/api`).
- A **non-GET** to a path with no route — e.g. `PATCH /api/commitments/:id/close`, see §10 — matches
  nothing at all and returns Express's default **HTML** "Cannot PATCH …" 404, not the JSON
  envelope. Client code doing `err.response.data.message` gets `undefined`.

---

## 10. Client/server mismatches and authorization gaps

Verified against the current code, not inherited from the older docs.

### 10.1 Live route mismatch — close admission (**still broken**)

| Side | What it does |
|---|---|
| Server | `PUT /api/commitments/:id/close-admission` (`routes/commitments.js:54`) |
| Client | `axios.patch(\`${API_URL}/${id}/close\`, ...)` (`client/src/services/commitmentService.js:59`) |

The commitments router registers no `PATCH` handler and no `/close` path, so this request matches
**nothing** and returns Express's default HTML 404. It is not dead code — it is called from
`client/src/pages/CommitmentsPage.js:443` (the "Close admission" action, behind a
`window.prompt` for the amount) and from the unrouted `ConsultantDashboard.js:130`.

The user-visible symptom is the snackbar "Failed to close admission" — and because the response
body is HTML, `err?.response?.data?.message` is `undefined`, so they get the generic fallback text
with no clue why. **Fix by changing the client to `axios.put(\`${API_URL}/${id}/close-admission\`)`**;
do not add a `PATCH` alias, or the `/:id` catch-all ordering has to be revisited.

In practice admissions still get closed, because `updateCommitment` auto-closes any row that
reaches `leadStage: 'Admission'` + `status: 'achieved'` — which is the path the UI normally takes.
That is why this has survived unnoticed.

### 10.2 Live route mismatch — update meetings count (**still broken**)

Server: `PUT /api/commitments/:id/meetings` (`routes/commitments.js:55`).
Client: `axios.patch(\`${API_URL}/${id}/meetings\`)` (`commitmentService.js:68`). Same 404. No
current page calls `commitmentService.updateMeetings`, so this is latent rather than user-facing —
but fix it in the same change as 10.1.

### 10.3 Mismatches listed in CLAUDE.md that are now **fixed**

| Issue as documented | Actual state |
|---|---|
| update meetings — server `PUT`, client `PATCH` (Meeting Tracker) | **Fixed.** `client/src/services/meetingService.js:47` uses `axios.put`. |
| team consultants — server `GET /api/users/team/:teamLeadId`, client `/users/teamlead/:id/consultants` | **Fixed** (`userService.js:54`), with a comment recording the history. The endpoint is still functionally useless — see [§6.2](#62-users--apiusers). |

Update CLAUDE.md's "Known Issues" section when you next touch it; two of its four entries are stale
and one (10.1) is understated.

### 10.4 Authorization gaps (verified in code, not yet fixed)

| # | Gap | Evidence | Impact |
|---|---|---|---|
| 1 | `GET /api/users/:id` and `PUT /api/users/:id` have no `authorize()`, and the controller only branches on `consultant` (impossible) and `team_lead` | `routes/users.js:26–30`; `userController.js:60–72`, `:99–110` | a `manager` or `skillhub` login can read **any** user document across organisations, and can change any user's `name`/`phone`. Role/isActive changes stay admin-only. |
| 2 | `/api/hourly` has **no role gate at all**, and `hourlyScopeFilter` drops the ownership clause | `routes/hourly.js:24`; `hourlyController.js:18–21` | a `manager` (org `luc`) can read **and write** all LUC hourly activity, including `DELETE /day` for today. Team leads seeing the whole org is intended; manager access is not. |
| 3 | `GET /api/commitments`, `GET /api/commitments/:id`, `GET /api/commitments/week/:w/:y` have no `authorize()` | `routes/commitments.js:27,44,60` | `manager`, documented as "`/student-database` only", can read every LUC commitment. Writes are correctly gated. |
| 4 | `cors()` with no options, in production | `server.js:28` | any origin can call the API with a stolen token. Tokens live in `localStorage`, so this compounds any XSS. |
| 5 | No rate limit on any OpenAI-billed endpoint | §4 | any logged-in user can run up an unbounded bill; `POST /api/tiers/generate-image` is the worst case. |
| 6 | `JWT_EXPIRE` unset ⇒ non-expiring tokens; no refresh flow; no revocation list | `models/User.js:86–88` | deactivating a user is the only revocation mechanism (it works, via `protect`), but a leaked token is otherwise valid until expiry. |

None of these is a remote-unauthenticated hole — all require a valid login. Prioritise 1–3 (small,
mechanical `authorize()` additions) and 5.

---

## What the older API doc gets wrong

[`docs/engineering/02-api-reference.md`](../engineering/02-api-reference.md) (227 lines, drafted
2026-04-26) is still broadly correct on **conventions** — auth header, envelopes, error mappings,
the export rate limit, the permissive CORS — and you can cross-reference it safely for those. It is
wrong or incomplete on coverage:

- **Seven route groups are missing entirely**: `/api/institute` (24 endpoints — the largest single
  group), `/api/exec-overview`, `/api/team-entries`, `/api/tiers`, `/api/payment-plans`,
  `/api/reconciliation`, `/api/announcements`.
- It documents 12 of 19 route files, ~60 of ~138 endpoints.
- It predates several endpoints inside groups it *does* cover — e.g.
  `GET /api/commitments/linkable`, `GET /api/commitments/ai-analysis`,
  `PATCH /api/students/:id/status`, `GET /api/students/programs`,
  `GET /api/hourly/leaderboard/weekly`, `POST /api/chat/classify`,
  `POST /api/chat/transcribe`.
- It does not mention the Socket.IO layer, the institute upload rate limiter, or the LUC zero-fee
  hide.

Treat this document (`06-api-reference.md`) as the source of truth and the engineering doc as
historical context.

---

## 12. Unverified items

Everything above was read out of the code. These few points could not be confirmed from the
repository and need a human to check:

1. **UNVERIFIED — needs confirmation:** whether `JWT_EXPIRE` is actually set in the Render
   environment. The code reads it (`models/User.js:87`) and behaves very differently if it is
   missing (non-expiring tokens). `.env` files are not in the repo. Check the Render dashboard.
2. **UNVERIFIED — needs confirmation:** whether anything calls
   `POST /api/notifications/generate-reminders` on a schedule. There is no cron entry for it in
   `server.js`. A client wrapper exists (`notificationService.generateReminders`,
   `client/src/services/notificationService.js:31–34`) but **no component imports or calls it**, so
   the endpoint appears reachable only by hand (curl/Postman) today.
3. **UNVERIFIED — needs confirmation:** the exact behaviour of `hourly` slot continuation IDs and
   the `LOCKED_TYPES` list beyond what `clearDay` uses — the helper set is defined in
   `hourlyController.js` but its product meaning ("which activities a team lead may not clear") is
   not documented anywhere in the code.
4. **UNVERIFIED — needs confirmation:** whether the `org:<org>:admin` and
   `org:<org>:team:<userId>` Socket.IO rooms are used by anything outside this repo. Nothing in
   `server/` broadcasts to them; the comments call them forward-compatible.
5. **UNVERIFIED — needs confirmation:** whether any external system (Zapier, a spreadsheet, a
   partner) calls this API directly. Nothing in the repo suggests one, but an unauthenticated
   inventory of API consumers was not possible from the code alone. Ask before changing any
   response shape.

---

## Related documents

| Document | Why you would go there from here |
|---|---|
| [00 — Start Here](00-START-HERE.md) | handover index and suggested reading order |
| [01 — System Architecture](01-system-architecture.md) | how the Express app, React client and MongoDB fit together |
| [02 — Application Workflows](02-application-workflows.md) | the user-facing flows these endpoints implement |
| [03 — Database Schema](03-database-schema.md) | the 27 models behind every request/response shape above |
| [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) | Render service, the "dev"-named production Atlas cluster, cron jobs |
| [05 — Environment Setup](05-environment-setup.md) | env var names, running the API locally on :5001 |
| [07 — Roles & Permissions](07-roles-and-permissions.md) | the full role × feature matrix behind every `authorize(...)` in this document |
| [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) | OpenAI, Groq, AWS S3, Socket.IO, and the rest of the third-party surface |
| [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) | nightly S3 snapshot, health probes, what to do when `/api/docs-chat/health` goes 503 |
| [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) | the mismatches and authorization gaps in §10, tracked as work items |
| [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) | who holds `JWT_SECRET`, `OPENAI_API_KEY`, `GROQ_API_KEY` and how to rotate them |
| [`docs/engineering/02-api-reference.md`](../engineering/02-api-reference.md) | the earlier, partial API doc — cross-reference for conventions only |
