# Sales Tracker — Platform Handover

**Prepared:** 5 September 2026
**Repository:** <https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC> (private)
**Production:** Render web service, auto-deployed from `main`

This is the complete handover pack for the Sales Tracker platform (internally: *Team Progress
Tracker*). It is written for an engineer with **zero prior context** — everything needed to run,
deploy, maintain and extend the system without being able to ask the original developer.

---

## Your request, mapped to documents

The handover request asked for ten specific things. Each maps to exactly one document:

| # | Requested | Document |
|---|---|---|
| 1 | System architecture and design | [01 — System Architecture](01-system-architecture.md) |
| 2 | Application workflow and key functionalities | [02 — Application Workflows](02-application-workflows.md) |
| 3 | Database schema and configuration | [03 — Database Schema](03-database-schema.md) |
| 4 | Deployment, hosting, and infrastructure details | [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) |
| 5 | Environment setup and installation instructions | [05 — Environment Setup](05-environment-setup.md) |
| 6 | API documentation and third-party integrations | [06 — API Reference](06-api-reference.md) + [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) |
| 7 | User roles and permissions | [07 — Roles & Permissions](07-roles-and-permissions.md) |
| 8 | Dependencies and external services | [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) |
| 9 | Maintenance procedures, backup, and recovery | [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) |
| 10 | Known issues, limitations, pending enhancements | [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) |
| + | Credentials and access details | [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) |

**On credentials:** document 11 is a complete *inventory* — every secret, what it protects, where it
lives and who owns it — but deliberately contains **no secret values**. Secrets transfer through a
secure channel, and because the outgoing developer is leaving they should be **rotated rather than
transferred**. Document 11 contains the rotation runbook. This matches the request's own note that
"sensitive credentials may be shared through a secure channel if appropriate."

---

## What the platform is

A multi-tenant MERN application used by **Learners Education (UAE)** to track sales performance,
student admissions and teaching operations across two business units:

- **LUC** — the education consultancy. 9 sales teams, each with a team lead and consultants.
- **Skillhub** — a coaching institute, split into two branches: **Training** and **Institute**.

It is a genuine production system: ~394 commits over 10 months, real daily users, real revenue data.

### Scale

| | |
|---|---|
| Server | ~168 JS files, ~30,000 lines (Express 5 + Mongoose 9, CommonJS) |
| Client | ~200 JS files, ~51,000 lines (React 19 + MUI 7, Create React App) |
| Database | MongoDB Atlas — 27 collections |
| API | 19 route groups under `/api` |
| Roles | 4 (`admin`, `team_lead`, `manager`, `skillhub`) |
| Organisations | 3 (`luc`, `skillhub_training`, `skillhub_institute`) |

### Major features

Commitment/Demo Tracker · Student Database · Meeting Tracker · Hourly Activity Tracker ·
Skillhub Institute (teachers, timetable, attendance, tests, reports) · Leadership & Executive
Overview dashboards · Tier Fight (gamified team competition) · Export Center · AI analysis ·
Docs RAG chatbot · Payment plans · Announcements · In-app notifications

---

## Suggested reading order

**Day 1 — get it running**
1. This document
2. [05 — Environment Setup](05-environment-setup.md) — get it running locally
3. [01 — System Architecture](01-system-architecture.md) — the mental model

**Day 2 — understand it**
4. [03 — Database Schema](03-database-schema.md) — the data model *is* the domain model
5. [07 — Roles & Permissions](07-roles-and-permissions.md) — multi-tenancy shapes everything
6. [02 — Application Workflows](02-application-workflows.md) — feature-by-feature tour

**Day 3 — take ownership**
7. [11 — Credentials & Access](11-credentials-and-access-handover.md) — **start the rotation**
8. [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) — do a test deploy
9. [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) — verify a backup exists
10. [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — what you are inheriting

Reference as needed: [06 — API Reference](06-api-reference.md),
[08 — Dependencies & Integrations](08-dependencies-and-integrations.md)

---

## Five things to know before you touch anything

These are the non-obvious traps. Each has caused a real production issue.

### 1. The database cluster is named "dev" but it **is** production
The Atlas cluster host is `dev.gdddmth.mongodb.net`. There is **no separate development database**.
Local development, one-off scripts and the live site all point at the same data. Treat every local
run as a production operation. → [03 §Configuration](03-database-schema.md)

### 2. `npm run seed` destroys data
It wipes and recreates users and consultants. Combined with point 1, running it "to try things out"
would damage live data. → [05](05-environment-setup.md)

### 3. Conditional `required` fields silently pass on update
`Student.js` marks fields required only for a given organisation. Mongoose runs
`findByIdAndUpdate` validators in *query* context, so `this.organization` is `undefined` and the rule
never fires. Controllers must re-check in JavaScript. This has produced real bugs.
→ [03](03-database-schema.md)

### 4. Ports are 3001 and 5001, not 3000 and 5000
And if `server/.env` is missing, the server silently falls back to port **5000**, which the client is
not configured to reach. → [05](05-environment-setup.md)

### 5. `npm test` does not run all the tests
The server's test script filters to four directories. Other suites exist and are **not** run — one
of them contains a genuine, long-standing failure. → [10](10-known-issues-and-roadmap.md)

---

## Honest assessment of what you are inheriting

Stated plainly, because discovering it later is worse.

**Strengths**
- Consistent, readable architecture; conventions are followed throughout
- Meaningful test coverage on the highest-risk areas (exports, meetings, institute, commitments)
- Nightly automated database backups to S3
- Multi-tenancy enforced server-side, not just hidden in the UI

**Gaps**
- No CI/CD pipeline — deployment is a direct push to `main` with no automated gate
- No staging environment, and no separate dev database
- No error tracking, APM or uptime alerting; production monitoring is console logs on Render
- Infrastructure configuration exists **only** in the Render dashboard — no `render.yaml`
- Test coverage is partial and the default test command hides some suites
- Some known data-quality issues (duplicate student records, a few malformed dates)

Document [10](10-known-issues-and-roadmap.md) ends with a prioritised "first 30 days" list that
addresses these in order of risk.

---

## Also in this pack

Alongside these handover documents, the repository carries an earlier documentation set at `docs/`:

| Folder | Contents | Status |
|---|---|---|
| `docs/engineering/` | Architecture, API, data dictionary, runbooks (9 docs) | ⚠️ Last updated 2026-04-26 — **207 commits stale** |
| `docs/security/` | Security policies, threat model, control mapping (15 docs) | Largely policy — still broadly valid |
| `docs/legal/` | Privacy policy, ToS, DPA, retention schedule (10 docs) | Largely valid |
| `docs/user-guides/` | Per-role end-user manuals (7 docs) | Mostly valid; predates newer features |

**Where the two disagree, trust this handover pack** — it was written against the current code. The
older engineering docs predate roughly nine months of feature work (the entire Skillhub Institute
module, Tier Fight, payment plans, announcements and more), and its data dictionary is missing 9 of
the 27 models.
