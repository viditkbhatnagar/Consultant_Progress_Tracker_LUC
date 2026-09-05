# 10 — Known Issues, Limitations & Roadmap

This is the honest-defects document for the Team Progress Tracker. Everything below was re-verified
against the code on **2026-09-05** at commit `7b0cafa` (394 commits, first commit 2025-11-28) — not
copied from older notes. Where a previously-documented issue has since been fixed, it says so and
shows the evidence; where something is broken today, it names the file and line and (when I could)
reproduces the failure. Where I could not verify a claim from inside the repository — anything that
lives in the Render dashboard, the MongoDB Atlas console, or the AWS console — it is marked
**UNVERIFIED**, because guessing would be worse than admitting the gap. Read this before you touch
anything: several items here are traps that look like working code, and at least three are things
that will destroy production data if you run the obvious command.

---

## 0. How to read this document

| Marker | Meaning |
|---|---|
| **VERIFIED** | I ran it, or read the exact lines cited, on 2026-09-05 at `7b0cafa`. |
| **UNVERIFIED — needs confirmation** | Cannot be checked from the repo (external console, live DB, or third-party account). |
| **FIXED (docs stale)** | `CLAUDE.md` or `docs/` still lists it as broken; the code says otherwise. |
| P0 / P1 / P2 / P3 | Severity. P0 = data loss, breach, or money leaking now. P3 = tidy-up. |

Two documents in this repo will lie to you, in different ways:

- **`CLAUDE.md`** (repo root) is broadly accurate on architecture but its **"Known Issues"** section
  is partly stale — three of its five bullets are already fixed. Section 1 below audits it line by line.
- **`docs/engineering/`, `docs/security/`, `docs/legal/`, `docs/user-guides/`** (~13,140 lines) were
  last touched by commit `560b12e` on **2026-04-26**, which is **207 commits behind `main`**
  (VERIFIED: `git rev-list --count 560b12e..HEAD` → `207`). They predate roughly a third of the
  product. See section 9.

---

## 1. Audit of the `CLAUDE.md` "Known Issues" list

Each claim, re-checked against the code today.

| CLAUDE.md claim | Status | Evidence |
|---|---|---|
| Close admission route mismatch (server `PUT /:id/close-admission`, client `PATCH /:id/close`) | **STILL BROKEN — P1, user-facing** | `server/routes/commitments.js:54` vs `client/src/services/commitmentService.js:59`. See §2.1. |
| Update meetings route mismatch (server `PUT`, client `PATCH`) | **STILL BROKEN, but dead code** | `server/routes/commitments.js:55` vs `client/src/services/commitmentService.js:68`. Nothing in the UI calls `commitmentService.updateMeetings` — only its own definition and the export list at `:155`. Zero live impact. Note: the *Meeting Tracker's* separate `PUT /api/meetings/:id` mismatch **is fixed** — `client/src/services/meetingService.js:47` now uses `axios.put`. |
| Team consultants route mismatch (`/users/teamlead/:id/consultants`) | **FIXED (docs stale)** | `client/src/services/userService.js:54` now calls `${API_URL}/team/${teamLeadId}`, and lines 50–53 carry a comment explaining the old path never matched. |
| `STATUS_LIST` includes `not_achieved` but the model enum uses `missed` | **FIXED (docs stale)** | `client/src/utils/constants.js:170` is `['pending', 'in_progress', 'achieved', 'missed']`. A repo-wide grep for `not_achieved` across `client/src` and `server` returns **zero hits**. Matches `server/models/Commitment.js:232`. |
| Duplicate `leadStage` field in the Commitment model | **FIXED (docs stale)** | Only one `leadStage` definition remains, at `server/models/Commitment.js:170`; the other `leadStage` hit is the index at `:270`. `server/tests/exports/commitments.test.js` asserts the enum has exactly 12 values so a regression fails loudly. |
| `client/src/pages/ConsultantDashboard.js` is dead code | **CONFIRMED DEAD** | 430 lines. Not imported by any file, not in `App.js`'s route table. Last touched 2025-11-29. See §4.1. |
| `express-validator` installed but never imported | **CONFIRMED** | Declared in `server/package.json` dependencies; a grep for `express-validator` across `server/**.js` (excluding `node_modules`) returns **zero hits**. All validation is hand-rolled inside controllers. |
| Multiple stacking global axios interceptors | **CONFIRMED** | Three of them. See §4.4. |

**Net:** of eight documented issues, **three are fixed**, **one is real and user-facing**, one is real
but dead, and three are cosmetic/cruft. Do not trust the stale list — trust this table.

---

## 2. Confirmed bugs in production today

### 2.1 The "Close Admission" button in the Commitment Tracker cannot work — P1

The client sends a **`PATCH`** to `/api/commitments/:id/**close**`. The server only registers a
**`PUT`** on `/api/commitments/:id/**close-admission**`. Method *and* path differ, so the request
matches no route and falls through to Express's default 404.

```
client/src/services/commitmentService.js:59
    const response = await axios.patch(`${API_URL}/${id}/close`, { closedDate, closedAmount });

server/routes/commitments.js:54
    router.put('/:id/close-admission', authorize('team_lead','admin','skillhub'), closeAdmission);
```

This is **not** dead code — unlike `updateMeetings`, it is wired to a live control:
`client/src/pages/CommitmentsPage.js:438` defines `handleCloseAdmission`, which is passed to
`CommitmentDetailDrawer` as `onCloseAdmission` at `:662`. A user opens a commitment's detail drawer,
clicks Close Admission, gets prompted for an amount, and then sees the generic
`'Failed to close admission'` snackbar because the 404 body has no `message` field.

