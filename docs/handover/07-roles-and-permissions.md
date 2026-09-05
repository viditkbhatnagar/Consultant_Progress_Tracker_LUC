# 07 — Roles & Permissions

**What this document is.** The authoritative, code-derived reference for *who can do what* in the Sales
Tracker. It documents the four user roles (`admin`, `team_lead`, `manager`, `skillhub`), the three
organisations (`luc`, `skillhub_training`, `skillhub_institute`), the exact behaviour of the three
scoping helpers every controller relies on (`buildScopeFilter`, `canAccessDoc`, `resolveOrganization`),
a route-by-route permission matrix built by reading every `authorize(...)` call in `server/routes/*.js`,
and the feature-specific gates that sit *below* the route layer (`orgGate`, `assertInstitute`,
`assertDatasetAccess`). Every claim below carries a `file:line` citation. Where an existing document in
`docs/` disagrees with the code, the code wins and the disagreement is called out explicitly in
[§13](#13-corrections-to-the-pre-existing-docs-set). Where something could not be verified it says
**UNVERIFIED**.

Read this before you change any route, add any page, or create any user. Multi-tenancy is not a
feature bolted onto this app — it is the shape of every query in it.

---

## Table of contents

1. [The mental model: two independent axes](#1-the-mental-model-two-independent-axes)
2. [The four roles](#2-the-four-roles)
3. [The three organisations](#3-the-three-organisations)
4. [How a request gets authorised (the pipeline)](#4-how-a-request-gets-authorised-the-pipeline)
5. [The three scoping helpers, precisely](#5-the-three-scoping-helpers-precisely)
6. [`orgGate` — whole-feature organisation locks](#6-orggate--whole-feature-organisation-locks)
7. [The definitive route × role permission matrix](#7-the-definitive-route--role-permission-matrix)
8. [Feature-specific gates](#8-feature-specific-gates)
9. [How the frontend mirrors this (and why it is cosmetic)](#9-how-the-frontend-mirrors-this-and-why-it-is-cosmetic)
10. [Creating, changing and disabling accounts](#10-creating-changing-and-disabling-accounts)
11. [Known gaps and traps](#11-known-gaps-and-traps)
12. [Where the tests are](#12-where-the-tests-are)
13. [Corrections to the pre-existing docs set](#13-corrections-to-the-pre-existing-docs-set)
14. [Checklist: adding a new gated route](#14-checklist-adding-a-new-gated-route)
15. [Related documents](#15-related-documents)

---

## 1. The mental model: two independent axes

Authorisation in this app is the **intersection of two orthogonal things**:

| Axis | Field | Question it answers | Enforced by |
|---|---|---|---|
| **Role** | `User.role` | *What kind of operation may you perform?* | `authorize(...)` in `server/routes/*.js` |
| **Organisation** | `User.organization` | *Which tenant's rows may you touch?* | `buildScopeFilter` / `canAccessDoc` / `orgGate` in controllers |

A third, narrower axis rides on top for two roles:

| Axis | Field | Question | Enforced by |
|---|---|---|---|
| **Ownership** | `<doc>.teamLead` FK → `User._id` | *Is this row yours?* | `buildScopeFilter` / `canAccessDoc`, only for `team_lead` and `skillhub` |

**The single most important thing to internalise:** role checks live at the *route* layer and are
coarse. Tenant and ownership checks live *inside controllers* and are what actually stop a LUC team
lead from reading a Skillhub student. If you add a route and forget the controller-side scoping, the
role check alone will happily leak another tenant's data. There is no framework-level tenant
isolation — it is convention plus three helper functions.

---

## 2. The four roles

The enum is declared once, at `server/models/User.js:30-34`:

```js
role: {
    type: String,
    enum: ['admin', 'team_lead', 'manager', 'skillhub'],
    required: [true, 'Please specify a role'],
},
```

| Role | Human meaning | Organisation | Scoped by `teamLead` FK? | Landing page |
|---|---|---|---|---|
| `admin` | Cross-organisation operator. Sees LUC **and** both Skillhub branches, switches between them with a UI toggle. | Stored as `luc`, but ignored for scoping | No | `/admin/dashboard` |
| `team_lead` | LUC sales team lead. Nine of them, one per team. Owns their consultants, commitments, students, meetings. | `luc` | **Yes** | `/team-lead/dashboard` |
| `manager` | A narrow, mostly-read LUC role created for one person (`server/scripts/createManager.js`). Has no dashboard of its own. | `luc` | No | `/student-database` |
| `skillhub` | **One shared login per Skillhub branch** — `training@skillhub.com` and `institute@skillhub.com`. Acts as the branch's own admin. | `skillhub_training` or `skillhub_institute` | **Yes** | `/skillhub/dashboard` |

### Notes that matter

- **`skillhub` is a branch login, not a person.** Everything a Skillhub branch creates is owned by
  that single `User._id` via the `teamLead` FK. The individual counselors seeded by
  `server/scripts/seedDatabase.js:165-175` are `Consultant` documents, **not** `User` accounts — they
  have no login. So "which counselor entered this" is a denormalised string field, not an identity.
- **`manager` is a special case throughout.** It is the only role with a deliberate cross-tenant
  carve-out (Export Center → Students, see [§8.3](#83-export-center--assertdatasetaccess-and-the-manager-exception)),
  yet it is *also* the role most often forgotten in `authorize(...)` lists — which in several places
  means it accidentally has *more* access than intended, not less (see [§11](#11-known-gaps-and-traps)).
- **There is no `consultant` role.** Dead branches checking `req.user.role === 'consultant'` still
  exist at `server/controllers/userController.js:61`, `:99` and
  `server/controllers/authController.js:20`. They can never fire. Do not model anything on them.
- **`isActive: false` is the soft-delete / disable mechanism.** `protect` rejects a deactivated user
  with 401 on every request (`server/middleware/auth.js:36-41`), and `login` rejects them separately
  (`server/controllers/authController.js:82-87`). Deactivating is immediate — it does **not** wait for
  the JWT to expire, because `protect` re-reads the user from the database on every single request.

---

## 3. The three organisations

Declared once, at `server/config/organizations.js:1-19`:

```js
const ORG_LUC = 'luc';
const ORG_SKILLHUB_TRAINING = 'skillhub_training';
const ORG_SKILLHUB_INSTITUTE = 'skillhub_institute';

const ORGANIZATIONS = [ORG_LUC, ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];
const SKILLHUB_ORGS = [ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];

const isSkillhub = (org) => SKILLHUB_ORGS.includes(org);
const isLuc = (org) => org === ORG_LUC;
```

| Value | Business unit | Who logs in | Notes |
|---|---|---|---|
| `luc` | Learners Education Consultancy — the original org | admin, 9 × team_lead, manager | 9 sales teams. Default for every model (`User.js:38`). |
| `skillhub_training` | Skillhub Training branch | `training@skillhub.com` | Reported as **empty** (0 students ever recorded) as of 2026-06-18. **UNVERIFIED** — this is a database-state claim, not derivable from code; re-check in Atlas before relying on it. |
| `skillhub_institute` | Skillhub Institute branch — IGCSE/CBSE coaching | `institute@skillhub.com` | The active Skillhub branch. Sole owner of the `/institute` feature. |

Every tenant-scoped collection carries an `organization` field with this enum. `User.organization` is
`required: true` with `default: ORG_LUC` and is **indexed** (`server/models/User.js:35-41`).

> **Trap — `isSkillhub()` vs `=== 'skillhub_institute'`.** "Skillhub" is two tenants, not one. Code
> that means *the Institute branch specifically* must compare against `ORG_SKILLHUB_INSTITUTE`, not
> call `isSkillhub()`. The Institute feature gets this right (`assertInstitute`,
> [§8.2](#82-the-institute-feature--assertinstitute)); a Training login that slipped through an
> `isSkillhub()` check would see Institute students' attendance records.

---

## 4. How a request gets authorised (the pipeline)

```
HTTP request
   │
   ├─ 1. helmet()                    server/server.js:20-25      (headers only, no authz)
   ├─ 2. cors()                      server/server.js:28         (allows ALL origins — see §11.7)
   │
   ├─ 3. protect                     server/middleware/auth.js:5-50
   │       • Reads `Authorization: Bearer <jwt>`      → 401 if absent
   │       • jwt.verify(token, process.env.JWT_SECRET) → 401 if invalid/expired
   │       • req.user = await User.findById(decoded.id) → 401 if user deleted
   │       • 401 if !req.user.isActive
   │
   ├─ 4. orgGate('luc')  (only on some routers)  server/middleware/orgGate.js:4-10
   │       • 403 unless req.user.organization === the named org
   │
   ├─ 5. authorize(...roles)         server/middleware/auth.js:53-63
   │       • 403 unless roles.includes(req.user.role)
   │
   └─ 6. controller
           • buildScopeFilter(req)   → the Mongo filter for list/aggregate reads
           • canAccessDoc(user, doc) → the check for single-document read/write
           • resolveOrganization(req)→ the org stamped on a new document
           • plus feature-specific gates: assertInstitute(), assertDatasetAccess()
```

### The JWT carries almost nothing

`server/models/User.js:85-89`:

```js
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};
```

The payload is `{ id, role }` only. **The `role` claim in the token is never actually used for
authorisation** — `authorize()` reads `req.user.role`, which `protect` loaded fresh from MongoDB
(`server/middleware/auth.js:27`). Two consequences worth knowing:

- **Role and organisation changes take effect on the next request**, with no re-login and no token
  rotation. Change `User.organization` in Atlas and the very next API call is scoped to the new org.
- **The token cannot be privilege-escalated by editing the client's copy of the user object.** Even a
  forged `role` claim inside a validly-signed token would be ignored.

There is no token revocation list and no refresh-token flow. `GET /api/auth/logout`
(`server/controllers/authController.js:112-118`) returns success and does nothing server-side; the
client simply drops the token. **A stolen token stays valid until `JWT_EXPIRE` elapses** — the only
kill switch is `isActive: false` on the user (or rotating `JWT_SECRET`, which invalidates everyone).

### Auth-related environment variables

| Name | Used at | Purpose |
|---|---|---|
| `JWT_SECRET` | `server/middleware/auth.js:25`, `server/models/User.js:86`, `server/services/realtime.js:38` | Signing/verification key. Rotating it logs everyone out. |
| `JWT_EXPIRE` | `server/models/User.js:87` | Token lifetime string passed to `jsonwebtoken`. |
| `JWT_REFRESH_EXPIRE` | *nowhere* | Listed in `CLAUDE.md` but **grep finds zero code references**. There is no refresh flow. Treat as vestigial. |

No secret values appear in this document. See `docs/handover/11-credentials-and-access-handover.md`
for the inventory and rotation runbook.

### Socket.IO uses the same identity

`server/services/realtime.js:36-60` verifies the same JWT from `socket.handshake.auth.token`, re-loads
the user, then joins rooms:

- `org:<organization>` — every user
- `org:<organization>:admin` — admins only
- `org:<organization>:team:<userId>` — team leads only

Broadcasts go through `emitToOrg(organization, ...)` (`:68-71`), so realtime events are org-scoped the
same way REST reads are.

> Note: an `admin` joins `org:luc` (their stored organisation), so **admins do not receive
> `skillhub_institute` realtime events** even though they can read that data over REST. Live-updating
> Institute screens will not tick for an admin. This is a quirk, not a security issue.

---

## 5. The three scoping helpers, precisely

All three live in `server/middleware/auth.js`. Learn these three functions and you understand 90% of
the app's data isolation.

### 5.1 `buildScopeFilter(req)` — the filter for list & aggregate reads

`server/middleware/auth.js:69-86`:

```js
exports.buildScopeFilter = (req) => {
    const user = req.user;
    const filter = {};

    if (user.role === 'admin') {
        if (req.query && req.query.organization) {
            filter.organization = req.query.organization;
        }
    } else {
        filter.organization = user.organization;
    }

    if (user.role === 'team_lead' || user.role === 'skillhub') {
        filter.teamLead = user._id;
    }

    return filter;
};
```

Exact output per role:

| Role | Returned filter | Effect |
|---|---|---|
| `admin`, no `?organization=` | `{}` | **Every row in every organisation.** |
| `admin`, `?organization=luc` | `{ organization: 'luc' }` | Just LUC. |
| `admin`, `?organization=skillhub_institute` | `{ organization: 'skillhub_institute' }` | Just that branch. |
| `team_lead` | `{ organization: 'luc', teamLead: <own _id> }` | Own team's LUC rows only. |
| `manager` | `{ organization: 'luc' }` | **All LUC rows, every team.** No ownership narrowing. |
| `skillhub` | `{ organization: <own branch>, teamLead: <own _id> }` | Own branch only. |

Three things to notice:

1. **An admin with no `?organization=` param gets a completely empty filter.** This is by design — it
   is how the "All" org scope works. It also means an admin endpoint that forgets to add any other
   filter returns the entire collection.
2. **The admin org param is read from the query string only.** It is injected client-side by an axios
   interceptor (see [§9.3](#93-the-admin-org-switch-is-a-client-side-localstorage-value)) — the server
   simply trusts whatever an authenticated admin sends, which is fine because admins are cross-org by
   definition.
3. **`manager` gets org scoping but no ownership scoping.** That is intentional (it is a
   cross-team reporting role), and it is exactly why `manager` must be kept out of `authorize()` lists
   for anything write-shaped.

**Consumers** (grep-verified): `studentController.js:101,775`, `commitmentController.js:79,497,526,586,632,686`,
`meetingController.js:75,139,382`, `consultantController.js:11`, `paymentPlanController.js:16`,
`hourlyController.js:19,32,234`, plus the export builders
`server/services/exports/pivots/commitments.js:65` and `.../meetings.js:39`.

> `server/controllers/userController.js:2` imports `buildScopeFilter` but **never calls it** — a dead
> import. User listing does its own thing (see the matrix, `/api/users`).

#### The `hourlyScopeFilter` variant

`HourlyActivity` / `DailyAdmission` / `DailyReference` have **no `teamLead` FK**, so
`server/controllers/hourlyController.js:18-21` strips it:

```js
function hourlyScopeFilter(req) {
    const { teamLead, ...rest } = buildScopeFilter(req);
    return rest;   // organization-only scoping
}
```

And `leaderboardConsultantScope` (`:28-33`) deliberately widens LUC team leads to the whole LUC tenant
so they can benchmark against other teams. That is a documented product decision, not a bug.

### 5.2 `canAccessDoc(user, doc)` — the check for single-document read/write

`server/middleware/auth.js:91-100`:

```js
exports.canAccessDoc = (user, doc) => {
    if (!doc) return false;
    if (user.role === 'admin') return true;
    if (doc.organization && doc.organization !== user.organization) return false;
    if (user.role === 'team_lead' || user.role === 'skillhub') {
        const ownerId = doc.teamLead?._id || doc.teamLead;
        if (!ownerId || ownerId.toString() !== user._id.toString()) return false;
    }
    return true;
};
```

| Role | Passes when… |
|---|---|
| `admin` | Always (short-circuits on line 93). |
| `team_lead` | `doc.organization` matches **and** `doc.teamLead` equals their own `_id`. |
| `skillhub` | Same as `team_lead`, matched against their branch org. |
| `manager` | `doc.organization` matches only — **no ownership check**. |

It handles both a populated `teamLead` (`.teamLead._id`) and a raw ObjectId, which matters because
several controllers `.populate('teamLead', ...)` before checking.

> ### ⚠ Trap: a document with **no** `organization` field bypasses the tenant check
>
> Line 94 is `if (doc.organization && ...)`. A legacy row that predates multi-tenancy and never got
> backfilled has `organization === undefined`, so the org comparison is **skipped entirely**. For a
> `manager` — who has no ownership check either — such a document is fully readable and writable
> regardless of which tenant it really belongs to.
>
> There is a matching asymmetry: `buildScopeFilter` *always* sets `filter.organization` for
> non-admins, so those same rows are **invisible in lists** but **reachable by direct `/:id`**.
>
> This is precisely why `server/scripts/migrateOrganization.js` exists (idempotent backfill across all
> pre-multi-tenant collections). **Run it after importing any legacy data.**

**Consumers:** `studentController.js:267,479,619,652,722`, `commitmentController.js:121,263,423,466`,
`meetingController.js:186,285`, `consultantController.js:121,181`, `paymentPlanController.js:45,92,118`.

### 5.3 `resolveOrganization(req)` — the org stamped on a new document

`server/middleware/auth.js:105-110`:

```js
exports.resolveOrganization = (req) => {
    if (req.user.role === 'admin') {
        return req.body.organization || 'luc';
    }
    return req.user.organization;
};
```

| Role | Result | Body `organization` respected? |
|---|---|---|
| `admin` | `req.body.organization`, else `'luc'` | Yes |
| everyone else | `req.user.organization` (from the DB) | **No — silently ignored** |

**This is the anti-spoofing primitive.** A `skillhub` login can `POST` a body containing
`organization: 'luc'` and it will be discarded. Verified by test:
`server/tests/exports/students.test.js:201` — *"team_lead body-spoofing organization=skillhub_training
is treated as LUC"*.

In practice most create paths do something even stronger — they derive the organisation from an
authoritative *related document* rather than from the body at all:

| Create path | How `organization` is decided |
|---|---|
| `POST /api/students` | `studentController.js:326-348` — non-admin: from token. Admin: from the **picked team lead's** `User.organization`, falling back to `resolveOrganization(req)`. |
| `POST /api/commitments` | `commitmentController.js:176-204` — non-admin: from token, plus `teamLead`/`teamName`/`createdBy` all forced to the caller. Admin: `resolveOrganization(req)` + a required `teamLead` in the body. |
| `POST /api/meetings` | `meetingController.js:206-217` — identical shape. |
| `POST /api/consultants` | `consultantController.js:57-77` — admin resolves org from the target team lead (`tlUser?.organization`). |
| `PUT /api/hourly/slot` | `hourlyController.js:352-360` — org comes from the **target `Consultant` document**, and a non-admin whose org differs gets 403. |
| `POST /api/institute/*` | Never uses `resolveOrganization` — hard-pinned to `skillhub_institute` (`instituteController.js:19`). |

---

## 6. `orgGate` — whole-feature organisation locks

`server/middleware/orgGate.js:4-10`:

```js
module.exports = (org) => (req, res, next) => {
    if (req.user && req.user.organization === org) return next();
    return res.status(403).json({
        success: false,
        message: `This resource is restricted to ${org} users.`,
    });
};
```

It is a plain equality check on `req.user.organization`, so it is **role-blind**. Two consequences
that surprise people:

- An `admin` passes `orgGate('luc')` only because admins are *stored* with `organization: 'luc'`. If
  anyone ever creates an admin with a Skillhub organisation, that admin is locked out of every
  LUC-gated feature. **Keep admins on `organization: 'luc'`.**
- A `manager` also has `organization: 'luc'`, so `orgGate('luc')` does **not** exclude managers. The
  Docs RAG chatbot is gated only by `orgGate('luc')`, which means managers can use it (see
  [§8.5](#85-docs-rag--org-gated-not-role-gated)).

Routers that mount it (always after `protect`, before `authorize`):

| Mount | File:line |
|---|---|
| `/api/exec-overview` | `server/routes/execOverview.js:14` |
| `/api/team-entries` | `server/routes/teamEntries.js:15` |
| `/api/tiers` | `server/routes/tiers.js:18` |
| `/api/payment-plans` | `server/routes/paymentPlans.js:17` |
| `POST /api/docs-chat/` | `server/routes/docsChat.js:320` (per-route, not router-wide) |
| `/program-docs/*` static | `server/server.js:63` |
| `/program-docs-highlighted/*` static | `server/server.js:77` |
| `/program-docs-snippets/*` static | `server/server.js:91` |

Because `orgGate` runs before `authorize` on those routers, a `skillhub` login hitting
`/api/exec-overview` gets *"This resource is restricted to luc users"*, not a role error. Useful when
debugging a 403.

---

## 7. The definitive route × role permission matrix

Derived by reading every `authorize(...)` call in `server/routes/*.js`. All 19 routers are mounted in
`server/server.js:35-53`.

Legend: **✓** allowed at the route layer · **—** 403 at the route layer · **org** additionally
restricted by `orgGate` · footnotes mark further controller-level narrowing.

### 7.1 Auth — `server/routes/auth.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| POST | `/api/auth/register` | ✓ | — | — | — | `:14` |
| POST | `/api/auth/login` | *public* | *public* | *public* | *public* | `:15` |
| GET | `/api/auth/logout` | ✓ | ✓ | ✓ | ✓ | `:16` |
| GET | `/api/auth/me` | ✓ | ✓ | ✓ | ✓ | `:17` |
| PUT | `/api/auth/updatepassword` | ✓ | ✓ | ✓ | ✓ | `:18` |

`updatePassword` verifies the current password first (`authController.js:144-149`) and can only ever
change the caller's own record (`findById(req.user.id)`).

### 7.2 Users — `server/routes/users.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/users` | ✓ | ✓ ¹ | — | ✓ ¹ | `:20` |
| GET | `/api/users/team/:teamLeadId` | ✓ | ✓ ² | — | ✓ ² | `:24` |
| GET | `/api/users/:id` | ✓ | ✓ ³ | **✓ ⁴** | **✓ ⁴** | `:28` |
| PUT | `/api/users/:id` | ✓ ⁵ | ✓ ³ | **✓ ⁴** | **✓ ⁴** | `:29` |
| DELETE | `/api/users/:id` (soft) | ✓ | — | — | — | `:30` |
| DELETE | `/api/users/:id/permanent` | ✓ ⁶ | — | — | — | `:34` |

1. `userController.js:11-32` — `team_lead` sees `{team_lead, admin}` in their org; `skillhub` sees
   `{skillhub, admin}` in their org; `admin` sees everyone (optionally `?organization=`). Any other
   role falls to an explicit 403 at `:28-32`.
2. `userController.js:209-214` — a `team_lead` may only pass their own id. **`skillhub` is not checked**,
   but the query is `role: 'consultant'`, which no `User` can have, so it always returns `[]`. Dead endpoint.
3. `userController.js:68-73` / `:106-111` — a `team_lead` may read a user whose `teamLead` is them, or
   themselves; may update **only** themselves.
4. **No role gate on the route and no controller check for these roles.** See [§11.1](#111-any-authenticated-user-can-read-and-partially-write-any-user-record).
5. Only `admin` may set `role`, `teamLead`, `teamName`, `isActive` (`userController.js:120-125`). Everyone
   else is limited to `name` and `phone` (`:114-117`). **`organization` is not updatable through this
   endpoint by anyone.**
6. Refuses to permanently delete an account whose role is `admin` (`userController.js:184-189`).

### 7.3 Commitments — `server/routes/commitments.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/commitments` | ✓ | ✓ | **✓ ¹** | ✓ | `:27` |
| POST | `/api/commitments` | ✓ | ✓ | — | ✓ | `:28` |
| GET | `/api/commitments/date-range` | ✓ | ✓ | — | ✓ | `:34` |
| GET | `/api/commitments/linkable` | ✓ | ✓ | — | — | `:38` |
| GET | `/api/commitments/ai-analysis` | ✓ | ✓ | — | — | `:41` |
| GET | `/api/commitments/week/:weekNumber/:year` | ✓ | ✓ | **✓ ¹** | ✓ | `:44` |
| GET | `/api/commitments/consultant/:consultantName/performance` | ✓ | ✓ | — | ✓ | `:49` |
| PUT | `/api/commitments/:id/close-admission` | ✓ | ✓ | — | ✓ | `:54` |
| PUT | `/api/commitments/:id/meetings` | ✓ | ✓ | — | ✓ | `:55` |
| GET | `/api/commitments/:id` | ✓ | ✓ | **✓ ¹** | ✓ | `:60` |
| PUT | `/api/commitments/:id` | ✓ | ✓ | — | ✓ | `:61` |
| DELETE | `/api/commitments/:id` | ✓ | — | — | — | `:62` |

1. **No `authorize()` on these three reads.** A `manager` therefore reads every LUC commitment
   (`buildScopeFilter` gives them `{organization:'luc'}`) even though the Export Center explicitly
   denies them the commitments dataset. Inconsistent — see [§11.2](#112-manager-can-read-commitments-over-rest-but-not-through-the-export-center).

**Business invariant enforced in the controller, not by roles:** once `admissionClosed === true`, *no
role* can reverse it — `commitmentController.js:296-301` returns 400 for everyone, admin included.

Route ordering matters here: the specific paths must precede `/:id` or Express matches `/:id` first.
The file carries explicit comments about this (`:30-31`, `:53`, `:57`).

### 7.4 Students — `server/routes/students.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/students/stats` | ✓ | ✓ | ✓ | ✓ | `:22` |
| GET | `/api/students/programs` | ✓ | ✓ | — | — | `:25` |
| GET | `/api/students` | ✓ | ✓ | ✓ | ✓ | `:29` |
| POST | `/api/students` | ✓ | ✓ | — | ✓ | `:30` |
| PATCH | `/api/students/:id/activate` | ✓ | — | — | ✓ | `:33` |
| PATCH | `/api/students/:id/status` | ✓ | — | — | ✓ | `:35` |
| GET | `/api/students/:id` | ✓ | ✓ | ✓ | ✓ | `:39` |
| PUT | `/api/students/:id` | ✓ | ✓ | — | ✓ | `:40` |
| DELETE | `/api/students/:id` | ✓ | ✓ | — | ✓ | `:41` |

`manager` is read-only here by construction: present on three of the four read routes (`/stats`,
`GET /`, `GET /:id` — **not** `/programs`, which is `authorize('admin','team_lead')` at `students.js:25`),
and absent from all five write routes. That is the cleanest expression of the role's intent anywhere in
the codebase.

The `activate` / `status` transitions are Skillhub-only in the controller too — they 400 on a LUC
student (`studentController.js:659-661`).

**Delete is a hard delete** (`studentController.js:626`, `findByIdAndDelete`), available to a team lead
for their own rows. There is no undo and no audit row.

### 7.5 Consultants — `server/routes/consultants.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/consultants` | ✓ | ✓ ¹ | ✓ | ✓ | `:19` |
| POST | `/api/consultants` | ✓ | ✓ | — | ✓ | `:20` |
| PUT | `/api/consultants/:id` | ✓ | ✓ | — | ✓ | `:24` |
| DELETE | `/api/consultants/:id` (soft) | ✓ | ✓ | — | ✓ | `:25` |
| DELETE | `/api/consultants/:id/permanent` | ✓ | — | — | — | `:29` |

1. **`?scope=all` escape hatch:** `consultantController.js:15-17` — an `admin` **or `team_lead`** passing
   `?scope=all` drops the ownership filter and lists every consultant in their organisation. Added so
   team leads can view other teams' sheets in the Leadership dashboards. Reads only; the write routes
   still go through `canAccessDoc`.

### 7.6 Meetings — `server/routes/meetings.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/meetings` | ✓ | ✓ | — | ✓ | `:23` |
| POST | `/api/meetings` | ✓ | ✓ | — | ✓ | `:24` |
| GET | `/api/meetings/stats` | ✓ | ✓ | — | ✓ | `:27` |
| GET | `/api/meetings/ai-analysis` | ✓ | ✓ | — | **—** ¹ | `:30` |
| GET | `/api/meetings/:id` | ✓ | ✓ | — | ✓ | `:34` |
| PUT | `/api/meetings/:id` | ✓ | ✓ | — | ✓ | `:35` |
| DELETE | `/api/meetings/:id` | ✓ ² | — | — | — | `:36` |

1. Deliberately left LUC-shaped because the endpoint is OpenAI-billed and no Skillhub UI calls it. The
   route file says so at `:28-29`. **Do not widen it without a UI that needs it.**
2. Belt-and-braces: `meetingController.js:341-346` re-checks `role !== 'admin'` inside the handler even
   though `authorize('admin')` already ran.

### 7.7 Hourly Tracker — `server/routes/hourly.js`

**Every route is `protect` only — there is no `authorize()` anywhere in this file** (`:24`,
comment at `:23` says "any role"). Scoping is entirely inline in `hourlyController.js`.

| Method | Path | admin | team_lead | manager | skillhub |
|---|---|:--:|:--:|:--:|:--:|
| GET | `/api/hourly/ai-analysis` | ✓ | ✓ | **✓** | ✓ |
| GET | `/api/hourly/leaderboard` · `/leaderboard/weekly` | ✓ | ✓ ¹ | **✓** | ✓ |
| GET | `/api/hourly/consultants` · `/day` · `/month` | ✓ | ✓ | **✓** | ✓ |
| PUT | `/api/hourly/slot` | ✓ | ✓ ² | **✓ ²** | ✓ ² |
| DELETE | `/api/hourly/slot` · `/day` | ✓ | ✓ | **✓** | ✓ |
| GET/PUT | `/api/hourly/admissions[/month]` · `/references[/month]` | ✓ | ✓ | **✓** | ✓ |

1. LUC team leads see the whole LUC tenant on the leaderboards by design
   (`hourlyController.js:28-33`).
2. `upsertSlot` enforces **organisation only**, not team ownership
   (`hourlyController.js:357-359`), plus a "today only" rule for non-admins (`:343-348`). See
   [§11.3](#113-hourly-tracker-writes-are-org-scoped-but-not-team-scoped).

### 7.8 Notifications & Announcements

`server/routes/notifications.js` — `protect` only except one route:

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/notifications` | ✓ | ✓ | ✓ | ✓ | `:17` |
| PATCH | `/api/notifications/read-all` | ✓ | ✓ | ✓ | ✓ | `:18` |
| POST | `/api/notifications/generate-reminders` | ✓ | ✓ | — | — | `:19` |
| PATCH | `/api/notifications/:id/read` | ✓ | ✓ | ✓ | ✓ | `:20` |
| DELETE | `/api/notifications/:id` | ✓ | ✓ | ✓ | ✓ | `:21` |

Safe because every query is keyed on `{ user: req.user.id }` and single-doc mutations re-check
ownership (`notificationController.js:9, 37, 63, 163`). You can only ever see or touch your own
notifications.

`server/routes/announcements.js` — `protect` only, all four roles. Scoped by
`organization: req.user.organization` (`announcementController.js:12`).

### 7.9 AI analysis — `server/routes/ai.js`

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| POST | `/api/ai/analysis` | ✓ | ✓ | — | ✓ | `:16` |
| POST | `/api/ai/student-analysis` | ✓ | ✓ | — | ✓ | `:19` |
| GET | `/api/ai/analysis-targets` | ✓ | — | — | — | `:23` |
| POST | `/api/ai/team-analysis` | ✓ | — | — | — | `:24` |
| POST | `/api/ai/consultant-analysis` | ✓ | — | — | — | `:25` |
| GET | `/api/ai/usage` | ✓ | — | — | — | `:26` |

Data scoping inside `aiController.generateDashboardAnalysis` (`:34-71`):

| Caller | Aggregation used |
|---|---|
| `admin` | `aggregateAdminData(...)` — everything |
| `team_lead` **and** `organization === 'luc'` | `aggregateAdminData(..., 'luc')` — **org-wide**, deliberately, so leads can benchmark |
| any other `team_lead`, or `skillhub` | `aggregateTeamLeadData(req.user.id, ...)` — own rows only |
| anything else | explicit 403 at `:66-70` |

### 7.10 Export Center — `server/routes/exports.js`

**No `authorize()` at all** — the whole file is `protect` (`:16`) plus per-request
`assertDatasetAccess` in the controller. See [§8.3](#83-export-center--assertdatasetaccess-and-the-manager-exception).

| Method | Path | Rate-limited? | Line |
|---|---|---|---|
| POST | `/api/exports/raw` | no | `:20` |
| POST | `/api/exports/pivot` | **yes** — 5/min/user | `:21` |
| GET | `/api/exports/dimensions/:dataset` | no | `:22` |
| GET | `/api/exports/templates` | no | `:24` |
| POST | `/api/exports/template/:templateId` | **yes** | `:25` |
| GET/POST | `/api/exports/saved-templates` | no | `:27` |
| DELETE | `/api/exports/saved-templates/:id` | no | `:28` |

Saved templates are owner-scoped by `{ user: req.user._id }` on read, create and delete
(`exportController.js:295, 313, 321, 338`) — no role check needed and none present.

The limiter is `server/middleware/exportRateLimit.js`, keyed on `req.user._id` with an IP fallback.

### 7.11 Executive / Leadership dashboards — `server/routes/execOverview.js`

Router-wide: `protect` (`:13`) then `orgGate('luc')` (`:14`).

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/exec-overview/teams` | ✓ | ✓ | — | **org** | `:17` |
| GET | `/api/exec-overview/consultant-performance` | ✓ | ✓ | — | **org** | `:18` |
| GET | `/api/exec-overview/team/:teamLeadId` | ✓ | ✓ ¹ | — | **org** | `:19` |
| GET | `/api/exec-overview` | ✓ | ✓ | — | **org** | `:20` |

1. **Reads are fully relaxed:** `execOverviewController.js:47-50` explicitly does *not* restrict a team
   lead to their own `teamLeadId` — *"Read-only is open across teams: team leads can view ANY team's
   detail."* Writes are what stays admin-only.

**Note:** the JSDoc immediately above that code (`:40-41`) still claims *"team_lead is locked to their
own user id (anything else → 403)"*. **The comment is stale; the code below it is authoritative.**

### 7.12 Team entries (the writable half of the Leadership dashboards) — `server/routes/teamEntries.js`

Router-wide: `protect` (`:14`) + `orgGate('luc')` (`:15`).

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/team-entries/meta` | ✓ | ✓ | — | **org** | `:21` |
| GET | `/api/team-entries` | ✓ | ✓ ¹ | — | **org** | `:22` |
| POST | `/api/team-entries/bulk` | ✓ | **—** | — | **org** | `:23` |
| PUT | `/api/team-entries` | ✓ | **—** | — | **org** | `:24` |
| DELETE | `/api/team-entries/:id` | ✓ | **—** | — | **org** | `:25` |

1. `teamEntryController.readScope` (`:24-28`) narrows a team lead's *list* read to their own rows —
   note this is **stricter** than `/api/exec-overview/team/:id`, which lets them view any team.

The controller also keeps an unused-but-correct `assertWriteAccess` helper (`:32-40`) that would allow
a team lead to write their own consultants' rows. It is currently unreachable because the routes are
admin-only. **This is the read-relaxed / write-locked split in one file:** reads open, mutations
admin-only, because the dashboard is treated as a single admin-maintained source of truth
(comment at `teamEntries.js:17-20`).

Payloads are whitelisted, not spread — `pickEditableFields` (`:45+`) lets only numeric fields and
`notes` through; `organization`, `teamLead` etc. are always set server-side.

### 7.13 Tier Fight — `server/routes/tiers.js`

`protect` (`:17`) + `orgGate('luc')` (`:18`).

| Method | Path | admin | team_lead | manager | skillhub | Line |
|---|---|:--:|:--:|:--:|:--:|---|
| GET | `/api/tiers` | ✓ | ✓ | — | **org** | `:21` |
| GET | `/api/tiers/latest-image` | ✓ | ✓ | — | **org** | `:22` |
| GET | `/api/tiers/images` | ✓ | ✓ | — | **org** | `:23` |
| POST | `/api/tiers/generate-image` | ✓ | — | — | **org** | `:26` |
| PUT | `/api/tiers/:tier` | ✓ | — | — | **org** | `:27` |

Same shape as team entries: reads for both LUC roles, mutations admin-only (image generation is
OpenAI-billed).

### 7.14 Payment plans — `server/routes/paymentPlans.js`

`protect` (`:16`) + `orgGate('luc')` (`:17`). All four routes are `authorize('admin','team_lead')`
(`:21, :22, :26, :27`); per-team narrowing is `buildScopeFilter` / `canAccessDoc` inside
`paymentPlanController.js:16, 45, 92, 118`.

### 7.15 Reconciliation — `server/routes/reconciliation.js`

Router-wide `authorize('admin')` (`:14`). All five routes are admin-only, because pairing a commitment
to a student can flip `admissionClosed = true` (comment at `:12`).

### 7.16 Skillhub Institute — `server/routes/institute.js`

Router-wide `protect` (`:58`) + `authorize('admin','skillhub')` (`:59`), then `assertInstitute` inside
**every one of the 24 handlers**. See [§8.2](#82-the-institute-feature--assertinstitute).

| Group | Paths | admin | team_lead | manager | skillhub (Institute) | skillhub (Training) |
|---|---|:--:|:--:|:--:|:--:|:--:|
| Teachers | `/teachers`, `/teachers/:id` | ✓ | — | — | ✓ | **403** |
| Timetable | `/timetable`, `/timetable/:id`, `/timetable/import` | ✓ | — | — | ✓ | **403** |
| Students / birthdays | `/students`, `/birthdays` | ✓ | — | — | ✓ | **403** |
| Attendance | `/attendance*`, `/attendance/roster`, `/attendance/entry`, `/attendance/student` | ✓ | — | — | ✓ | **403** |
| Tests | `/tests`, `/tests/:id`, `/tests/meta` | ✓ | — | — | ✓ | **403** |

`POST /api/institute/timetable/import` additionally carries its own rate limiter (10/min/user,
`institute.js:29-36`) and a multer file-type/size gate (`:13-25`).

### 7.17 Chat — `server/routes/chat.js`

`protect` only (`:17`). **All four roles, and deliberately unscoped data.** See
[§8.4](#84-the-chatbot-is-deliberately-unscoped).

| Method | Path |
|---|---|
| POST | `/api/chat/stream` |
| POST | `/api/chat/transcribe` (25 MB in-memory audio cap, `:22-25`) |
| GET | `/api/chat/conversations` · `/conversations/:id` |
| DELETE | `/api/chat/conversations/:id` |
| POST | `/api/chat/classify` |

Conversation CRUD is owner-scoped (`chatController.js:70, 87, 178`).

### 7.18 Docs RAG — `server/routes/docsChat.js`

| Method | Path | Gate | Line |
|---|---|---|---|
| GET | `/api/docs-chat/health` | **none — fully public** (Render readiness probe) | `:61` |
| POST | `/api/docs-chat/admin/reingest` | `protect` + `authorize('admin')` | `:78` |
| GET | `/api/docs-chat/stats` | `protect` + `authorize('admin')` | `:121` |
| POST | `/api/docs-chat/feedback` | `protect`; own log only, admins any (`:286-291`) | `:275` |
| POST | `/api/docs-chat/` | `protect` + **`orgGate('luc')`** — no role check | `:320` |

A kill switch runs before everything except `/health` and `/stats` (`:20-23`), returning 503 when
`DOCS_RAG_ENABLED=false`.

### 7.19 Static program PDFs — `server/server.js:59-96`

Three mounts (`/program-docs`, `/program-docs-highlighted`, `/program-docs-snippets`), each
`docsRagEnabled` → `protect` → `orgGate('luc')` → `express.static`. The kill switch is deliberately
**first** so a disabled feature returns 503 without leaking the 401/403 distinction
(`docsRagEnabled.js:7-9`).

### 7.20 Unauthenticated endpoints (complete list)

| Endpoint | Why |
|---|---|
| `POST /api/auth/login` | Obviously. |
| `GET /api/health` | `server/server.js:99-104` — trivial liveness JSON. |
| `GET /api/docs-chat/health` | `docsChat.js:61-75` — Render readiness. Leaks operational metadata (chunk counts, whether `GROQ_API_KEY`/`OPENAI_API_KEY` are set as booleans, process uptime). No secret values, but note it is world-readable. |
| `GET /*` (non-`/api`) in production | `server/server.js:111-113` — the SPA `index.html`. |

---

## 8. Feature-specific gates

### 8.1 How a Skillhub branch login is pinned to its own organisation

There is no single "Skillhub" tenant. `training@skillhub.com` and `institute@skillhub.com` are two
separate `User` rows with different `organization` values, seeded at
`server/scripts/seedDatabase.js:128-165`. The pinning is achieved by four independent mechanisms that
all point the same way:

| Mechanism | Where | Effect |
|---|---|---|
| List reads | `buildScopeFilter` (`auth.js:78, 81-83`) | `{ organization: <own branch>, teamLead: <own _id> }` |
| Single-doc access | `canAccessDoc` (`auth.js:94-98`) | org **and** ownership must match |
| Creates | `resolveOrganization` (`auth.js:109`) + per-controller overrides | org taken from the token; a body `organization` is discarded |
| Feature locks | `orgGate('luc')` on 4 routers + `POST /api/docs-chat/` + 3 static mounts (full list in [§6](#6-orggate--whole-feature-organisation-locks)) | Skillhub 403s out of every LUC-only feature |

Because the branch login is also the `teamLead` FK on everything it creates
(`studentController.js:326-330`, `commitmentController.js:176-181`, `meetingController.js:206-208`),
the ownership filter and the org filter are effectively the same filter for Skillhub. A Training login
cannot see Institute rows and vice versa.

**One deliberate relaxation:** Skillhub branch logins may backdate commitments freely
(`commitmentController.js:183-193`) because the branch login *is* the branch's administrator. LUC team
leads are held to the commitment-date-within-week rule.

### 8.2 The Institute feature — `assertInstitute()`

`/institute` is the only feature restricted to a *single* Skillhub branch. Two layers:

**Layer 1 — route:** `server/routes/institute.js:59`

```js
router.use(authorize('admin', 'skillhub'));
```

This stops `team_lead` and `manager`. It does **not** distinguish the two Skillhub branches, because
`authorize` only knows about roles.

**Layer 2 — controller:** `server/controllers/instituteController.js:22-28`

```js
function assertInstitute(req, res) {
    const u = req.user;
    if (u.role === 'admin') return true;
    if (u.role === 'skillhub' && u.organization === INSTITUTE) return true;
    res.status(403).json({ success: false, message: 'Restricted to Skillhub Institute.' });
    return false;
}
```

`INSTITUTE` is `ORG_SKILLHUB_INSTITUTE` (`:19`). **A `training@skillhub.com` login gets 403 here**,
despite passing the route gate.

The call pattern is `if (!assertInstitute(req, res)) return;` as the first line of every handler —
the helper writes the 403 itself and the handler returns without calling `next()`. Grep confirms
**25 occurrences of `assertInstitute(req, res)`: 1 definition + 24 calls, matching all 24 exported
handlers.** If you add a handler to this controller, adding that line is not optional.

Beyond access, `assertInstitute` is paired with hard organisation pinning: every query filters on
`{ organization: INSTITUTE }` and every create stamps it (e.g. `:36`, `:53`, `:68`). The org never
comes from the request.

Covered by tests — `server/tests/institute/attendance.test.js:58-60`,
`.../tests.test.js:65-67`, `.../scheduleImport.test.js:158-160` each assert a Training login gets 403.

The frontend mirrors this at `client/src/components/skillhub/SkillhubSidebar.js:227-232` — the
*Institute* and *Meeting Tracker* nav items render only when
`user.organization === 'skillhub_institute'`.

### 8.3 Export Center — `assertDatasetAccess` and the manager exception

`server/controllers/exportController.js:13-51`. The Export Center does **not** use `authorize()`;
it evaluates a hard-wired matrix per request instead, because the answer depends on *dataset* and
*requested organisation*, not just role.

```js
const m = {
    students:    ['admin', 'team_lead', 'manager', 'skillhub'],
    commitments: ['admin', 'team_lead', 'skillhub'],
    meetings:    ['admin', 'team_lead'],
    hourly:      ['admin', 'team_lead', 'skillhub'],
};
```

Then six checks run, in order (rule 1 is the matrix above):

| # | Rule | Line | Status |
|---|---|---|---|
| 1 | Role not in the dataset's list → 403 | `:20-24` | |
| 2 | `team_lead` + `organization !== 'luc'` → 403 *"team_lead is locked to LUC"* | `:25-29` | |
| 3 | `manager` + dataset other than `students` → 403 | `:30-34` | **the manager exception** |
| 4 | `skillhub` + org that is neither their own nor `'all'` → 403 | `:35-40` | |
| 5 | `organization === 'all'` and role not in `{admin, manager}` → 403 | `:41-45` | **the manager exception** |
| 6 | Unknown `organization` value → 400 | `:46-50` | `VALID_ORGS` at `:9` |

Resulting matrix:

| Dataset | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| `students` | any org + `all` | LUC, own team only | **LUC, Training, Institute, and `all`** | own branch only |
| `commitments` | any org + `all` | LUC, own team only | **403** | own branch only |
| `meetings` | any org + `all` | LUC, own team only | **403** | **403** |
| `hourly` | any org + `all` | LUC, own team only | **403** | own branch only |

#### Why the manager exception exists

`manager` keeps `User.organization === 'luc'` everywhere else in the system — the account is created
without an organisation at all (`server/scripts/createManager.js:23-29`) and picks up the model default.
But on `/exports → Students` the role is explicitly allowed to pick LUC / Skillhub Training / Skillhub
Institute / All. It is a reporting carve-out for consolidated student numbers across both business
units, and it is the **only** place where a non-admin crosses tenants.

It is implemented in two places that must stay in step:

- `assertDatasetAccess` rules 3 and 5 above (the enforcement point).
- `students.resolveOrgScope` at `server/services/exports/pivots/students.js:134-145`, which puts
  `manager` on the same branch as `admin`:
  ```js
  if (user.role === 'admin' || user.role === 'manager') { ... }
  ```
  Note that **only the students builder does this**. `commitments.resolveOrgScope`
  (`.../commitments.js:50-61`) has no `manager` branch and returns `null` for that role — consistent
  with rule 3 denying it anyway.

`buildRawMatch` (`students.js:147-158`) then applies the same split: admin/manager get org-only
filtering, `team_lead` gets `{organization:'luc', teamLead:_id}`, `skillhub` gets
`{organization:<own>, teamLead:_id}`.

Verified by `server/tests/exports/students.test.js:225` (*"manager Export Center exception:
organization=skillhub_training is honored"*), `:231` (*"skillhub user is locked to own
organization"*), `:201` (team_lead body-spoofing) and `:209` (admin `all`).

> The LUC zero-fee hide (`applyHideLucZeroFeeFilter`,
> `server/controllers/studentController.js:58-75`) applies to every Students raw and pivot query,
> including the `'all'` scope. It hides ~626 importer-bug rows with `admissionFeePaid = 0`. That is a
> *data* filter, not a permission — but it means two roles querying "all students" get the same
> reduced row count, which can look like a permissions problem when it is not.

### 8.4 The chatbot is deliberately unscoped

`server/services/chatTools.js:1-6` states it outright:

> *"Every tool here is intentionally UNSCOPED — the chatbot deliberately sees the whole organization
> regardless of which role is asking. Matches the product decision 'anyone can query anything via
> chat' and decouples chat visibility from the strict role-scoping that the REST API enforces."*

Practical consequences you must understand before touching chat:

- `/api/chat/stream` has **no role gate** (`routes/chat.js:17`) and the tools accept an optional
  `organization` argument that defaults to *everything*.
- **A `skillhub` branch login can ask the chatbot about LUC revenue.** A `manager` can ask about
  anything. A `team_lead` can ask about another team.
- The tools are strictly read-only (find/aggregate only), capped by `MAX_ROWS`, and project explicit
  field lists so nothing sensitive leaks by accident (`chatTools.js:8-18`). `User.password` is
  `select: false` at the schema level *and* excluded by projection.
- The floating chat launcher is rendered app-wide in `client/src/App.js:301`, for every authenticated
  role.

If tenant isolation ever becomes a compliance requirement, **this is the first thing that has to
change**, and it is a product decision, not a bug fix.

### 8.5 Docs RAG — org-gated, not role-gated

`POST /api/docs-chat/` is `protect` + `orgGate('luc')` (`docsChat.js:320`) — **no `authorize()`**.
So the allowed set is *every role whose organisation is `luc`*: `admin`, `team_lead` **and
`manager`**. Skillhub branch logins 403.

The client routes to it based on organisation, not role —
`client/src/components/chat/ChatPanel.js:84`:

```js
const isLuc = (user?.organization || 'luc') === 'luc';
```

Additional narrowing inside the handler: `resolveLeadContext` (`docsChat.js:26-55`) will only attach a
student's programme context if the caller is an admin **or** owns that student
(`String(doc.teamLead) === String(user._id)`), and only for `organization: 'luc'` students.

The three static PDF mounts use the identical stack, so a `manager` can also fetch the programme PDFs.
Whether that is intended is **UNVERIFIED — needs confirmation with the business owner.** The stale
`docs/user-guides/05-role-permissions-matrix.md` claims managers cannot, but the code allows it.

### 8.6 Executive Overview — reads relaxed, writes admin-only

The pattern appears three times (Leadership dashboards, Tier Fight, and implicitly Consultant
Performance) and is worth naming because it is a design decision, not an oversight:

| Surface | Reads | Writes |
|---|---|---|
| `/api/exec-overview/*` | `admin` + `team_lead`, **cross-team** (`execOverviewController.js:47-50`) | none — it is a pure read API |
| `/api/team-entries` | `admin` + `team_lead`, own team only (`teamEntryController.js:24-28`) | **`admin` only** (`teamEntries.js:23-25`) |
| `/api/tiers` | `admin` + `team_lead` (`tiers.js:21-23`) | **`admin` only** (`tiers.js:26-27`) |
| `/api/consultants?scope=all` | `admin` + `team_lead`, org-wide (`consultantController.js:15-17`) | scoped as normal |

Rationale, from `teamEntries.js:17-20`: *"the dashboard is treated as a single source of truth
maintained by the admin while the feature is still under development for team leads."*

The frontend expresses the same split with a single flag —
`client/src/pages/TeamDetailPage.js:398`:

```js
const canEdit = user?.role === 'admin';
```

which drives `readOnly` on every editable cell (`:227, :230, :248`) and swaps the subtitle between
*"Edit cells directly"* and *"Read-only"* (`:629`).

---

## 9. How the frontend mirrors this (and why it is cosmetic)

> **The server is the only enforcement point.** Everything in this section is UX — it stops people
> from wandering into pages that would 403 anyway. None of it is a security control.

### 9.1 `PrivateRoute`

`client/src/components/PrivateRoute.js:6-31`:

```js
const PrivateRoute = ({ children, allowedRoles }) => {
    const { user, loading, isAuthenticated } = useAuth();
    if (loading)          return <CircularProgress />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to="/" replace />;
    return children;
};
```

Route-by-route `allowedRoles`, from `client/src/App.js`:

| Path | `allowedRoles` | Line |
|---|---|---|
| `/team-lead/dashboard` | `['team_lead']` | `:69` |
| `/admin/dashboard` | `['admin']` | `:79` |
| `/student-database` | `['admin','team_lead','manager','skillhub']` | `:91` |
| `/hourly-tracker` | `['admin','team_lead','skillhub']` | `:101` |
| `/meetings` | `['admin','team_lead','skillhub']` | `:114` |
| `/commitments` | `['admin','team_lead','skillhub']` | `:127` |
| `/skillhub/dashboard` | `['skillhub']` | `:137` |
| `/exports` | `['admin','team_lead','manager','skillhub']` | `:149` |
| `/admin/reconciliation` | `['admin']` | `:161` |
| `/pdf-viewer` | `['admin','team_lead']` | `:174` |
| `/leadership-dashboard` | `['admin','team_lead']` | `:187` |
| `/team-dashboard/:teamLeadId` | `['admin','team_lead']` | `:201` |
| `/team-dashboard` | `['team_lead']` | `:209` |
| `/consultant-performance` | `['admin','team_lead']` | `:220` |
| `/tiers` | `['admin','team_lead']` | `:229` |
| `/payment-plans` | `['admin','team_lead']` | `:238` |
| `/institute` | `['admin','skillhub']` | `:249` |
| `/monthly-targets` | `['admin','team_lead']` | `:261` |

Post-login routing is `HomeRedirect` (`App.js:33-52`): admin → `/admin/dashboard`, team_lead →
`/team-lead/dashboard`, manager → `/student-database`, skillhub → `/skillhub/dashboard`. Any unmatched
path redirects to `/` (`:292`), which re-runs `HomeRedirect`.

Note `/institute` allows *any* `skillhub` role at the route layer — the Training-vs-Institute
distinction is handled by the sidebar not rendering the link
(`SkillhubSidebar.js:227-232`) and, authoritatively, by `assertInstitute` returning 403 from the API.

### 9.2 Why this is cosmetic — a concrete demonstration

`AuthContext` hydrates the user from `localStorage` on boot
(`client/src/context/AuthContext.js:22-30`), and `PrivateRoute` reads `user.role` from that object.

So: open devtools, edit `localStorage.user` to `{"role":"admin", ...}`, reload. `PrivateRoute` lets you
into `/admin/dashboard` and the admin sidebar renders. **And then every single API call 403s**,
because `authorize()` reads `req.user.role` from the database record loaded by `protect`
(`server/middleware/auth.js:27, 55`) and the JWT's own `role` claim is never consulted. You get an
empty admin dashboard, not admin access.

Corollary for reviewers: **a missing `allowedRoles` entry is a UX bug; a missing `authorize()` or a
missing `buildScopeFilter` is a security bug.**

### 9.3 The admin org switch is a client-side localStorage value

The `?organization=` query param that `buildScopeFilter` keys on for admins is injected by a global
axios interceptor — `client/src/utils/axiosAdminOrgInterceptor.js:21-51`:

- Applies to **GET requests only** (`:24`).
- Applies only when `localStorage.user.role === 'admin'` (`:30`).
- Never clobbers an `organization` the caller already set, in `params` or in the URL (`:34-43`).
- Reads the scope from `localStorage.adminOrgScope`, defaulting to `'luc'`
  (`client/src/utils/adminOrgScope.js:8-10`).
- Fails open on any exception (`:46-49`).

`useAdminOrgScope()` (`adminOrgScope.js:23-40`) is the React hook, and it syncs across browser tabs via
the `storage` event.

Two consequences:

- **Admin POST/PUT/DELETE bodies are not affected.** For writes, the org comes from
  `resolveOrganization(req)` reading `req.body.organization` with a `'luc'` fallback. If an admin
  creates something while "viewing Skillhub", the page must send `organization` in the body itself.
- Pages resolve their display org with `resolveViewOrg(user, adminScope)`
  (`client/src/utils/hourlyConfig.js:97-100`): admins use the scope, everyone else uses
  `user.organization`. `MeetingTrackerPage` and `HourlyTrackerPage` import that helper;
  `StudentDatabasePage.js:15-16` inlines the identical expression instead of importing it (so
  grepping for `resolveViewOrg` will not find it). All three then dispatch to a LUC or Skillhub
  variant on that value.

### 9.4 Role-conditional rendering

Four separate sidebars, chosen by role. `ExportCenterPage.js:59-100` shows the canonical dispatch:

| Role | Sidebar |
|---|---|
| `admin` | `client/src/components/AdminSidebar.js` |
| `team_lead` | `client/src/components/Sidebar.js` |
| `manager` | `client/src/components/ManagerSidebar.js` |
| `skillhub` | `client/src/components/skillhub/SkillhubSidebar.js` |

Each hard-codes its own nav list rather than filtering a shared one, so **adding a page means editing
up to four sidebars**. Notable entries:

- `ManagerSidebar.js:172, 193` — only two links: Student Database and Export Center.
- `SkillhubSidebar.js:227-232` — Meeting Tracker + Institute only for `skillhub_institute`.
- `AdminSidebar.js:367` — Institute link always shown to admins, regardless of the current org scope.
- `Sidebar.js:259-289` — the team-lead Leadership group (Leadership Dashboard, All Teams, Consultant
  Performance, Monthly Targets, Tiers, Payment Plans).

Export Center specifics:

- `client/src/components/exports/DatasetSelector.js:13-18` duplicates the server matrix as
  `ROLE_DATASETS`. **This is a second copy of `assertDatasetAccess` and must be kept in sync manually.**
- `client/src/components/exports/ExportOrgTabs.js:16` implements the manager exception in the UI —
  org tabs render for an admin always, and for a manager **only when `dataset === 'students'`**.

---

## 10. Creating, changing and disabling accounts

### 10.1 The accounts that exist

Seeded by `npm run seed` → `server/scripts/seedDatabase.js`.

> **Destructive.** `seedDatabase.js:35-37` deletes *every* `User`, `Consultant` **and `Commitment`**
> document before recreating anything. Students, meetings and hourly rows survive; commitments do not.
> Older descriptions of this script that say it "wipes users and consultants" understate it — the
> commitment wipe is unrecoverable without a restore. See `00-START-HERE.md` point 2 and
> `09-operations-backup-recovery.md`.

| Account | Role | Organisation | Source line |
|---|---|---|---|
| `admin@learnerseducation.com` | `admin` | `luc` | `:47-58` |
| 9 team leads — arfath, bahrain, manoj, jamshad, anousha, shakil, shasin, shaik, tony `@learnerseducation.com` | `team_lead` | `luc` | `:64-90` |
| `training@skillhub.com` | `skillhub` | `skillhub_training` | `:131-153` |
| `institute@skillhub.com` | `skillhub` | `skillhub_institute` | `:138-163` |
| `mushtaq@learnerseducation.com` | `manager` | `luc` (default) | `server/scripts/createManager.js:5-31` |

Consultants (LUC) and counselors (Skillhub) are `Consultant` documents with **no login**
(`seedDatabase.js:113, 170`).

Generated credentials are written to `LOGIN_CREDENTIALS.md` at the repo root. **That file contains
real passwords — treat it as a secret, keep it out of any shared channel, and rotate everything as
part of handover.** See `docs/handover/11-credentials-and-access-handover.md`.

### 10.2 The registration endpoint cannot create Skillhub users

`POST /api/auth/register` is admin-only (`routes/auth.js:14`), but look at what it actually persists —
`server/controllers/authController.js:35-43`:

```js
const user = await User.create({
    email, password, name, role,
    teamLead: role === 'consultant' ? teamLead : null,
    teamName: role === 'team_lead' ? teamName : null,
    phone,
});
```

**`organization` is never read from the body.** Every user created through the API therefore lands on
the schema default, `'luc'` (`User.js:38`). And `PUT /api/users/:id` does not include `organization` in
its updatable-fields list either (`userController.js:114-125`).

**Consequence: there is no supported way to create or move a user into a Skillhub organisation through
the application.** You must either run a seed/one-off script or edit the document directly in Atlas.
This is a genuine functional gap, not a policy.

Two smaller oddities in the same handler:

- `sendTokenResponse(user, 201, res)` at `:50` returns a **JWT for the newly created user** to the
  admin who called register. Harmless in practice (the admin is more privileged) but surprising.
- The `role === 'consultant'` validation at `:20-25` can never fire — no such role exists.

### 10.3 Disabling an account

Set `isActive: false` — either `DELETE /api/users/:id` (admin, soft; `userController.js:144-167`) or
directly in Atlas. Effective on the very next request thanks to the `isActive` check in `protect`
(`auth.js:36-41`). `DELETE /api/users/:id/permanent` hard-deletes but refuses `admin` accounts
(`:184-189`).

Historical data survives deletion because `Commitment` and `Student` carry denormalised
`consultantName` / `teamLeadName` / `teamName` strings alongside the FKs.

---

## 11. Known gaps and traps

Ordered by how likely they are to bite you. Items 1–3 are real authorisation gaps in production code;
the rest are traps and inconsistencies.

### 11.1 Any authenticated user can read and partially write any `User` record

`server/routes/users.js:26-30`:

```js
router
    .route('/:id')
    .get(getUser)          // ← no authorize()
    .put(updateUser)       // ← no authorize()
    .delete(authorize('admin'), deleteUser);
```

The controller compensates only for the non-existent `consultant` role and for `team_lead`
(`userController.js:61-73`, `:99-111`). **`manager` and `skillhub` match no branch and fall straight
through.**

Impact:
- `GET /api/users/<any id>` — a Skillhub branch login can read any LUC user document: name, email,
  role, organisation, team, phone, `lastLogin`. `password` is `select: false` so it is not exposed.
- `PUT /api/users/<any id>` — the same login can change another user's `name` and `phone`
  (`:114-117`). It cannot change `role`, `teamLead`, `teamName` or `isActive` — those are gated to
  admin at `:120-125`.

**Suggested fix:** add `authorize('admin','team_lead','manager','skillhub')` on the route *and* extend
the controller's checks to cover `manager` and `skillhub` (org match + self-only for writes).
Not fixed here — this document changes no code.

### 11.2 `manager` can read commitments over REST but not through the Export Center

`GET /api/commitments`, `GET /api/commitments/week/:weekNumber/:year` and `GET /api/commitments/:id`
have no `authorize()` (`routes/commitments.js:27, 44, 60`), so a manager reaches all three. On the two
list reads `buildScopeFilter` hands back `{organization:'luc'}` — every LUC commitment, every team. On
`GET /:id` the gate is `canAccessDoc` instead (`commitmentController.js:121`), which for a `manager`
checks the organisation and nothing else — same outcome, different mechanism. Meanwhile
`assertDatasetAccess` explicitly 403s the same role on the commitments dataset
(`exportController.js:30-34`).

One of the two is wrong. Given the role's documented intent ("Student Database only"), the REST reads
are the ones that look unintended.

### 11.3 Hourly Tracker writes are org-scoped but not team-scoped

`server/routes/hourly.js` has no `authorize()` at all, and `upsertSlot` checks only the organisation —
`server/controllers/hourlyController.js:357-359`:

```js
if (req.user.role !== 'admin' && consultantDoc.organization !== req.user.organization) {
    return res.status(403).json({ success: false, message: 'Not authorized for this consultant' });
}
```

So **any LUC team lead can log or clear hourly activity against another team's consultant**, and a
`manager` can too. The only other guard is "today only" for non-admins (`:343-348`).

If team-level ownership matters for this feature, the check needs to compare
`consultantDoc.teamLead` against `req.user._id` for `team_lead` and `skillhub`.

### 11.4 A document with no `organization` bypasses the tenant check

Covered in detail in [§5.2](#52-canaccessdocuser-doc--the-check-for-single-document-readwrite). Run
`server/scripts/migrateOrganization.js` after any legacy import.

### 11.5 `getConsultantsByTeamLead` is dead

`GET /api/users/team/:teamLeadId` queries `{ teamLead: ..., role: 'consultant' }`
(`userController.js:216-219`). No `User` can have that role, so it always returns an empty array.
`CLAUDE.md` also lists a client/server path mismatch for this endpoint. Don't build on it — real
consultants live in the `Consultant` collection behind `/api/consultants`.

### 11.6 Stale comments that contradict their own code

| Location | Comment claims | Code actually does |
|---|---|---|
| `server/controllers/execOverviewController.js:40-41` | *"team_lead is locked to their own user id (anything else → 403)"* | `:47-50` explicitly allows any team |
| `client/src/App.js:182-183` | *"Coming Soon lock to team leads"* on Leadership Dashboard | Page renders fully; `canEdit` gates edits |
| `client/src/App.js:215-216` | *"team_lead gets Coming Soon"* on Consultant Performance | Same — no lock |
| `client/src/App.js:196-197` | *"team_lead is locked to own team via the controller-level role guard"* | No such guard exists |

`client/src/components/ComingSoonLock.js` is now **dead code** — grep finds no importers.

### 11.7 Platform-level notes that interact with permissions

- **CORS is wide open** — `app.use(cors())` with no options (`server/server.js:28`) allows any origin.
  Combined with tokens stored in `localStorage`, any page that can execute script in the user's
  browser can read the token. Helmet is mounted (`:20-25`) but **CSP is explicitly disabled**
  (`contentSecurityPolicy: false`, `:23`) pending a CRA-compatible policy.
- **No global rate limiting.** Only two features have limiters: Export Center pivot/template
  (`server/middleware/exportRateLimit.js`) and Institute schedule import (`institute.js:29-36`).
  `POST /api/auth/login` is **not** rate-limited — credential stuffing is unmitigated.
- **No authorisation audit log.** Nothing records a 403, an admin cross-org read, or a delete.
- **A hard-coded password lives in the repository** at `server/scripts/createManager.js:6` (the manager
  account). It is in git history. **Rotate that account's password as part of handover** and change the
  script to read from an environment variable or `process.argv`. The value is deliberately not
  reproduced in this document.
- **`express-validator` is a dependency but is never imported** — all validation is hand-written in
  controllers.

---

## 12. Where the tests are

`server/package.json:9`:

```json
"test": "jest --testPathPattern=\"tests/(exports|meetings|institute|commitments)\""
```

**`npm test` deliberately skips `tests/execOverview` and `tests/hourly`.** A green run does not mean
the permission surface is verified.

Permission-relevant specs that do run:

| Test | Asserts |
|---|---|
| `server/tests/exports/students.test.js:201` | `team_lead` body-spoofing `organization=skillhub_training` is coerced to LUC |
| `server/tests/exports/students.test.js:209` | admin `orgScope=all` applies no organisation filter |
| `server/tests/exports/students.test.js:225` | the manager Export Center exception is honoured |
| `server/tests/exports/students.test.js:231` | `skillhub` is locked to its own organisation |
| `server/tests/institute/attendance.test.js:58-60` | a Training login gets 403 on Institute attendance |
| `server/tests/institute/tests.test.js:65-67` | a Training login gets 403 on Institute tests |
| `server/tests/institute/scheduleImport.test.js:158-160` | a Training login gets 403 on schedule import |
| `server/tests/exports/rateLimit.test.js` | the pivot limiter fires |

Client-side: `client/src/components/exports/__tests__/` covers the Export Center wrapper components
(run with `npm test` from `client/`). There are **no tests for `PrivateRoute`, `buildScopeFilter`,
`canAccessDoc` or `resolveOrganization` directly** — they are exercised only indirectly through the
export suites. That is the biggest coverage gap in the permission layer.

---

## 13. Corrections to the pre-existing docs set

`docs/user-guides/05-role-permissions-matrix.md` (v0.1, drafted 2026-04-26) and
`docs/security/02-access-control-policy.md` are ~207 commits stale. Their *structure* is still useful;
several specific claims are now wrong. Verified corrections:

| Stale claim | Reality | Evidence |
|---|---|---|
| `/meetings` — skillhub `—` | `skillhub` **is** allowed on the Meeting Tracker (all but delete and AI analysis) | `server/routes/meetings.js:23-35` |
| Chat → tracker — manager `—` | `manager` **can** use the tracker chatbot; there is no role gate at all | `server/routes/chat.js:17` |
| Chat → Docs RAG — manager `—` | The gate is `orgGate('luc')`, not a role list; `manager.organization === 'luc'`, so managers pass | `server/routes/docsChat.js:320` |
| "Staff `User` rows — admin ✓, all others —" | `team_lead` and `skillhub` can list peers; **any** authenticated role can read/partially write any user by id | `server/routes/users.js:20, 28-29`; `userController.js:49-139` |
| "Log hourly activity — team_lead: own team" | Enforcement is organisation-level only; cross-team writes are possible, and `manager` can write too | `hourlyController.js:357-359`; `routes/hourly.js:24` |
| Implies commitments are closed to `manager` | Three commitment read routes have no role gate | `server/routes/commitments.js:27, 44, 60` |
| "role enforcement is real and tested" | Partly. There are no direct tests for the scoping helpers, and `npm test` skips two suites | `server/package.json:9` |

Everything else in those documents that this file does not contradict was spot-checked and still
holds. Where the two disagree, **this document and the code win**.

---

## 14. Checklist: adding a new gated route

1. **Pick the roles.** Add `authorize('...')` to the route in `server/routes/<x>.js`. Decide
   explicitly about `manager` — forgetting it is how it accidentally gained commitments and hourly
   access.
2. **Pick the organisations.** If the feature belongs to exactly one tenant, mount
   `orgGate('<org>')` on the router (after `protect`, before `authorize`). If it is Institute-only,
   also call `assertInstitute(req, res)` as the first line of every handler.
3. **Scope the reads.** Start list/aggregate queries from `buildScopeFilter(req)`. If the collection
   has no `teamLead` FK, strip it the way `hourlyScopeFilter` does — do not write a third variant.
4. **Scope the single-doc access.** Call `canAccessDoc(req.user, doc)` after every `findById`, before
   returning or mutating.
5. **Stamp new documents server-side.** Use `resolveOrganization(req)` (or derive from an
   authoritative related document, which is stronger). Never trust `req.body.organization` from a
   non-admin, and never trust `req.body.teamLead` from a `team_lead`/`skillhub`.
6. **Order routes correctly.** Specific paths before `/:id`, or Express matches `/:id` first. Every
   route file in this repo has a comment about it for a reason.
7. **Mount it.** `server/server.js`, before the SPA catch-all at `:111`.
8. **Mirror it on the client.** `PrivateRoute allowedRoles` in `client/src/App.js`, plus the relevant
   sidebar(s) — remember there are four. For an Export Center dataset, also update
   `DatasetSelector.ROLE_DATASETS` **and** `assertDatasetAccess`.
9. **Write the negative test.** At minimum: a wrong-role request returns 403, and a wrong-org request
   returns 403 or an empty result. Put it under `server/tests/(exports|meetings|institute|commitments)`
   or `npm test` will not run it.

---

## 15. Related documents

| Document | Why you would go there from here |
|---|---|
| [00 — Start Here](00-START-HERE.md) | Orientation, reading order, the five production traps |
| [01 — System Architecture](01-system-architecture.md) | Where the middleware sits in the request lifecycle |
| [02 — Application Workflows](02-application-workflows.md) | What each role actually *does* day to day |
| [03 — Database Schema](03-database-schema.md) | The `organization` and `teamLead` fields on all 27 models; the conditional-`required` trap |
| [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) | Render service, where `JWT_SECRET` is configured |
| [05 — Environment Setup](05-environment-setup.md) | Local `.env`, seeding, why seeding is destructive |
| [06 — API Reference](06-api-reference.md) | Full request/response shapes for the endpoints listed here |
| [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) | `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, Socket.IO |
| [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) | Nightly S3 snapshot, restore procedure |
| [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) | Where the gaps in [§11](#11-known-gaps-and-traps) should be tracked |
| [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) | Rotation runbook, including the hard-coded manager password |

Older, partly-stale but still useful:
[docs/user-guides/05-role-permissions-matrix.md](../user-guides/05-role-permissions-matrix.md) ·
[docs/security/02-access-control-policy.md](../security/02-access-control-policy.md) — read
[§13](#13-corrections-to-the-pre-existing-docs-set) first.
