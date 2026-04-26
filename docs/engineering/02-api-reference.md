# API Reference

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

All endpoints are mounted under `/api/*` in
[`server/server.js`](../../server/server.js). The standard error envelope
(`{ success: false, message }`) comes from
[`server/middleware/errorHandler.js`](../../server/middleware/errorHandler.js).
The success envelope is `{ success: true, data | ... }`. The version of this
document tracks routes as of HEAD on 2026-04-26.

## Conventions

- **Auth header**: `Authorization: Bearer <jwt>`. Token issued by
  `POST /api/auth/login`.
- **Org scoping**: server-side. Non-admin requests are pinned to their own
  organization (and their own team for `team_lead` and `skillhub`). Admin
  may opt into a tenant via `?organization=<luc|skillhub_training|skillhub_institute>`.
- **Rate limits**: only `POST /api/exports/pivot` and
  `POST /api/exports/template/:id` are rate-limited (5 req/min/user via
  [`exportRateLimit.js`](../../server/middleware/exportRateLimit.js)).
- **CORS**: `cors()` with no options at
  [`server/server.js:28`](../../server/server.js) — all origins allowed.
  Tracked as P0 in the Gap Roadmap.

## Auth — `/api/auth`

Routes: [`server/routes/auth.js`](../../server/routes/auth.js)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/register` | `protect` + `authorize('admin')` | Admin-only account creation |
| POST | `/login` | public | **No rate limit** — P0 in roadmap |
| GET | `/me` | `protect` | Returns current user |
| GET | `/logout` | `protect` | Stateless — token remains valid until expiry; P1 |
| PUT | `/updatepassword` | `protect` | Requires `currentPassword` |

## Users — `/api/users`

Routes: [`server/routes/users.js`](../../server/routes/users.js)

Standard CRUD on `User` documents. All routes `protect` + `authorize('admin')`
unless noted; supporting endpoints expose team rosters for assignment UIs.

| Method | Path | Notes |
|---|---|---|
| GET | `/` | List users |
| POST | `/` | Create user |
| GET | `/:id` | Read user |
| PUT | `/:id` | Update user (admin/self) |
| DELETE | `/:id` | Soft-delete (`isActive: false`) |
| GET | `/team/:teamLeadId` | List a team lead's roster |

## Consultants — `/api/consultants`

Routes: [`server/routes/consultants.js`](../../server/routes/consultants.js)

CRUD on `Consultant` documents. Scoped to the user's team for `team_lead` and
`skillhub`. Soft-delete on DELETE.

## Commitments — `/api/commitments`

Routes: [`server/routes/commitments.js`](../../server/routes/commitments.js).
Specific route ordering matters — `/date-range`, `/week/:weekNumber/:year`
must come before `/:id`.

| Method | Path | Notes |
|---|---|---|
| GET | `/` | List with filters; scoped per role |
| GET | `/date-range` | Filter by `?start=&end=` |
| GET | `/week/:weekNumber/:year` | ISO week filter |
| POST | `/` | Create |
| GET | `/:id` | Read (canAccessDoc) |
| PUT | `/:id` | Update (canAccessDoc); enforces `commitmentDate ∈ [weekStartDate, weekEndDate]` for non-admin |
| PATCH | `/:id` | Partial update |
| DELETE | `/:id` | Soft-delete (`isActive: false`) |

`admissionClosed: true` is irreversible — the controller rejects any attempt
to flip it back.

## Students — `/api/students`

Routes: [`server/routes/students.js`](../../server/routes/students.js)

Dual-mode payloads. The controller calls
[`buildScopeFilter`](../../server/middleware/auth.js) on list endpoints and
[`canAccessDoc`](../../server/middleware/auth.js) on item endpoints.

The LUC zero-fee filter
([`studentController.js:57-74`](../../server/controllers/studentController.js))
is applied to every Students-LUC raw and pivot query, hiding 626 importer-bug
rows where `admissionFeePaid=0`. Documented in
[Export Center Guide](../user-guides/06-export-center-guide.md) and the
[VAT memory note](../legal/01-privacy-policy.md).

## Meetings — `/api/meetings`

Routes: [`server/routes/meetings.js`](../../server/routes/meetings.js)

LUC-only meeting log. The list endpoint accepts `?search=…` which is
interpolated raw into a `$regex` at
[`server/controllers/meetingController.js:95`](../../server/controllers/meetingController.js)
— **NoSQL regex injection (P0)**. Track in the
[Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Hourly — `/api/hourly`

Routes: [`server/routes/hourly.js`](../../server/routes/hourly.js)

Auth-protected, role-agnostic; scoping is inline in
[`hourlyController.js`](../../server/controllers/hourlyController.js).

| Method | Path | Notes |
|---|---|---|
| GET | `/daily/:consultantId/:date` | Day view |
| GET | `/month/:consultantId/:year/:month` | Month aggregate |
| GET | `/leaderboard` | Org-scoped leaderboard |
| GET | `/ai-analysis` | AI insights — uses OpenAI |
| PUT | `/slots/:consultantId/:date/:slotId` | Upsert slot |
| POST | `/daily-admissions/:org/:date` | Skillhub admission counts |
| POST | `/daily-references/:org/:date` | Skillhub reference counts |

## AI — `/api/ai`

Routes: [`server/routes/ai.js`](../../server/routes/ai.js)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/analysis` | `protect` (admin + team_lead) | Sends aggregated tenant snapshot to OpenAI |
| GET | `/usage` | `protect` + admin | AI token & cost stats |