**Why nobody noticed:** there is a working alternative path. `updateCommitment`
(`server/controllers/commitmentController.js:275–286`) auto-closes any row whose post-update state
is `leadStage === 'Admission'` **and** `status === 'achieved'`, flipping `admissionClosed = true`
itself. Users close admissions by editing the row instead, and the dedicated button quietly never
worked. The consequence is not lost data — it is that **`closedAmount` is never captured on that
path** (the auto-close comment at `:271–274` says so explicitly: *"closedAmount stays empty — has to
be filled via edit before Revenue picks it up"*).

**Fix:** change the client to `axios.put(\`${API_URL}/${id}/close-admission\`, …)`. One line. Do the
same for `updateMeetings` at `:68` (→ `PUT …/meetings`) while you are there, or delete it.

**Verification note:** these are the *only* two client/server `PATCH` mismatches. Every other
`axios.patch` in the client has a matching server route — `/students/:id/activate`,
`/students/:id/status` (`server/routes/students.js:33,35`), `/notifications/read-all`,
`/notifications/:id/read` (`server/routes/notifications.js:18,20`).

---

### 2.2 A server test has been failing for over three months — P2

**VERIFIED by running it.**

```
$ cd server && npx jest tests/execOverview/aggregate.test.js

  ● getExecutiveOverview › rolls up KPI totals across all teams
    expect(received).toBe(expected)
    Expected: 350000
    Received: 510000
      at tests/execOverview/aggregate.test.js:166
```

14 of 15 specs in that file pass; this one has failed since **2026-05-30**.

**Why `npm test` does not catch it.** `server/package.json` pins the test script to a path pattern:

```json
"test": "jest --testPathPattern=\"tests/(exports|meetings|institute|commitments)\""
```

`tests/execOverview` is not in that list, so `npm test` reports **140/140 green** while this suite
sits broken. See §5 for the full coverage picture.

**Root cause — and it is not the test being merely stale.** Commit `063c624`
("fix(leadership): Bhanu is a target-only admin line (achieved = 0)", 2026-05-30) added a
**hardcoded** revenue target to the Executive Overview roll-up:

```js
// server/services/execOverview/aggregate.js:416–419
const ADMIN_MONTHLY_TARGET = 80000;
totalMtdTarget += ADMIN_MONTHLY_TARGET;
totalYtdTarget += ADMIN_MONTHLY_TARGET * currentMonth;
```

The fixture has entries in months 1 and 2, so `currentMonth = 2` and the aggregator adds
`80,000 × 2 = 160,000` on top of the teams' real `350,000` → `510,000`. The arithmetic is
*intentional*; the test simply predates it.

**But do not "fix" this by changing `350000` to `510000` and walking away.** Two real problems hide
underneath:

1. A named individual's monthly revenue target is a **magic number compiled into the aggregator**.
   Nobody outside the code can see it, change it, or audit it. Every Leadership Dashboard KPI the
   business reads is inflated by AED 80,000/month by a constant with no UI, no config, and no
   database row. If that person's target changes, or they leave, the dashboard silently lies.
2. `ADMIN_MONTHLY_TARGET` is added to **targets only** — achieved revenue is untouched — so the
   organisation-wide attainment percentage is structurally depressed by design. That is the stated
   intent, but it is invisible to the reader of the dashboard.

**Recommended fix:** move the value into a `TeamMonthlyEntry`-style database row (or at minimum a
named export in `server/config/`), make it visible in the admin UI, then update the spec to assert
against that source. Commit `4edf561` (2026-07-24) *edited this very test file* and left the failure
in place — a clear signal that the excluded-path pattern is hiding regressions, not just this one.

---

### 2.3 Conditional `required` validators silently never fire on update — P1 (data integrity)

This is the highest-value trap in the codebase, and it affects **21 fields** on `Student`.

`server/models/Student.js:50–55` defines two predicate functions used as `required`:

```js
const lucOnly      = function () { return isLuc(this.organization); };
const skillhubOnly = function () { return isSkillhub(this.organization); };
```

Mongoose runs `findByIdAndUpdate` validators in **query context**, where `this` is the Query, not the
document — so `this.organization` is `undefined`, `isLuc(undefined)` is false, and **the requirement
silently passes**. Adding `runValidators: true` does *not* help; `server/controllers/studentController.js:586–593`
already passes it and it changes nothing here.

Affected fields in `server/models/Student.js` (all `required: lucOnly` or `required: skillhubOnly`):
lines `90, 112, 128, 145, 151, 154, 158, 168, 173, 179, 219, 232, 233, 256, 257, 258, 263, 264, 265, 266, 267`
— including `program`, `enquiryDate`, `closingDate`, `enrollmentNumber`, `curriculum`,
`academicYear`, `yearOrGrade`, `nationality`, `companyName`.

**Practical effect:** a `PUT /api/students/:id` that sends `program: ""` on an LUC student succeeds
and blanks the field. Nothing in the API rejects it. Downstream, every Export Center pivot grouped by
`program`, every dashboard "by program" chart, and the Docs-RAG program resolver
(`server/routes/docsChat.js:41`) then see an empty bucket.

**The pattern for the fix already exists in the codebase.** `Meeting` hit the same trap and it was
patched by re-checking in JavaScript against the stored document's org:

```js
// server/controllers/meetingController.js:298–313
// The schema's `required: lucOnly` on `program` cannot run here …
if (… 'program' in req.body && !String(req.body.program || '').trim()) {
    return res.status(400).json({ success: false, message: 'Program is required' });
}
```

`studentController.updateStudent` has **no equivalent guard**. Port the pattern. The same trap
applies anywhere else you add a function-valued `required` — treat it as a codebase-wide rule, not a
one-off.

---

### 2.4 `Student.getNextSno` is a read-then-write race — P2

```js
// server/models/Student.js:341–347
StudentSchema.statics.getNextSno = async function (teamLeadId, organization) {
    const filter = organization && organization !== ORG_LUC ? { organization } : { teamLead: teamLeadId };
    const last = await this.findOne(filter).sort({ sno: -1 }).select('sno');
    return last ? last.sno + 1 : 1;
};
```

Two concurrent creates read the same maximum and both write `max + 1`. There is **no unique index**
on `(teamLead, sno)` — `server/models/Student.js:364–375` lists ten indexes and none of them cover
`sno` — so nothing at the database level prevents the collision.

That this happens in practice is implied by the repo's own audit tooling:
`server/scripts/auditStudents.js:172–186` contains a check titled *"Duplicate sno within same team
(LUC — sno is scoped per-team)"*. Run that script to see the current count.

**The fix is already in the repo, unused.** `server/models/Counter.js` is an atomic
`findOneAndUpdate($inc)` sequence generator, kept after commit `c5effc2` made Skillhub enrolment
numbers manual. It has **zero references** anywhere in `server/`. Wire `getNextSno` to it (and add
the unique compound index) rather than writing a third mechanism. Heed the warning in `CLAUDE.md`:
do not reuse the old collection key `enroll:{organization}:{IGCSE|CBSE}:{year}` without checking what
is already stored under it.

---

### 2.5 Client `.env` is read by nothing — P3, but it will waste your afternoon

`client/.env:1` sets `REACT_APP_API_URL=http://localhost:5001/api`. A grep for `REACT_APP` across
`client/src` returns **zero hits**. The real value is hardcoded:

```js
// client/src/utils/constants.js:157–159
export const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? '/api'
    : 'http://localhost:5001/api';
```

Changing `client/.env` does nothing. Pointing the dev client at a different backend requires editing
`constants.js`. (`CLAUDE.md` still claims `userService.js` reads `REACT_APP_API_URL` and sets
`axios.defaults.baseURL` — that is stale; `client/src/services/userService.js:6–9` now carries a
comment explaining why setting `baseURL` would double-prefix every request to `/api/api/...`.)

---

## 3. Security gaps

### 3.1 P0 — The chatbot runs every data tool **unscoped by caller**

This is the most serious finding in this document and it is not mentioned anywhere in the existing
`docs/security/` set.

The REST API scopes rigorously: `buildScopeFilter` (`server/middleware/auth.js:69`) pins a
`team_lead` to `{ organization, teamLead: user._id }`, and `canAccessDoc` re-checks per document.
**The chat path bypasses all of it.**

```js
// server/routes/chat.js:15–17
// All chat endpoints require auth but NOT a role check — every
// authenticated user can query anything via chat per product decision.
router.use(protect);
```

```js
// server/services/chatTools.js:1261
async function runTool(name, args) {          // ← no `user` parameter at all
    const fn = DISPATCH[name];
    const parsed = typeof args === 'string' ? JSON.parse(args || '{}') : args || {};
    return await fn(parsed);
}
```

```js
// server/services/chatService.js:577
const result = await runTool(tc.name, tc.args);   // ← caller identity not passed
```

`req.user` reaches `chatService` **only for AIUsage billing** — the JSDoc at
`server/services/chatService.js:483` says so verbatim: *"`opts.user` - req.user (for AIUsage logging)"*.

The tool arguments are chosen by **the LLM**, from the user's prompt. `leaderboard`
(`chatTools.js:337`) and `get_revenue` build their Mongo `$match` from LLM-supplied `teamName` /
`consultantName` / `organization` (`chatTools.js:350–354`) with no floor from the caller's own scope.
So a `team_lead` who types *"show me Team Anousha's revenue this quarter"* gets it — full LUC revenue
figures for a team they cannot see anywhere else in the product. The same applies to Skillhub logins
reaching LUC data through the tracker chat path.

The `// per product decision` comment means somebody chose this. **Confirm with leadership whether
that decision covered cross-team revenue disclosure, or only "any topic".** If it is the latter, the
fix is to thread `req.user` into `runTool` and merge `buildScopeFilter`-equivalent constraints into
every tool's `$match` as a floor the LLM cannot widen.

### 3.2 P1 — No Content-Security-Policy

```js
// server/server.js:20–25
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: false, // CRA inline-styles + dynamic chunks; defer CSP tuning to a later pass.
}));
```

Helmet is mounted, so you get HSTS, `X-Content-Type-Options`, frame-guard and friends — but CSP is
explicitly off. The reason given is real: CRA emits inline styles and dynamically-named chunks, and a
naive policy breaks the SPA. The work is a nonce-based policy (or `strict-dynamic`) applied to
`index.html` at serve time. There is an unused `CSP_ENABLED` name floating in the dependency tree but
**nothing in this repo's own code reads it** — do not assume a toggle exists.

### 3.3 P1 — Rate limiting covers three endpoints out of ~150

Total rate-limiter coverage in the entire server:

| Limiter | Applied to | Limit | Source |
|---|---|---|---|
| `exportPivotLimiter` | `POST /api/exports/pivot`, `POST /api/exports/template/:templateId` | 5/min/user | `server/middleware/exportRateLimit.js`, mounted `server/routes/exports.js:21,25` |
| `importLimiter` | `POST /api/institute/timetable/import` | 10/min/user | `server/routes/institute.js:29,66` |

Everything else is unlimited. The three that matter:

1. **`POST /api/auth/login` is unauthenticated and unthrottled** (`server/routes/auth.js:15`).
   Unlimited password guessing against a 12-account tenant. No lockout, no backoff, no CAPTCHA.
2. **Every LLM-billed endpoint is unthrottled.** `POST /api/ai/analysis`, `/api/ai/student-analysis`,
   `/api/ai/team-analysis`, `/api/ai/consultant-analysis` (`server/routes/ai.js:16–25`);
   `POST /api/chat/stream` and `/api/chat/transcribe` (`server/routes/chat.js:27–28`);
   `POST /api/docs-chat` (`server/routes/docsChat.js:320`); and `POST /api/tiers/generate-image`
   (`server/routes/tiers.js:26`), which calls OpenAI **image** generation. Spend is *recorded* in
   `AIUsage` (`server/models/AIUsage.js`) and surfaced at `GET /api/ai/usage` and `/admin/api-costs`,
   but **never enforced** — a grep for `budget|maxSpend|dailyLimit|monthlyLimit` across
   `server/services/aiService.js` and `server/controllers/aiController.js` returns nothing. Any
   authenticated team lead can run up an unbounded OpenAI/Groq bill, accidentally or otherwise.
3. **The limiter store is in-memory.** `express-rate-limit` with no store config means counters reset
   on every restart/deploy and are per-process. Fine on Render's single instance; silently broken the
   day you scale to two.

### 3.4 P2 — No refresh tokens, no revocation, no rotation

- `JWT_REFRESH_EXPIRE` is documented as an environment variable in `CLAUDE.md` and
  `server/.env.example`, but a grep for `JWT_REFRESH|refreshToken|refresh_token` across the server
  returns **zero hits**. It is not implemented. Do not assume it is.
- One long-lived access token, signed at `server/models/User.js:85–88` with `expiresIn:
  process.env.JWT_EXPIRE`, stored in `localStorage` (`client/src/services/authService.js:9–14`).
- **`GET /api/auth/logout` is a no-op.** `server/controllers/authController.js:112–118` just returns
  `{ success: true }`. Logout only clears client-side storage. A leaked token stays valid until it
  expires; there is no denylist.
- The only revocation lever is `isActive: false` on the user, which `protect` re-checks per request
  (`server/middleware/auth.js:36–41`). That works — but it is account-level, not token-level.
- There is **no response interceptor** anywhere in the client (grep for `interceptors.response`:
  zero hits), so an expired token produces silent 401s across the UI rather than a redirect to login.

### 3.5 P2 — CORS is wide open

`server/server.js:28` is a bare `app.use(cors())` — reflects any origin, no allowlist. Socket.IO
mirrors it: `cors: { origin: true, credentials: true }` (`server/services/realtime.js:26–31`).
Because the JWT lives in `localStorage` rather than a cookie, this is not directly CSRF-exploitable,
but it means any web page can call the API with a token it has obtained. In production the SPA is
same-origin, so an allowlist costs nothing.

### 3.6 P2 — The error handler returns raw internal messages to the client

```js
// server/middleware/errorHandler.js:26–29
res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
});
```

Only three error shapes are normalised (CastError, duplicate key, ValidationError). Everything else
— including driver, network, and third-party SDK errors — has its raw `.message` echoed to the
caller. Mongo connection errors in particular can embed host details. Also `console.log(err)` at
`:6` dumps full stacks to Render's log stream, which is retained by the platform.

**Fix:** in `NODE_ENV === 'production'`, return a generic message for anything with `statusCode >= 500`
and log the detail server-side only.

### 3.7 P0 — Real student PII and plaintext passwords are committed to the git repository

Two tracked files, both verified with `git ls-files`:

| File | Contents | Risk |
|---|---|---|
| `server/dumps/luc_zero_admission_fee_20260423125500.json` | **626 real LUC student records**, 644 KB. Fields include `studentName`, `email`, `phone`, `nationality`, `residence`, `area`, `companyName`, `designation`, `gender`, `courseFee`. | Full personal data of 626 individuals in a git repository, replicated to every clone and every worktree. |
| `LOGIN_CREDENTIALS.md` | **12 plaintext application passwords** (admin, 9 LUC team leads, 2 Skillhub branch logins), regenerated by the seed script at `server/scripts/seedDatabase.js:224`. | If any are still in use, every account is compromised to anyone with repo access. |

Neither is in `.gitignore` (`git check-ignore` reports `server/dumps` is *not* ignored;
`LOGIN_CREDENTIALS.md` has no entry). `.gitignore` does correctly cover `server/.env` and
`client/.env` (lines 14–20), and the only tracked env file is the safe `server/.env.example` — so
secrets *hygiene* is otherwise fine. These two files are the exception, and they are the bigger
problem.

**This matters more than usual here.** `docs/legal/07-childrens-privacy-notice.md` and
`docs/legal/08-parental-consent-form.md` exist because the Skillhub Institute enrols minors. A
repository containing bulk student PII is inconsistent with that posture.

**Remediation (in order):**
1. **Rotate every password in `LOGIN_CREDENTIALS.md` immediately** — before the departing developer's
   access is revoked, not after.
2. Delete both files, add `server/dumps/` and `LOGIN_CREDENTIALS.md` to `.gitignore`, and change
   `seedDatabase.js` to write credentials somewhere ignored.
3. **Deleting them does not remove them from history.** Decide whether to purge history
   (`git filter-repo`, force-push, every clone re-cloned) or accept the residual risk. Because the
   repo is private with a small collaborator list, "accept + rotate + never do it again" may be the
   proportionate call — but make it a *decision*, recorded, not an oversight.
4. Audit who has had read access to the GitHub repo since 2026-04-23 (when the dump was committed).

### 3.8 P2 — Dependency vulnerabilities

**VERIFIED** by running `npm audit` on 2026-09-05:

| Package set | Result |
|---|---|
| `server/` production deps | **12 vulnerabilities (10 high, 1 moderate, 1 low)**. Most are fixable with `npm audit fix`: `mongoose` (NoSQL injection via `$nor` in `sanitizeFilter`; prototype pollution via `__proto__`-prefixed dotted update paths), `jws` (improper HMAC verification — this is the JWT signing chain), `multer` (two DoS), `path-to-regexp` (ReDoS), `lodash`, `qs`, `body-parser`, `ws`/`socket.io-parser`. |
| `xlsx` (both server and client) | **High, no fix available.** Prototype pollution + ReDoS in SheetJS. This is a *runtime* dependency: it parses admin-uploaded workbooks in `server/services/institute/scheduleParser.js` and `scripts/importStudents.js`. Only admins and Skillhub logins can upload, which limits blast radius, but it is unpatched. Migrating to `exceljs` is the real fix. |
| `client/` (all) | **63 vulnerabilities (3 critical, 34 high)**, overwhelmingly inside `react-scripts@5.0.1`'s webpack toolchain (`shell-quote`, `websocket-driver`, `yaml`, `serialize-javascript`). These are **build-time**, not shipped to browsers, so real-world risk is low — but CRA has been unmaintained since 2022 and this number only grows. |

`jws` and `mongoose` are the two to fix this week: one guards your auth signatures, the other your
query layer.

### 3.9 P3 — No audit log

There is no record of who changed what. `Commitment` tracks `createdBy`/`lastUpdatedBy` and
`Attendance` tracks `markedBy`, but there is no append-only trail, no deletion log, and no
authentication log (successful or failed). `docs/security/05-logging-and-audit-policy.md` describes
a posture the code does not implement — read it as aspiration, not description.

---

## 4. Dead code, cruft, and things that look load-bearing but are not

### 4.1 `client/src/pages/ConsultantDashboard.js` — 430 lines, fully dead
Not imported anywhere; absent from `App.js`'s route table (`client/src/App.js:62–292`). Last
modified 2025-11-29. It is also the **only consumer** of `STATUS_LIST` and `LEAD_STAGES_LIST` from
`constants.js` (`:41`, `:319`), and one of only two callers of the broken `closeAdmission` service
method (`:130`). Deleting it removes the file, retires two exported constants, and halves the
close-admission blast radius. `client/src/services/exportService.js:5` already annotates it as dead.

### 4.2 Unused models
| Model | Status |
|---|---|
| `server/models/WeeklySummary.js` | **Zero references** anywhere in `server/`. Never read, never written. |
| `server/models/Counter.js` | **Zero references.** Atomic sequence generator, orphaned when Skillhub enrolment numbers became manual in `c5effc2`. Ironically it is exactly what §2.4's `sno` race needs. |

Both still create collections in Mongo when their module is loaded — which it never is. Delete
`WeeklySummary`; **keep and reuse** `Counter`.

### 4.3 `express-validator` — installed, imported nowhere
`server/package.json` declares `express-validator@^7.3.1`. Zero imports. All validation is
hand-rolled `if (!x) return res.status(400)` inside controllers, which is why the conditional-required
trap in §2.3 has no safety net. Either adopt it properly at the route boundary or drop the dependency.

### 4.4 Three stacking global axios interceptors
Every axios request in the client passes through three request interceptors plus a `defaults` header,
all mutating the same global axios instance (nothing uses `axios.create` — verified, zero hits):

| Location | What it does | Guarded? |
|---|---|---|
| `client/src/services/commitmentService.js:7` | Sets `Authorization` from `localStorage` | **No** — module-level side effect |
| `client/src/services/userService.js:12` | Sets `Authorization` from `localStorage` (identical) | **No** — module-level side effect |
| `client/src/utils/axiosAdminOrgInterceptor.js:21` | Appends `?organization=<scope>` to admin GETs | Yes — `installed` flag at `:16` |
| `client/src/services/authService.js:9` | Sets `axios.defaults.headers.common['Authorization']` | n/a |

The two unguarded ones are byte-identical and idempotent, so today this is waste rather than a bug.
The hazard is that **importing a service module has an invisible global side effect** — a future
service that installs a *different* interceptor gets it silently ordered by import order. Consolidate
into one `client/src/services/http.js` that owns a single configured instance.

### 4.5 47 one-off scripts and 55 local branches
`server/scripts/` holds 47 `.js` files. Some are load-bearing and documented (`seedDatabase.js`,
`migrateOrganization.js`, `backfillCommitmentDate.js`, `ingestProgramDocs.js`, `importInstituteFromExcel.js`,
`runDbSnapshot.js`). Most are single-use archaeology — `fixAnishTwin.js`, `backfillEslamManoj.js`,
`fixLegacyDataBugs.js`, `verifyWeek17.js`, `roundSkillhubWholeAed.js`. They are worth *keeping* as a
record of what was done to the data, but they are not a toolbox: **most will not be safe to re-run.**
Read the header comment of any script before executing it. Several connect to `MONGODB_URI` and write.

`git branch -a` shows **55 branches**, 8 unmerged into `main`. Prune after confirming nothing is
pending.

---

## 5. Test coverage — the real numbers

**All figures VERIFIED by running the suites on 2026-09-05.**

### What `npm test` actually runs

```
$ cd server && npm test
> jest --testPathPattern="tests/(exports|meetings|institute|commitments)"
Test Suites: 14 passed, 14 total
Tests:       140 passed, 140 total
```

### What exists but is excluded

```
$ cd server && npx jest tests/execOverview tests/hourly
Test Suites: 1 failed, 3 passed, 4 total
Tests:       1 failed, 52 passed, 53 total
```

| | Suites | Tests |
|---|---|---|
| Server total on disk | 18 | 193 |
| Run by `npm test` | 14 | 140 |
| **Silently excluded** | **4** (`tests/execOverview/*` ×3, `tests/hourly/*` ×1) | **53** |
| Failing (inside the excluded set) | 1 | 1 — see §2.2 |

```
$ cd client && CI=true npx react-scripts test --watchAll=false
Test Suites: 6 passed, 6 total
Tests:       39 passed, 39 total
```

### Coverage against codebase size

| | Files | Lines | Test files |
|---|---|---|---|
| `server/` app code (excl. tests, scripts, node_modules) | 102 | — | 18 suites |
| `server/` everything (excl. node_modules) | 168 | 29,910 | — |
| `client/src/` (excl. `__tests__`) | 194 `.js` | 50,926 | 6 suites |

### Which controllers are tested at all

Of **18 controllers**, tests reference just **five**: `commitmentController`, `hourlyController`,
`instituteController`, `meetingController`, `teamEntryController`. A grep for each of the others
across `server/tests` returns **zero**:

> `authController`, `userController`, `studentController`, `consultantController`,
> `notificationController`, `aiController`, `chatController`, `docsChat` routes,
> `announcementController`, `tierController`, `paymentPlanController`,
> `reconciliationController`, `exportController`

Note that `exportController` shows zero even though `tests/exports/` is the largest suite — those
tests exercise the **pivot builder services** directly (`services/exports/pivots/students.js` etc.),
not the HTTP layer. Only **7 of 18** test files use `supertest` and therefore hit real routes:
`commitments/admissionLock`, `commitments/gradeOrYear`, `exports/rateLimit`, `institute/attendance`,
`institute/scheduleImport`, `institute/tests`, `meetings/meetings`.

**Honest summary: authentication, authorisation, user management, the entire Student CRUD surface,
the chatbot, and the Docs-RAG pipeline have no automated tests whatsoever.** The multi-tenant scoping
that keeps LUC and Skillhub apart is tested only where it happens to intersect the exports and
meetings suites. Treat any change to `middleware/auth.js` as unprotected by CI.

### Client-side lint gate is a live deploy landmine

**VERIFIED:**

```
$ cd client && CI=false npx react-scripts build   → exit 0, build succeeds (22 ESLint warnings)
$ cd client && CI=true  npx react-scripts build   → exit 1, BUILD FAILS
```

CRA promotes ESLint warnings to errors when `CI=true`. There are 22 warnings today (19
`no-unused-vars`, 3 `react-hooks/exhaustive-deps`). Deploys currently work, so Render's build
environment must not be setting `CI=true` — but there is **no `render.yaml`**, so nothing in the repo
pins that. **UNVERIFIED — needs confirmation:** check the Render service's environment for `CI`. One
person setting `CI=true` for an unrelated reason breaks every future deploy with a confusing lint
dump. Fix the 22 warnings and the landmine disarms itself.

---

## 6. Data quality issues

These are known defects in the live data, not in the code. Several have a code-level cause you can
see; where the count comes from prior operational work rather than something I could re-derive from
the repo, it is marked so.

### 6.1 Duplicate students in the Institute roster

**Cause (VERIFIED in code).** `getRoster` (`server/controllers/instituteController.js:445–483`)
builds the class list by unioning three collections and grouping on the **raw `studentName`
string**:

```js
{ $group: { _id: '$studentName', student: { $first: '$student' } } }   // :454
…
const byName = new Map();                                              // :463
```

Nothing normalises case, whitespace, or spelling. `"Aarav Sharma"`, `"aarav sharma"`, and
`"Aarav  Sharma"` are three students. There is also **no unique index on `Student.studentName`**
(`server/models/Student.js:364–375`), and Skillhub `enrollmentNumber` is manually typed by the
counsellor (`:140–147`, `unique: true, sparse: true`) — so re-entering a student with a different
enrolment number creates a genuine second record, and `unique` never fires.

`InstituteEnrollment` *is* protected — a unique compound index on
`(organization, gradeOrYear, subject, studentName)` (`server/models/InstituteEnrollment.js:37–40`)
makes re-adding idempotent — but only for byte-identical names.

**Count in production: UNVERIFIED — needs confirmation.** Run `server/scripts/auditStudents.js`
(read-only) against the live DB to get today's number. Note that the audit script checks duplicate
*enrolment numbers* and duplicate *sno*, but **not** duplicate names — you will need to add that
aggregation.

**Fix direction:** add a normalised `studentNameKey` (lowercased, whitespace-collapsed) to `Student`
and to the roster group key, then de-duplicate with a one-off script that merges attendance and test
records onto the surviving `_id`.

### 6.2 Students whose birth year is the record-creation year

**Cause (VERIFIED in code).** `dob` has no constraints at all:

```js
// server/models/Student.js:104
dob: { type: Date },
```

No `min`, no `max`, no validator. The input is a bare HTML date field with no bounds:

```jsx
// client/src/components/skillhub/SkillhubStudentFormDialog.js:318
value={formData.dob} onChange={(e) => set('dob', e.target.value)}
```

So a counsellor who tabs into the year segment and types the current year gets a student born this
year, saved silently.

**Count: approximately 4 records, per prior operational review — UNVERIFIED against the live DB
today.** Re-derive it with an aggregation on `Student` where `organization = 'skillhub_institute'`
and `$year: '$dob'` is within a couple of years of `$year: '$createdAt'`.

**Why it matters beyond tidiness:** `server/services/birthdayNotifier.js` matches on month+day only
(`findBirthdays`, `:37–54`) and `upcomingBirthdays` (`:63+`) drives the visible "Upcoming birthdays"
panel and an 08:00 Asia/Dubai cron. A wrong *year* does not break the reminder — but any downstream
age calculation, and the Institute's own reporting, will be wrong. Add `max: Date.now()` plus a
sensible minimum-age check to the schema and a `max` attribute to the input.

### 6.3 Attendance and enrolment rows with `student: null` ("unlinked")

**By design, and it is the right design — but it costs you.** Both models keep the name string as the
source of truth and the `Student` reference as optional:

```js
// server/models/Attendance.js:19–20
student:     { type: mongoose.Schema.ObjectId, ref: 'Student', default: null, index: true },
studentName: { type: String, required: true, trim: true },
```

Free-typed names keep `student = null` and render `(unlinked)` in the UI
(`client/src/components/institute/AttendanceTab.js:240`,
`client/src/components/institute/TestsTab.js:230`). This exists so that legacy and imported rows do
not vanish.

The friction is that grade labels in the admissions data are inconsistent and the code
**deliberately refuses to auto-match** — the comment at
`server/controllers/instituteController.js:499–503` is explicit: *"Grade labels are inconsistent in
the admissions data ('g11', 'grade 11', 'G11') so they're returned verbatim for display and the user
chooses — we never auto-match on them."* That is a sound safety call; the cost is that unlinked rows
accumulate and any report joining attendance to `Student` (fees, curriculum, DOB) silently excludes
them.

**Count: UNVERIFIED.** Count `Attendance` and `InstituteEnrollment` docs where `student: null`, then
build an admin "link these" screen using the existing `getInstituteStudents` picker
(`instituteController.js:504`).

### 6.4 626 LUC students hidden from every view

`applyHideLucZeroFeeFilter` (`server/controllers/studentController.js:58–74`) is merged into every
LUC students raw and pivot query. It hides rows where `organization === 'luc'` and
`admissionFeePaid` is not `> 0` — 626 rows, caused by an importer bug. There is **no UI toggle**.
The rows are still in the database, and a backup dump sits at
`server/dumps/luc_zero_admission_fee_20260423125500.json` (which is itself a problem — see §3.7).

This is intentional (see `CLAUDE.md` and the memory note `project_luc_zero_fee_hidden.md`), but a new
developer will absolutely be confused when a student who exists in Mongo cannot be found in the app.
**The root cause was never fixed and the rows were never repaired** — the filter is a permanent
workaround. Deciding whether to backfill or delete them is a legitimate 30-day question.

### 6.5 LUC `admissionFeePaid` mixes net-of-VAT and gross-of-VAT

Roughly a 50/50 split across ~348 LUC rows (UAE VAT 5%), never reconciled. Export sheets that surface
`admissionFeePaid` carry a row-1 disclaimer telling the reader that sums are approximate. **Any
revenue figure derived from that field is approximate by construction.** Do not build a financial
report on it without reading `CLAUDE.md § Business rules` and the memory note
`project_admission_fee_convention.md` first.

### 6.6 Skillhub Training branch has never had a student

Per prior operational review (2026-06-18): the Training branch has **0 students, ever**; the
Institute branch is the active one (~26 students at that time). **UNVERIFIED today.** The practical
consequence is that any Training-branch code path is effectively **untested in production** — empty
states, aggregations, and export scopes for `skillhub_training` have never met real data. Treat that
branch as pre-release.

---

## 7. Operational gaps

### 7.1 P0 — `npm run seed` will destroy production, and nothing stops it

This is the single most dangerous command in the repository, and it is listed in `CLAUDE.md` and
`README.md` among ordinary development commands.

```js
// server/scripts/seedDatabase.js:1
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
…
// :22–24
await mongoose.connect(process.env.MONGODB_URI);
// :34–37
console.log('🗑️  Clearing existing data...');
await User.deleteMany({});
await Consultant.deleteMany({});
await Commitment.deleteMany({});
```

There is **no `NODE_ENV` guard, no confirmation prompt, no `--yes` flag, no host check**. It reads
`MONGODB_URI` from `server/.env` — which on a working developer machine points at the **live Atlas
cluster** (see §7.2). Running `npm run seed` to "get some test data" deletes every user, every
consultant, and every commitment in production, then overwrites `LOGIN_CREDENTIALS.md` with new
passwords.

**Before you do anything else on day one:** add a guard to that script that refuses to run unless
`MONGODB_URI` contains `localhost` or `NODE_ENV === 'development'` **and** an explicit
`--i-know-this-deletes-everything` flag is passed. It is a ten-line change that prevents an
unrecoverable incident.

(For comparison, `server/scripts/seedSkillhub.js` is documented as non-destructive and
`migrateOrganization.js` / `backfillCommitmentDate.js` are documented as idempotent — the
destructiveness is specific to `seedDatabase.js`.)

### 7.2 P1 — The Atlas cluster is named "dev" but IS production

There is one MongoDB Atlas cluster and its host name reads as a development cluster. It holds all
live LUC and Skillhub data. There is **no separate development or staging database**. Every developer
who runs the app locally against `server/.env` is reading and writing production.

**Do not rename the cluster** (the connection string is referenced from Render's environment and from
every local `.env`) — but **do** put a loud warning at the top of every entry-point script, and stand
up a genuinely separate dev database as soon as practical. `mongodb-memory-server` is already a dev
dependency and the test suites use it (`server/tests/exports/_setup.js`), so the pattern for an
isolated database already exists in the repo.

### 7.3 P1 — No infrastructure-as-code, no CI/CD, no staging

**VERIFIED by inspection of the repo root:**

| Expected | Present? |
|---|---|
| `render.yaml` | **No** |
| `.github/workflows/` | **No** |
| `Dockerfile` / `Procfile` | **No** |
| `.nvmrc` or `engines` in any `package.json` | **No** |
| ESLint / Prettier config beyond CRA's built-in | **No** |

Consequences:

- **All Render configuration exists only in the dashboard.** Build command, start command,
  environment variables, health-check path, region, instance size, auto-deploy branch — none of it is
  in version control. If the service is deleted or the account is lost, **the deployment is not
  reconstructible from this repository.** Reproducing it depends entirely on
  `docs/handover/04-deployment-and-infrastructure.md` and `docs/handover/11-credentials-and-access-handover.md`
  being complete. Verify them against the live dashboard *while the outgoing developer is still
  reachable.*
- **Nothing runs tests before deploy.** `main` auto-deploys to Render. A commit that breaks
  `npm test` ships. Given that `npm test` already misses a failing suite (§2.2), the safety net is
  thinner than it looks.
- **No staging.** Every change is validated in production.
- **No Node version pin.** Render chooses a default. A platform-side Node bump can change build
  behaviour with no commit on your side. (For reference, the client build succeeds on Node v24.10.0
  locally — VERIFIED.)

**First infrastructure task:** write a `render.yaml` that mirrors the dashboard exactly, add an
`engines.node` field to `server/package.json` and `client/package.json`, and add a GitHub Action that
runs `cd server && npm test` and `cd client && CI=true npm test` on every PR.

### 7.4 P1 — Backups depend on environment variables nobody in the repo can confirm

There *is* a nightly backup: `server/server.js:157–170` schedules `runDbSnapshot()` at 00:30
Asia/Dubai, dumping every collection as gzipped JSON to `db-snapshots/YYYY-MM-DD/` in S3
(`server/services/dbSnapshot.js`).

**But it silently disables itself when S3 is not configured:**

```js
// server/services/dbSnapshot.js:12–15
if (!s3.isEnabled()) {
    console.warn('[db-snapshot] S3 not configured (AWS_*/S3_BUCKET) — skipping');
    return { skipped: true };
}
```

`s3.isEnabled()` (`server/services/s3.js:35–37`) is true only when `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_REGION` and `S3_BUCKET` are all present. The only signal that backups
are off is a `console.warn` at boot — no alert, no dashboard, no health check.

**UNVERIFIED — needs confirmation, and this is urgent.** As of a 2026-05-31 note the S3 bucket and
its four Render environment variables were still *pending*. If that was never completed, **there
have been no application-level backups since the feature shipped**, and the only recovery point is
whatever MongoDB Atlas's own backup tier provides (which depends on the cluster plan — also
UNVERIFIED).

