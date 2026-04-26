# Threat Model

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]`

## Method

STRIDE applied to the major surfaces of the Team Progress Tracker. Each
surface lists the threats considered, what is in place today, and the
residual risk. Findings flow into the
[Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).

## Surface 1 — Authentication & session

### Assets

JWT, password hash, session continuity, account state.

| Threat | In place | Residual risk |
|---|---|---|
| Spoofing — credential stuffing | bcrypt salt 10 ([User.js:80-82](../../server/models/User.js)) | **High** — no rate limit on login (SEC-03), no MFA (SEC-07), weak password policy (SEC-08) |
| Tampering — token forgery | HS256 with `JWT_SECRET` | Medium — depends on `JWT_SECRET` strength (SEC-21) |
| Repudiation — disowning an action | `createdBy` / `lastUpdatedBy` on key models | Medium — no `deletedBy` (SEC-16) |
| Information disclosure — token in storage | localStorage holds JWT + user object | **High** — XSS would exfiltrate token (SEC-14); CSP off (SEC-06) |
| DoS — credential brute-force | None | **High** — login is unrated (SEC-03) |
| Elevation — privilege escalation | `protect` + `authorize` ([auth.js:53-63](../../server/middleware/auth.js)) | Low — gates correctly applied; verified |

## Surface 2 — Multi-tenancy boundary

### Assets

Per-tenant data isolation; LUC vs Skillhub Training vs Skillhub Institute.

| Threat | In place | Residual risk |
|---|---|---|
| Cross-tenant read | `buildScopeFilter` + `canAccessDoc` | Low — the primitives are correct; verified by code path |
| Admin org bypass abuse | `?organization=…` query param | Medium — bypass works as designed but is **not logged** (SEC-18) |
| Skillhub branch leak (training ↔ institute) | `teamLead` filter on skillhub role | Low |
| Manager cross-org carve-out misuse | `assertDatasetAccess` allows `'all'` only on Students dataset | Low — verified by tests |

## Surface 3 — AI / LLM data exfiltration

### Assets

Personal data in tool results sent to OpenAI/Groq.

| Threat | In place | Residual risk |
|---|---|---|
| Personal data — including minors' — sent to US LLMs | Compact projection on tool results (no passwords sent) | **High** — names, phones, emails of minors and parents do flow (SEC-13); DPAs not confirmed (SEC-05) |
| Prompt-injection from cached PDF content | None observed; chunks come from owned PDFs | Low — chunks are vetted before ingest |
| Model output containing other tenants' data | Strong scoping in tool implementations | Low |
| Cost-spike attack via repeated queries | `QueryCache` 24h, but no rate limit on `/chat/*` or `/docs-chat` | Medium (SEC-17) |
| Vendor breach exposing logs | Unknown until DPAs reviewed | High pending SEC-05 |

## Surface 4 — Export Center

### Assets

Bulk personal data, financial records.

| Threat | In place | Residual risk |
|---|---|---|
| Data ex-export by privileged user | `assertDatasetAccess` per role; rate limit on pivot/template (5/min) | Medium — `/raw` is unrated; large dumps possible (SEC-17) |
| Pivot DoS via expensive aggregation | 5/min limiter | Low |
| Sensitive column re-identification | LUC zero-fee filter, VAT disclaimer | Low — known business rule, documented |
| Saved-template injection | `(user, name)` unique; 200-cap | Low |

## Surface 5 — Static auth-gated PDFs

### Assets

16 LUC program PDFs, highlight assets, snippets.

| Threat | In place | Residual risk |
|---|---|---|
| Unauthenticated download | `protect` + `orgGate('luc')` ([server.js:52-89](../../server/server.js)) | Low |
| Cross-tenant download | `orgGate('luc')` blocks Skillhub | Low |
| Token-in-URL leak | Auth via header/blob URL pattern in client | Low — no token in query strings observed |

## Surface 6 — Database

### Assets

All collections.

| Threat | In place | Residual risk |
|---|---|---|
| NoSQL injection via raw `$regex` | Reproduced at meetingController.js:95 | **High** (SEC-01) |
| NoSQL injection via operator smuggling (`$gt`, `$ne` in body) | None | Medium — controllers don't strip operators from `req.body` |
| Connection-string leak | `MONGODB_URI` in env; not in code | Medium — `.env.example` carries apparently-real string (SEC-04) |
| Mass-export at the DB | Atlas access controls | Low — small operator pool |

## Surface 7 — Render runtime / supply chain

### Assets

Application binary, env-secrets, build pipeline.

| Threat | In place | Residual risk |
|---|---|---|
| Compromised dependency | `package-lock.json` committed; no scanner on CI | Medium |
| Compromised build | None | Medium — no signed builds |
| Render account compromise | Render's MFA + RBAC `[FILL: confirm enforced]` | Out of scope for this doc |
| Pinned beta `react-data-grid` | Accepted risk (SEC-25) | Low |

## Surface 8 — Children's data (Skillhub)

### Assets

Personal data of minors and their parents.

| Threat | In place | Residual risk |
|---|---|---|
| Counselor over-collection | UI fields are required by schema; no minimisation | Medium |
| Disclosure to AI vendor without consent | See SEC-13 | **High** until DPAs + redaction in place |
| Lack of parental consent record | Paper / e-sign form `[FILL]`; not yet linked to a DB row | Medium — recommend a `consentSignedAt` field |
| Child-rights request handling (PDPL/GDPR) | Manual via DPO; no automation | Medium |

## Risk register summary

| Surface | Top residual risk | Owner |
|---|---|---|
| Auth & session | Login brute-force (SEC-03) | Engineering lead |
| AI / LLM | Personal data to LLMs (SEC-05, SEC-13) | DPO |
| Database | NoSQL regex injection (SEC-01) | Engineering lead |
| Children's data | Lack of formal consent record + AI exposure | DPO |

The full open list (priorities, owners, target dates) is the
[Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).

## Next walk-through

Annually or on any of:

- New dataset in Export Center.
- New AI feature.
- New role or permission in `User.role`.
- New sub-processor.
- Material change in Atlas / Render setup.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Access Control Policy](02-access-control-policy.md)
- [SOC 2 / ISO 27001 Control Mapping](13-soc2-iso27001-control-mapping.md)
- [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md)
