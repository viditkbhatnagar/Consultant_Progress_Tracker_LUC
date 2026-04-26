# Access Control Policy

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]`

## Purpose

Define how identity, authentication, authorisation, and tenant scoping work
on the Team Progress Tracker. Maps directly to ISO/IEC 27001 A.5 (Access
Control) and SOC 2 CC6 (Logical and Physical Access).

## Identity model

Every user has a single `User` row
([`server/models/User.js`](../../server/models/User.js)) with:

- `email` (unique, required)
- `password` (bcryptjs hashed, salt 10, `select: false`)
- `role` ∈ `{ admin, team_lead, manager, skillhub }`
- `organization` ∈ `{ luc, skillhub_training, skillhub_institute }`
- `teamLead` (FK to User, for hierarchy)
- `isActive` (soft-delete flag)

**Shared logins**: today, `training@skillhub.com` and
`institute@skillhub.com` are shared by branch staff. This is an accepted
business risk pending MFA rollout (SEC-07). When MFA lands, branch logins
become per-counselor.

## Authentication

- **Method**: email + password → JWT (HS256).
- **Issuer**:
  [`User.getSignedJwtToken()`](../../server/models/User.js) — payload
  `{ id, role }`, lifetime `process.env.JWT_EXPIRE` (default `1h`).
- **Verification**:
  [`protect`](../../server/middleware/auth.js) middleware reads
  `Authorization: Bearer <token>`, calls `jwt.verify`, fetches `User` from
  Mongo, and rejects with 401 if `isActive === false`.
- **Logout**: stateless (SEC-10).
- **MFA**: not yet implemented (SEC-07).
- **Password reset**: not yet implemented (SEC-09).
- **Brute-force protection on login**: not yet implemented (SEC-03).

## Authorisation primitives

Three building blocks in
[`server/middleware/auth.js`](../../server/middleware/auth.js):

### `authorize(...roles)`

Coarse-grained role gate. Used at route level, e.g. `router.post('/register',
protect, authorize('admin'), register)`
([`server/routes/auth.js:14`](../../server/routes/auth.js)).

### `buildScopeFilter(req)`

Returns a Mongoose filter fragment to scope list queries:

| Role | Filter |
|---|---|
| `admin` | `{}` (or `{ organization }` if admin opts in via `?organization=…`) |
| `team_lead` | `{ organization: user.organization, teamLead: user._id }` |
| `manager` | `{ organization: user.organization }` |
| `skillhub` | `{ organization: user.organization, teamLead: user._id }` |

Source: [`auth.js:69-86`](../../server/middleware/auth.js).

### `canAccessDoc(user, doc)`

Single-doc check used on GET/PUT/DELETE-by-id paths. Same matrix as
`buildScopeFilter`. Source:
[`auth.js:91-100`](../../server/middleware/auth.js).

### `resolveOrganization(req)`

Picks the organization for new documents. Non-admin: pinned to
`user.organization`. Admin: `req.body.organization || 'luc'`. Source:
[`auth.js:105-110`](../../server/middleware/auth.js).

## Role × surface matrix

A short version (full matrix in
[Role Permissions Matrix](../user-guides/05-role-permissions-matrix.md)):

| Surface | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| `/admin/dashboard` | ✓ | — | — | — |
| `/team-lead/dashboard` | — | ✓ | — | — |
| `/skillhub/dashboard` | — | — | — | ✓ |
| `/student-database` (LUC) | ✓ | ✓ | ✓ (read-only) | — |
| `/student-database` (Skillhub) | ✓ | — | — | ✓ (own branch) |
| `/commitments` | ✓ | ✓ | — | ✓ |
| `/meetings` | ✓ | ✓ | — | — |
| `/hourly-tracker` | ✓ | ✓ | — | ✓ |
| `/exports → students` | ✓ (all orgs) | ✓ (LUC, own team) | ✓ (cross-org carve-out) | ✓ (own branch) |
| `/exports → commitments` | ✓ | ✓ | — | ✓ |
| `/exports → meetings` | ✓ | ✓ | — | — |
| `/exports → hourly` | ✓ | ✓ | — | ✓ |
| `/pdf-viewer` (LUC docs RAG) | ✓ | ✓ | — | — |
| Chat → tracker | ✓ | ✓ | — | ✓ |
| Chat → Docs RAG | ✓ (LUC) | ✓ (LUC) | — | — |
| Create users | ✓ | — | — | — |
| Create consultants | ✓ | ✓ (own team) | — | — |
| Force-reingest Docs RAG | ✓ | — | — | — |

## Manager Export Center carve-out

Per
[`server/controllers/exportController.js`](../../server/controllers/exportController.js)'s
`assertDatasetAccess`, a manager (whose `User.organization === 'luc'`) is
allowed to pick `'all'`, `'luc'`, `'skillhub_training'`, or
`'skillhub_institute'` on the **Students dataset only**. Other datasets
remain hidden. This is the only documented org-scope exception in the
platform.

## Provisioning

| Action | Who | How |
|---|---|---|
| Create user | Admin | `POST /api/auth/register` (admin-only) or `POST /api/users` |
| Activate user | Admin | Toggle `isActive: true` |
| Deactivate user | Admin | Toggle `isActive: false` (soft-delete) |
| Reset password | Self | `PUT /api/auth/updatepassword` (requires `currentPassword`) |
| Forgot password | — | Not implemented (SEC-09) |
| Delete user | — | Not implemented; soft-delete only |

## Off-boarding

When a staff member leaves:

1. Admin sets `User.isActive = false` (login is rejected by `protect`).
2. Engineering rotates any production credential the user had access to
   (Atlas, Render, Groq, OpenAI).
3. Outstanding sessions remain valid until `JWT_EXPIRE` (SEC-10); for
   sensitive offboarding, rotate `JWT_SECRET` to invalidate all tokens.

## Access reviews

Quarterly the security lead `[FILL]` exports the active user list and
reconciles against HR records. Stale rows are deactivated.

## Privileged actions

| Action | Who | Audit |
|---|---|---|
| `admissionClosed = true` on a Commitment | team_lead, admin | Stored on `lastUpdatedBy`; **irreversibility is enforced server-side** |
| Force-reingest Docs RAG | admin | Logged via Render stdout (no DB log yet) |
| Admin opt-in to another org via `?organization=…` | admin | **Not logged** (SEC-18) |
| User CRUD | admin | `createdBy` / `lastUpdatedBy` not on `User` (gap) |
| Mass export | admin / team_lead / manager / skillhub | Rate-limited only on pivot/template — see [Export Center Guide](../user-guides/06-export-center-guide.md) |

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Logging & Audit Policy](05-logging-and-audit-policy.md)
- [Threat Model](12-threat-model.md)
- [Role Permissions Matrix](../user-guides/05-role-permissions-matrix.md)