**Day-one checks:**
1. Open Render → Environment. Are all four `AWS_*`/`S3_BUCKET` variables set?
2. Open the S3 bucket. Is there a `db-snapshots/` prefix with recent dates?
3. Open Atlas → Backup. What is the retention and the recovery point objective?
4. Grep the Render logs for `[db-snapshot]` and see which of the two messages appears at boot.

**There is also no restore path.** `server/scripts/runDbSnapshot.js` writes; nothing reads a snapshot
back. Write and *test* a restore script — an untested backup is not a backup.

### 7.5 P2 — One unhandled promise rejection kills the whole service

```js
// server/server.js:190–194
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});
```

Any unhandled rejection anywhere — a background cron, the drift monitor, an SSE stream that lost its
client, a Groq/OpenAI SDK timeout — takes the entire single-instance web service down. Render will
restart it, but every in-flight request fails and the Docs-RAG index has to reload from Mongo on
boot. Given ~749 `console.*` calls across the server and no structured error handling in the cron
jobs, this fires more often than you would like. Log and continue for non-fatal cases; reserve exit
for genuinely unrecoverable state.

### 7.6 P2 — No monitoring or alerting

There is a health endpoint (`GET /api/health`, `server/server.js:99–104`) and a Docs-RAG readiness
probe (`GET /api/docs-chat/health`, `server/routes/docsChat.js:61`, deliberately unauthenticated for
Render). Nothing consumes them for alerting. No uptime monitor, no error tracker, no log aggregation,
no spend alarm on the OpenAI/Groq accounts. `docs/engineering/07-monitoring-and-alerting-runbook.md`
describes a monitoring posture that does not exist in the code — read it as a plan, not a fact.

