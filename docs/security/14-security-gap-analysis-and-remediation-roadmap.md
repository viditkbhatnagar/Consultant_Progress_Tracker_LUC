# Security Gap Analysis & Remediation Roadmap

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]` + Engineering lead `[FILL]`

This is the brutally honest snapshot of the platform's current security
posture. Every finding cites `file:line` so it can be reproduced. Each item
has severity, evidence, proposed fix, owner placeholder, and target date
placeholder. **Findings are intentionally not sugar-coated.**

| Severity | Definition | Patch SLA |
|---|---|---|
| **P0** | Active exposure or imminent exploit; production data, secrets, or auth at risk | 72 hours from confirmation |
| **P1** | Credible exploitation path or material compliance breach | 14 days |
| **P2** | Defense-in-depth weakness; not directly exploitable today | 60 days |
| **P3** | Hygiene / documentation / minor drift | 90 days |

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| SEC-01 | P0 | NoSQL regex injection in meeting search | Open |
| SEC-02 | P0 | CORS allows all origins in production | Open |
| SEC-03 | P0 | No rate limit on `/api/auth/login` | Open |
| SEC-04 | P0 | `server/.env.example` ships with apparently-real credentials | Open |
| SEC-05 | P0 | OpenAI / Groq DPAs not confirmed signed | Open |
| SEC-06 | P0 | CSP disabled globally | Open (compensating: same-site CORP) |
| SEC-07 | P1 | No MFA / 2FA for any role | Open |
| SEC-08 | P1 | Weak password policy (`minlength: 6`, no class rules) | Open |
| SEC-09 | P1 | No password reset / account-recovery flow | Open |
| SEC-10 | P1 | Stateless logout — no token revocation | Open |
| SEC-11 | P1 | Error handler logs full stack via `console.log` | Open |
| SEC-12 | P1 | Failed logins not logged or alerted | Open |
| SEC-13 | P1 | OpenAI / Groq receive personal data including minors' | Open |
| SEC-14 | P1 | localStorage holds JWT + user object — no HttpOnly | Open |
| SEC-15 | P2 | `express-validator` installed but unused | Open |
| SEC-16 | P2 | No audit trail for deletions | Open |
| SEC-17 | P2 | No rate limits on `/exports/raw`, `/students`, `/commitments`, `/chat/*` | Open |
| SEC-18 | P2 | Admin `?organization=` switch is not logged | Open |
| SEC-19 | P2 | No HTTPS-redirect / HSTS configured at app layer | Open |
| SEC-20 | P2 | DocsChatLog and AIUsage retained indefinitely | Open |
| SEC-21 | P2 | No JWT_SECRET strength validation at boot | Open |
| SEC-22 | P3 | Helmet defaults unverified (X-Frame-Options, etc.) | Open |
| SEC-23 | P3 | No Sentry / structured logging | Open |
| SEC-24 | P3 | `PORT` defaults to 5000 in code; expected 5001 | Open |
| SEC-25 | P3 | `react-data-grid@7.0.0-beta.59` pinned to a beta | Accepted risk |
| SEC-26 | P3 | `WeeklySummary` model unused | Open |
| SEC-27 | P3 | `Counter` collection retained but unused | Accepted (per CLAUDE.md gotcha) |

## Findings

---

### SEC-01 · P0 — NoSQL regex injection in meeting search

**Evidence**:
[`server/controllers/meetingController.js:95`](../../server/controllers/meetingController.js)

```js
if (search) {
    filter.studentName = { $regex: search, $options: 'i' };
}
```

`search` comes from `req.query.search` and is interpolated raw into a
`$regex`. An attacker can:

- pass `.*` to bypass the intended substring filter
- pass an exponential-backtracking pattern to induce ReDoS
- pivot to other Mongoose operators if the operator-stripping middleware
  (none exists) is not added later

**Why it matters**: a known-good escape pattern already exists in the same
codebase at
[`server/services/chatTools.js`](../../server/services/chatTools.js)
(`String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`).

**Fix**: escape the value before use, or move to a literal substring search
via `$text` or a precomputed lowercase index. Add a regression test that
asserts `search='.*'` returns 0 rows on a fixture with one matching name.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-02 · P0 — CORS allows all origins

**Evidence**: [`server/server.js:28`](../../server/server.js)

```js
app.use(cors());
```

In production (Render Singapore), this means any origin can issue
authenticated requests if it has a valid token. Combined with the JWT
living in `localStorage` (SEC-14), an XSS on any same-origin sub-path
escalates to full account takeover. Cross-origin XHR with credentials is
**not** the immediate risk because CORS is not the JWT carrier — but a
permissive CORS still makes browser-side defenses harder.

**Fix**: pass an explicit allowlist:

```js
app.use(cors({
  origin: [
    process.env.PUBLIC_APP_ORIGIN,           // e.g. https://app.learnerseducation.ae
    process.env.PUBLIC_DOCS_ORIGIN,          // optional
  ],
  credentials: false,                        // we don't use cookies; no need to send credentials
}));
```

Then deprecate dev-mode permissiveness behind `if (NODE_ENV !==
'production')`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-03 · P0 — No rate limit on `/api/auth/login`

**Evidence**: [`server/routes/auth.js:15`](../../server/routes/auth.js)

```js
router.post('/login', login);
```

No rate limiter. `express-rate-limit` is already a dependency
([`server/package.json`](../../server/package.json)) and the same library
is already used at
[`server/middleware/exportRateLimit.js`](../../server/middleware/exportRateLimit.js).
Brute-forcing a known admin email is unconstrained.

**Fix**: dedicated limiter, e.g. 5 attempts per IP per 15 minutes with
exponential cooldown for the IP after 3 consecutive failures. Log every
failure (SEC-12).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-04 · P0 — `server/.env.example` ships apparently-real credentials

**Evidence**: tracked file [`server/.env.example`](../../server/.env.example)
contains an Atlas connection string of the form
`mongodb+srv://<user>:<password>@…` with what appears to be a non-placeholder
password, and a JWT secret literal that reads as a default. While
`server/.env` itself is gitignored ([.gitignore:14, 19](../../.gitignore))
and never committed, the `.example` file is checked in and triggers
secret-scanners.

**Fix**: scrub the file to placeholders only; rotate any real credentials
that ever appeared in repo history; add a `gitleaks` pre-commit hook.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-05 · P0 — OpenAI / Groq DPAs not confirmed signed

**Evidence**: business confirmation outstanding (per onboarding question to
the user, 2026-04-26). The platform sends personal data — including minors'
names, phones, emails — to OpenAI and Groq via tool results
([`chatTools.js`](../../server/services/chatTools.js)) and Docs RAG queries
([`docsRagService.js`](../../server/services/docsRagService.js)).

**Why it matters**: under PDPL Art. 23 and GDPR Art. 28, controllers may
only engage processors who provide sufficient guarantees and a written DPA.
Without one we cannot publish a Privacy Policy claim that says "AI vendors
do not train on your data".

**Fix**: sign OpenAI's API DPA (zero-data-retention rider where applicable)
and Groq's DPA. Record signature dates in
[Sub-processor List](../legal/06-subprocessor-list.md).

**Owner**: DPO `[FILL]` · **Target**: `[FILL]`

---

### SEC-06 · P0 — Content Security Policy disabled

**Evidence**: [`server/server.js:23`](../../server/server.js)

```js
helmet({ contentSecurityPolicy: false, ... })
```

CSP is the strongest defence-in-depth against XSS. It was disabled because
CRA generates inline styles and dynamic chunks; that is fixable with a
nonce strategy or by accepting `'unsafe-inline'` for `style-src` only.

**Fix**: enable a tuned CSP. Minimum acceptable directives:

- `default-src 'self'`
- `script-src 'self'`
- `style-src 'self' 'unsafe-inline'` (CRA constraint; revisit on eject /
  Vite migration)
- `img-src 'self' data: blob:`
- `connect-src 'self' https://api.openai.com https://api.groq.com`
- `frame-ancestors 'none'`

Compensating control today: `crossOriginResourcePolicy: 'same-site'`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-07 · P1 — No MFA

**Evidence**: no TOTP / WebAuthn / SMS in code. Auth is email + password
only ([`authController.js`](../../server/controllers/authController.js)).

**Fix**: enable TOTP (e.g., `speakeasy` + QR enrolment) for `admin` first;
extend to `team_lead` and `manager` next; optional for counselors. Store
secret encrypted (AES-256-GCM) on `User`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-08 · P1 — Weak password policy

**Evidence**: [`server/models/User.js:22`](../../server/models/User.js)
sets `minlength: 6`. No class requirements (uppercase, digit, symbol). No
HIBP-style breach check.

**Fix**: enforce ≥ 12 chars with a strength score (e.g., `zxcvbn`) ≥ 3.
Document in [Information Security Policy](01-information-security-policy.md).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-09 · P1 — No password-reset flow

**Evidence**: no `/forgot` or token-based reset routes in
[`server/routes/auth.js`](../../server/routes/auth.js).

**Fix**: implement single-use signed reset token (24 h expiry, store hash
on User), email delivery (`[FILL: SMTP provider]`), throttled per email +
IP.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-10 · P1 — Stateless logout

**Evidence**: [`server/routes/auth.js:16`](../../server/routes/auth.js)

```js
router.get('/logout', protect, logout);
```

The handler returns 200 but the JWT remains valid until `JWT_EXPIRE`. There
is no revocation list.

**Fix**: shorten access-token life to 15 min, add a refresh-token table
(rotate on use, revoke on logout) **or** maintain a per-user `tokenVersion`
incremented on logout, checked in `protect`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-11 · P1 — Error handler dumps full stack

**Evidence**: [`server/middleware/errorHandler.js:6`](../../server/middleware/errorHandler.js)

```js
console.log(err);
```

Stack traces include query filters that may carry student names, phones,
or emails. Render's stdout pipe is captured to a vendor log store. This
risks PII leakage to a third party (Render) outside of an executed DPA.

**Fix**: log a generated `errorId`, scrub PII from the message, and ship to
Sentry (or equivalent) where field-level scrubbing is configured.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-12 · P1 — Failed logins not logged

**Evidence**: failed-login branch in
[`server/controllers/authController.js`](../../server/controllers/authController.js)
returns 401 with no side effect.

**Fix**: log `(timestamp, attempted email, IP, userAgent)` on every
failure. Add an alert if > 5 failures / 10 minutes for a single email.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-13 · P1 — Personal data — including minors' — sent to OpenAI / Groq

**Evidence**:
[`server/services/chatTools.js`](../../server/services/chatTools.js) returns
rows of `Student` (name, phone, email, school, EMI, parent contact),
`Commitment` (studentName, studentPhone, free-text notes),
`Meeting` (studentName, remarks). These tool results are appended to the
prompt
[`server/services/chatService.js`](../../server/services/chatService.js)
and sent to OpenAI / Groq.

**Why it matters**: minors' contact data and parent contact data flow to a
US-based processor. Without DPAs (SEC-05) and explicit parental consent
covering AI processing (see
[Children's Privacy Notice](../legal/07-childrens-privacy-notice.md)), this
is non-compliant under PDPL Art. 9 and GDPR Art. 8.

**Fix (layered)**:

1. Sign DPAs (SEC-05).
2. Reduce data sent to LLM: project tool results to the minimum fields
   needed for the answer; redact phone/email by default and require a
   query-side opt-in to include them.
3. Disable AI features for the Skillhub orgs containing minors until
   parental consent + DPAs are in place.

**Owner**: DPO + Engineering · **Target**: `[FILL]`

---

### SEC-14 · P1 — JWT + user profile in `localStorage`

**Evidence**:
[`client/src/contexts/AuthContext.js`](../../client/src/contexts/AuthContext.js)
+ [`client/src/services/authService.js`](../../client/src/services/authService.js)
persist `token` and `user` (JSON with email, role, organization) in
`localStorage`.

**Why it matters**: `localStorage` is JS-readable. Any XSS — made worse by
SEC-06 (CSP disabled) — exfiltrates the token immediately.

**Fix**: move auth to an HttpOnly + Secure + SameSite=Strict cookie.
Requires server-side cookie parser, CORS credentials handling, and CSRF
double-submit on state-changing endpoints. Coordinate with SEC-02 (CORS)
and SEC-10 (refresh tokens).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-15 · P2 — `express-validator` unused

**Evidence**: dependency in
[`server/package.json`](../../server/package.json); zero `require` /
`import` in source.

**Fix**: adopt `express-validator` chains on every route handler. Start
with `/auth/*`, `/users/*`, `/students/*`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-16 · P2 — No audit trail for deletions

**Evidence**: `Commitment`, `Student`, `Meeting` carry `createdBy` /
`lastUpdatedBy` but no `deletedBy` / `deletedAt`. Hard-deleted entities
(Student, Meeting, Notification, ChatConversation) lose all forensic
trace.

**Fix**: introduce a separate `AuditLog` collection or add
`deletedBy`/`deletedAt` plus a `tombstoned: true` flag where soft-delete
is acceptable. Log who set `admissionClosed: true`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-17 · P2 — Rate limits missing on the rest of the API

**Evidence**: limiter is only applied in
[`server/routes/exports.js`](../../server/routes/exports.js) on `/pivot`
and `/template/:id`. Nothing on `/auth/*` (covered by SEC-03), `/students`,
`/commitments`, `/chat/stream`, `/docs-chat`, `/exports/raw`.

**Fix**: a global `app.use(rateLimit(...))` with sensible default (e.g.,
60 req/min/user); per-route overrides for AI endpoints (10 req/min/user).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-18 · P2 — Admin `?organization=` switch is unaudited

**Evidence**: [`server/middleware/auth.js:74-76`](../../server/middleware/auth.js).
Admin can opt into any tenant on read by appending `?organization=…`. There
is no log of this action.

**Fix**: log the `(adminUserId, requestedOrg, route, timestamp)` to
`AuditLog` whenever the override is exercised.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-19 · P2 — No app-layer HTTPS redirect / HSTS

**Evidence**: [`server/server.js`](../../server/server.js) does not redirect
HTTP → HTTPS or set HSTS explicitly. Render typically terminates TLS at the
edge and forwards plain HTTP to the app. If a misconfiguration exposes
plain HTTP, the app does not defend.

**Fix**: trust the proxy (`app.set('trust proxy', 1)`) and add a redirect
for `req.secure === false` plus an explicit `Strict-Transport-Security`
header (Helmet's default already includes HSTS but verify the parameters).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-20 · P2 — `DocsChatLog` and `AIUsage` retained indefinitely

**Evidence**: neither model has a TTL index nor a purge job
([`server/models/DocsChatLog.js`](../../server/models/DocsChatLog.js),
[`server/models/AIUsage.js`](../../server/models/AIUsage.js)).

**Fix**: implement a scheduled purge per the
[Records Retention Schedule](../legal/09-records-retention-schedule.md):
13 months for `DocsChatLog`, 7 years for `AIUsage` (financial audit
window).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-21 · P2 — No `JWT_SECRET` strength validation at boot

**Evidence**: `server.js` reads `process.env.JWT_SECRET` only when a token
is verified. If unset, the app starts and crashes at first login.

**Fix**: a boot-time check that throws if `JWT_SECRET` is unset or shorter
than 32 bytes (after base64-decode). Add a similar check for
`MONGODB_URI`.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-22 · P3 — Helmet defaults unverified

**Evidence**: [`server/server.js:20-25`](../../server/server.js).

**Fix**: explicitly set `frameguard`, `noSniff`, `referrerPolicy`,
`hsts.maxAge`. Document in
[Encryption & Key Management](04-encryption-and-key-management.md).

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-23 · P3 — No Sentry / structured logger

**Evidence**: only `console.log` / `console.error` are used; no
Sentry/Datadog wiring.

**Fix**: integrate Sentry on both server and client; configure data
scrubbers; wire to incident response channel.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-24 · P3 — `PORT` default

**Evidence**: [`server/server.js:112`](../../server/server.js)

```js
const PORT = process.env.PORT || 5000;
```

The expected dev port is 5001. The default produces a confusing port
mismatch with the frontend.

**Fix**: change the literal to `5001` to match dev expectations, or fail
fast if `PORT` is unset in production.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-25 · P3 — `react-data-grid@7.0.0-beta.59` pinned

**Evidence**: [`client/package.json`](../../client/package.json).

**Status**: accepted risk. The Export Center depends on its API. Bump
deliberately when 7.0.0 stable lands and regression-test all four
datasets.

---

### SEC-26 · P3 — `WeeklySummary` model unused

**Evidence**: [`server/models/WeeklySummary.js`](../../server/models/WeeklySummary.js)
has no controller/route reference.

**Fix**: remove the file, or document the future use.

**Owner**: `[FILL]` · **Target**: `[FILL]`

---

### SEC-27 · P3 — `Counter` collection retained but unused

**Evidence**: per
[`CLAUDE.md`](../../CLAUDE.md), the collection key
`enroll:{organization}:{IGCSE|CBSE}:{year}` is reserved. Status: accepted
risk; don't reuse the key.

---

## How to update this document

1. New finding → add a row to the summary table and a section below.
2. Resolved finding → set "Status: Resolved (commit `<sha>`, date)" and
   keep the row. Do not delete; auditors need history.
3. False positive → set "Status: Withdrawn (reason)". Keep the row.
4. Each calendar quarter, the security lead `[FILL]` walks the open list
   with engineering and updates owners + target dates.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Threat Model](12-threat-model.md)
- [SOC 2 / ISO 27001 Control Mapping](13-soc2-iso27001-control-mapping.md)
- [Vulnerability Management Policy](06-vulnerability-management-policy.md)
- [Vendor & Sub-processor Management](08-vendor-and-subprocessor-management.md)