## Chat — `/api/chat`

Routes: [`server/routes/chat.js`](../../server/routes/chat.js).
SSE streaming. Tools are defined in
[`server/services/chatTools.js`](../../server/services/chatTools.js) and may
return rows of `Student`, `Commitment`, `Meeting`, `Consultant` to the LLM.

| Method | Path | Notes |
|---|---|---|
| POST | `/stream` | SSE; tracker chatbot |
| POST | `/conversations` | Create conversation |
| GET | `/conversations` | List conversations |
| GET | `/conversations/:id` | Read messages |
| DELETE | `/conversations/:id` | Hard-delete |

## Docs Chat (LUC-only) — `/api/docs-chat`

Routes: [`server/routes/docsChat.js`](../../server/routes/docsChat.js).
Most endpoints sit behind `protect` + `orgGate('luc')`. The health endpoint
is intentionally public.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | `protect` + `orgGate('luc')` | SSE answer stream |
| POST | `/feedback` | `protect` + `orgGate('luc')` | Thumbs up/down + comment |
| POST | `/admin/reingest` | `protect` + admin + `orgGate('luc')` | Force re-ingest of program PDFs |
| GET | `/stats` | `protect` + admin + `orgGate('luc')` | Cache + tier stats |
| GET | `/health` | **public** | 503 when `chunksLoaded === 0`; used by Render readiness probe |

## Exports — `/api/exports`

Routes: [`server/routes/exports.js`](../../server/routes/exports.js).
All endpoints behind `protect` + `assertDatasetAccess`
([`exportController.js`](../../server/controllers/exportController.js)).

| Method | Path | Notes |
|---|---|---|
| POST | `/raw` | Cursor-paginated raw rows; `limit` capped at 5000 server-side, 100k client-side |
| POST | `/pivot` | **Rate-limited 5/min** |
| POST | `/template/:templateId` | **Rate-limited 5/min**; multi-sheet xlsx envelope |
| GET | `/dimensions/:dataset` | Legal dimensions + distinct values within scope |
| GET | `/templates` | Pre-built catalog filtered by role |
| GET | `/saved-templates` | Owner's saved configs |
| POST | `/saved-templates` | Save new (returns 409 on duplicate name; 429 over 200-cap) |
| PUT | `/saved-templates/:id` | Owner-only update |
| DELETE | `/saved-templates/:id` | Owner-only delete |

Datasets are: `students`, `commitments`, `meetings`, `hourly`. Role allowlist
matrix lives in `assertDatasetAccess` and the per-role section of the
[Access Control Policy](../security/02-access-control-policy.md).

## Notifications — `/api/notifications`

Routes: [`server/routes/notifications.js`](../../server/routes/notifications.js)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Recipient's notifications |
| POST | `/` | Create (system / admin) |
| DELETE | `/:id` | Hard-delete |

## Static auth-gated assets

| Path | Middleware |
|---|---|
| `/program-docs/*` | `docsRagEnabled` → `protect` → `orgGate('luc')` |
| `/program-docs-highlighted/*` | same as above |
| `/program-docs-snippets/*` | same as above |
| `/api/health` | public |

## Error envelope

```json
{
  "success": false,
  "message": "Resource not found"
}
```

Mongoose errors are normalised by
[`errorHandler.js`](../../server/middleware/errorHandler.js):

- `CastError` → 404 "Resource not found"
- duplicate key (`code === 11000`) → 400 "Duplicate field value entered"
- `ValidationError` → 400 with array of field messages

`console.log(err)` at `errorHandler.js:6` writes the full stack to stdout —
P1 PII concern. See
[Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Related documents

- [Architecture Overview](01-architecture-overview.md)
- [Data Dictionary](03-data-dictionary.md)
- [Access Control Policy](../security/02-access-control-policy.md)
- [Threat Model](../security/12-threat-model.md)