### 7.7 P3 — SPA fallback is GET-only

`server/server.js:111` registers `app.get(/^(?!\/api).*/)` for the SPA. A non-GET request to a
non-`/api` path (a mistyped POST, a crawler probe) gets Express's default HTML 404 rather than a JSON
envelope. Cosmetic, but it means not every error response from this service is JSON — client code
that assumes `err.response.data.message` exists will read `undefined` (which is exactly what happens
in §2.1).

---

## 8. Performance and scale limitations

| Issue | Detail | Severity |
|---|---|---|
| **940 kB main bundle (gzipped)** | VERIFIED from a production build: `main.d75d53dc.js` at 940.24 kB gzipped, plus ~220 kB of chunks. CRA itself warns *"The bundle size is significantly larger than recommended."* Root cause: MUI v7 + ECharts + xlsx + jsPDF + framer-motion all eagerly imported, with almost no route-level code splitting (only 7 chunks emitted for 194 source files). On a mobile connection first paint is slow. | P2 |
| **A database read on every authenticated request** | `server/middleware/auth.js:27` does `User.findById(decoded.id)` per request, to re-check `isActive` and load `organization` (the JWT payload carries only `id` and `role` — `server/models/User.js:86`). Correct and secure, but it is an extra Atlas round trip on every API call, and Render and Atlas are not necessarily colocated (`DEPLOYMENT.md:436–437` notes boot takes ~25 s cross-region vs under 2 s colocated — a strong hint that latency is real). Cache with a short TTL if this ever bites. | P2 |
| **Docs-RAG index is per-process and in-memory** | `server/services/docsRagService.js` loads all 215 chunks, the question index, and the BM25 index into module state at boot (`server/server.js:134–144`). Fine on one instance; the moment you scale horizontally every instance holds its own copy, and a re-ingest via `POST /api/docs-chat/admin/reingest` only refreshes the instance that served the request. | P2 (blocks scaling) |
| **Nightly snapshot loads every collection into memory** | `server/services/dbSnapshot.js` comment at `:5–6` is candid: *"Sized for this app (a few thousand docs); for a much larger DB this should stream instead of toArray."* It will OOM the web service long before Atlas complains. | P3 today, P1 at 10× data |
| **Export row caps** | `POST /api/exports/raw` caps a page at 5,000 rows; `exportsApi.fetchAllRawRows` loops to a 100k client-side hard cap; `PreviewTab` renders at most 10,000 with a banner. Documented and deliberate, but a user exporting >100k rows gets a silently truncated file. | P3 |
| **Rate-limit counters are per-process and in-memory** | See §3.3. Resets on every deploy. | P3 |

