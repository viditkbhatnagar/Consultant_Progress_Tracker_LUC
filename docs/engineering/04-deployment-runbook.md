# Deployment Runbook

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Purpose

How to deploy, roll back, and operate Team Progress Tracker on Render
(Singapore) with MongoDB Atlas (Ireland). The repo does not contain
`render.yaml` or a Dockerfile — deployment is driven from Render's dashboard
plus the standard root scripts.

## Hosting

| Resource | Vendor | Region |
|---|---|---|
| Application service | Render | Singapore (`ap-southeast-1`) |
| Primary database | MongoDB Atlas | Ireland (`eu-west-1`) |
| LLM (primary) | Groq | US |
| LLM + embeddings (fallback / analysis) | OpenAI | US |

## Build & start commands (production)

| Step | Command | Working dir |
|---|---|---|
| Install | `npm run install:all` | repo root |
| Build | `npm run build` | repo root (runs `cd client && npm install && npm run build`) |
| Start | `npm start` | repo root (runs `cd server && npm start`) |
| Health probe | `GET /api/health` and `GET /api/docs-chat/health` | n/a |

In `NODE_ENV=production` Express serves the built React app and an SPA
catch-all
([`server/server.js:100-107`](../../server/server.js)). There is no
separate static host.

## Environment variables

The full inventory and threat model for secrets lives in
[Environment & Secrets](05-environment-and-secrets.md). At deploy time
ensure these are set on the Render service:

`PORT`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`,
`JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, `OPENAI_API_KEY`, `GROQ_API_KEY`
(optional), `GROQ_CHAT_MODEL` (optional).

## Deploy procedure

1. Merge the change to `main` via PR with green checks.
2. On Render dashboard, the service auto-deploys from `main` (or trigger
   "Manual deploy" → "Deploy latest commit").
3. Watch the build log; build is `npm run install:all && npm run build`.
4. Service should boot with `Server running in production mode on port …`
   and `Docs RAG: loaded N chunks (M questions in exact-match index) in Xms`
   ([`server/server.js:114-133`](../../server/server.js)).
5. Smoke test: `curl https://<host>/api/health` returns
   `{"success":true,"message":"Server is running"}`.
6. Smoke test Docs RAG readiness:
   `curl https://<host>/api/docs-chat/health` returns 200 (not 503).
7. Open the app, log in as a test admin, run one query in the chat drawer
   and verify a source chip is returned (Docs RAG sanity).

## Rollback

Render keeps prior deploys. To roll back:

1. Render dashboard → service → "Deploys" tab → select the last known-good
   deploy → "Redeploy".
2. If the rollback target predates a Mongo schema migration:
   - Read the affected migration script in
     [`server/scripts/`](../../server/scripts/) to confirm direction
     (forward-only? idempotent?).
   - `migrateOrganization.js` and `backfillCommitmentDate.js` are
     idempotent and **forward-compatible** with older code; safe to leave.
   - For destructive migrations, contact the engineering lead before
     rollback.
3. Smoke test as above.
4. Document the rollback in the incident log
   (see [Incident Response Plan](../security/07-incident-response-plan.md)).

## Database migrations

There are two production-safe scripts:

- [`server/scripts/migrateOrganization.js`](../../server/scripts/migrateOrganization.js)
  — backfills `organization: 'luc'` on pre-existing docs lacking the field.
  Idempotent.
- [`server/scripts/backfillCommitmentDate.js`](../../server/scripts/backfillCommitmentDate.js)
  — sets `commitmentDate = weekStartDate` on legacy Commitment rows.
  Idempotent.

Run from a workstation with `MONGODB_URI` set to the production cluster
connection string (read-write):

```bash
cd server
node scripts/migrateOrganization.js
node scripts/backfillCommitmentDate.js
```

> Run during a low-traffic window. Each script logs `<n> updated, <m>
> already correct`. Re-running has no effect on already-migrated rows.

## Seeding (non-production)

`npm run seed` (root) wipes and reseeds the database. **Do not run against
production.** It writes credentials to `LOGIN_CREDENTIALS.md` (which is
gitignored).

For Skillhub-only non-destructive bootstrap there is
[`server/scripts/seedSkillhub.js`](../../server/scripts/seedSkillhub.js) —
documented as production-safe by the comment block.

## Docs RAG ingest

When a new program PDF is added to `client/public/program-docs/<slug>/`:

1. Extend `PROGRAMS` in
   [`server/models/DocChunk.js`](../../server/models/DocChunk.js).
2. Extend `DOC_TYPE_MAP` in
   [`server/scripts/ingestProgramDocs.js`](../../server/scripts/ingestProgramDocs.js).
3. Run `npm run ingest:docs:force` from the repo root. This re-ingests and
   regenerates highlighted PDFs (Python script).
4. Deploy the change. After deploy, an admin clicks "Force re-ingest" in the
   admin Docs-RAG dashboard, or a maintainer hits
   `POST /api/docs-chat/admin/reingest?force=true`.

## Common issues

| Symptom | Likely cause | Action |
|---|---|---|
| `/api/health` returns 502 | App didn't start | Render logs; check `MONGODB_URI` |
| `/api/docs-chat/health` returns 503 | Chunks not loaded | Force-reingest; check `OPENAI_API_KEY` for embedding generation |
| Login returns 500 with "JWT_SECRET" in stack | `JWT_SECRET` missing | Set env var on Render and redeploy |
| Mongo connect timeout | Render IP not allowlisted in Atlas | Add Render egress IP range to Atlas Network Access |
| Memory spike in production | DocChunk index loaded into memory at boot | Verify chunk count; consider scaling instance |

## Related documents

- [Environment & Secrets](05-environment-and-secrets.md)
- [Build & Release Process](06-build-and-release-process.md)
- [Backup & Disaster Recovery](../security/10-backup-and-disaster-recovery.md)
- [Incident Response Plan](../security/07-incident-response-plan.md)
- [Monitoring & Alerting Runbook](07-monitoring-and-alerting-runbook.md)