---

## 9. Documentation debt

The `docs/engineering|security|legal|user-guides` set (~13,140 lines, 45 files) was last updated by
commit `560b12e` on **2026-04-26** — **207 of 394 commits ago**. It is genuinely useful for
policies, the legal set, and the general shape of the system. It is **not** a reliable API or
architecture reference.

Concretely, `docs/engineering/02-api-reference.md` has **zero mentions** of six of the nineteen
mounted route groups (VERIFIED by grep):

| Route group | Mounted at | In stale API reference? |
|---|---|---|
| `/api/tiers` | `server/server.js:51` | **No** |
| `/api/payment-plans` | `server/server.js:52` | **No** |
| `/api/announcements` | `server/server.js:50` | **No** |
| `/api/reconciliation` | `server/server.js:44` | **No** |
| `/api/exec-overview` | `server/server.js:48` | **No** |
| `/api/team-entries` | `server/server.js:49` | **No** |
| `/api/institute` | `server/server.js:53` | One passing mention |

That means the Leadership Dashboard suite, the Month-End Race tiers, payment plans, announcements,
admission reconciliation, and most of the Skillhub Institute feature are undocumented there.

**Order of trust when they disagree:** the code → `CLAUDE.md` (accurate on architecture, stale on
"Known Issues") → `docs/handover/` (this set, written 2026-09-05) → `docs/engineering|security` (2026-04-26).

`DEPLOYMENT.md`, `DEPLOYMENT_GUIDE.md`, `HOW_TO_RUN.md` and `README.md` at the repo root overlap and
partly contradict each other; `DEPLOYMENT.md:114` still references `heroku config:set`. Consolidate
into `docs/handover/04-deployment-and-infrastructure.md` and delete the rest.

---

## 10. Deliberate decisions that look like bugs — do not "fix" these

Every one of these has cost someone a day. They are correct as written.

| Looks wrong | Actually intentional | Where |
|---|---|---|
| Closed admissions cannot be reopened | Irreversible by design; the server rejects `admissionClosed: false` and refuses any status other than `achieved` on a closed row. | `server/controllers/commitmentController.js:297–316` |
| 626 LUC students are invisible in the app | Importer-bug rows hidden by a permanent filter, no toggle. | `server/controllers/studentController.js:58–74` |
| The `manager` role can pick Skillhub orgs on `/exports` but is LUC everywhere else | Explicit carve-out in the permission matrix, `students` dataset only. | `server/controllers/exportController.js:12–42` |
| `createTests` upserts instead of delete-then-insert | So re-recording a session only touches the students in the payload; a unique compound index backs it and `bulkWrite` runs `ordered:false`, swallowing benign `E11000`s. | `CLAUDE.md § Test Tracker`; `server/tests/institute/tests.test.js` |
| Marks validation lives in the controller, not the schema | `bulkWrite` upserts do **not** run Mongoose validators, even with `runValidators`. `toNonNegativeNumber()` is the enforcement point. Keep it in step with the `row.save()` path in `updateTest`. | `server/controllers/instituteController.js` |
| Schedule import replaces only teachers present in the file | So one teacher's upload cannot wipe another's schedule. Order is capture-old-ids → `insertMany` → `deleteMany`, deliberately leaving duplicates rather than an empty schedule on failure. | `CLAUDE.md § Schedule upload`; `server/tests/institute/scheduleImport.test.js` |
| Blank Day cells in an imported schedule are forward-filled | Excel merges the Day column; without forward-fill the parser dropped most of a normal schedule and the replace then deleted real sessions. Non-blank unparseable days are reported in `warnings`, never dropped. | `server/services/institute/scheduleParser.js` |
| Institute grades are never auto-matched to students | Admissions grade labels are inconsistent (`g11` / `grade 11` / `G11`); auto-matching would mis-file students. | `server/controllers/instituteController.js:499–503` |
| The chatbot answers any user on any topic | Stated product decision — **but see §3.1**, because the *data scoping* consequence may not have been part of that decision. | `server/routes/chat.js:15–16` |
| `Notification` delete is a hard delete | No soft-delete flag on the model; the controller aligned to the model during Skillhub integration. | `server/controllers/notificationController.js:152` |
| Users and Consultants delete softly (`isActive: false`) but Commitments/Students delete permanently | History is preserved through denormalised string fields (`consultantName`, `teamLeadName`, `teamName`) rather than tombstones. | `server/controllers/userController.js:156`, `consultantController.js:189` |
| Commitment routes are in a fussy order | `/date-range`, `/linkable`, `/ai-analysis`, `/week/:n/:y`, `/consultant/:name/performance` **must** precede `/:id` or the catch-all eats them. Comments say so at `:30–31` and `:57`. | `server/routes/commitments.js` |

---

## 11. Recommended first 30 days

Ordered by risk reduced per hour spent. Items 1–4 are same-week; nothing in 1–7 requires you to
understand the whole product first.

### Week 1 — stop the bleeding

1. **Rotate every credential in `LOGIN_CREDENTIALS.md`, then delete the file and
   `server/dumps/*.json`; add both to `.gitignore`.** (§3.7) Do this while the outgoing developer is
   still reachable, so you can confirm which accounts are live. Then decide, deliberately, whether to
   purge git history.
2. **Guard `server/scripts/seedDatabase.js`.** (§7.1) Refuse to run unless `MONGODB_URI` is a
   localhost URI *or* an explicit destructive flag is passed. Ten lines. Prevents an unrecoverable
   accident that the current docs actively invite.
3. **Verify backups actually run.** (§7.4) Check the four `AWS_*`/`S3_BUCKET` variables in Render,
   check for recent objects under `db-snapshots/`, and check the Atlas backup tier. If S3 was never
   configured, configure it today. **Then write and test a restore script** — restore an S3 snapshot
   into a scratch database and confirm the data is intact.
4. **Capture the Render configuration into the repo.** (§7.3) Take screenshots or a
   `render.yaml` that mirrors every dashboard setting, including whether `CI` is set. Right now the
   deployment is not reconstructible from source, and the person who knows it is leaving.

### Week 2 — make the safety net real

5. **Delete the `--testPathPattern` from `server/package.json`** so `npm test` runs all 18 suites,
   then fix the `execOverview` failure properly — move `ADMIN_MONTHLY_TARGET` out of the aggregator
   into configuration or a database row and update the spec against that. (§2.2)
6. **Clear the 22 client ESLint warnings** so `CI=true npm run build` passes. (§5) This disarms a
   deploy landmine and takes under an hour.
7. **Add a GitHub Action** running `cd server && npm test` and `cd client && CI=true npm test` on
   every PR to `main`. (§7.3) With items 5 and 6 done, it will be green from day one — which is the
   only way a CI gate survives.
8. **`npm audit fix` on `server/`** to clear `jws` (your JWT signing chain) and `mongoose` (NoSQL
   injection + prototype pollution). Re-run the now-complete test suite to confirm. Leave `xlsx`
   alone for now and open a ticket to migrate to `exceljs`. (§3.8)

### Weeks 3–4 — close the real holes

9. **Scope the chatbot's tools to the caller.** (§3.1) Thread `req.user` through `chatService` into
   `runTool`, and merge a `buildScopeFilter`-equivalent floor into every tool's `$match` that the LLM
   cannot widen. Confirm with leadership first whether cross-team revenue visibility was actually
   intended. This is the largest unmitigated data-exposure risk in the system.
10. **Fix the conditional-required trap on `Student`.** (§2.3) Port the JS re-check pattern from
    `meetingController.js:298–313` into `studentController.updateStudent`, covering all 21 affected
    fields. Add a regression spec — this will be the first test `studentController` has ever had.
11. **Add rate limiting where money and credentials are.** (§3.3) `POST /api/auth/login` (per-IP,
    with backoff), and every `/api/ai/*`, `/api/chat/*`, `/api/docs-chat`, `/api/tiers/generate-image`
    route (per-user). Add a monthly spend ceiling that reads `AIUsage` and returns 429 when exceeded —
    the data is already being collected, it is simply never enforced.
12. **Fix the Close Admission button.** (§2.1) One line in `commitmentService.js`. Verify the
    `closedAmount` now lands, since that is the field the Revenue views depend on.

### Ongoing, once you have context

13. Run `server/scripts/auditStudents.js` (read-only) and triage what it reports; extend it with a
    duplicate-name check and a `dob` sanity check, then de-duplicate the Institute roster with a
    normalised name key. (§6.1, §6.2)
14. Constrain `dob` in the schema and in the form (`max: Date.now()` plus a minimum-age floor). (§6.2)
15. Build an admin screen to link `(unlinked)` attendance and enrolment rows to real `Student`
    records, using the existing `getInstituteStudents` picker. (§6.3)
16. Add a CSP with nonces. (§3.2) Budget a full day; CRA will fight you.
17. Delete the dead code: `ConsultantDashboard.js`, `WeeklySummary.js`, `express-validator`, the
    `updateMeetings` client method, `client/.env`. Consolidate the three axios interceptors into one
    `http.js`. Prune the 47 unmerged branches. (§4)
18. Split the client bundle by route. 940 kB gzipped is roughly 6× a healthy app-page budget. (§8)
19. Restrict CORS to the production origin plus `http://localhost:3001`. (§3.5)
20. Stop leaking raw error messages in production. (§3.6)
21. Bring `docs/engineering/02-api-reference.md` up to date, or replace it with
    `docs/handover/06-api-reference.md` and delete the stale one. Six route groups are entirely
    missing. (§9)

**One thing to resist:** do not start by refactoring. This codebase is larger than it looks
(80k lines across ~370 source files), it has almost no test coverage outside four feature areas, and
it is deployed straight to production with no staging. Every item above is small, verifiable, and
reduces the chance that your first significant change is also your first significant outage.

---

## Related documents

| Doc | What it covers |
|---|---|
| [`00-START-HERE.md`](00-START-HERE.md) | Orientation and reading order for this handover set |
| [`01-system-architecture.md`](01-system-architecture.md) | How the pieces fit together |
| [`02-application-workflows.md`](02-application-workflows.md) | End-to-end business flows |
| [`03-database-schema.md`](03-database-schema.md) | The 27 Mongoose models and their relationships |
| [`04-deployment-and-infrastructure.md`](04-deployment-and-infrastructure.md) | Render, Atlas, S3 — **cross-check against §7 before trusting it** |
| [`05-environment-setup.md`](05-environment-setup.md) | Local development — **read §7.1 and §7.2 first** |
| [`06-api-reference.md`](06-api-reference.md) | Current endpoint reference (supersedes `docs/engineering/02-api-reference.md`) |
| [`07-roles-and-permissions.md`](07-roles-and-permissions.md) | The four roles and the scoping model — **§3.1 is the exception to everything in it** |
| [`08-dependencies-and-integrations.md`](08-dependencies-and-integrations.md) | OpenAI, Groq, S3, Socket.IO and the npm surface |
| [`09-operations-backup-recovery.md`](09-operations-backup-recovery.md) | Runbooks — **§7.4 is the open question it depends on** |
| [`11-credentials-and-access-handover.md`](11-credentials-and-access-handover.md) | Accounts and access transfer — **start here alongside §3.7** |

External to this set: `CLAUDE.md` (repo root, architecture reference — Known Issues section stale),
`DOCS_RAG_FEATURE_SPEC.md` (16-section spec for the program-docs chatbot), and
`docs/security/14-security-gap-analysis-and-remediation-roadmap.md` (2026-04-26; predates the
findings in §3.1 and §3.7).
