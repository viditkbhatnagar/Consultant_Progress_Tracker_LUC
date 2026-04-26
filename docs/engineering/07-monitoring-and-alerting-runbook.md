# Monitoring & Alerting Runbook

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Current state

The repo has **no application performance monitoring (APM), error tracking,
or structured logging library wired in**. Monitoring relies on:

| Surface | Source |
|---|---|
| Liveness | `GET /api/health` — public, returns `{ success: true }` |
| Docs RAG readiness | `GET /api/docs-chat/health` — public; returns 503 when `chunksLoaded === 0` |
| Application logs | Render's stdout/stderr capture (line-based, unstructured `console.log`) |
| Atlas metrics | MongoDB Atlas dashboard |
| AI cost | `AIUsage` collection + admin's "AI Usage" tab |

This is a P2 monitoring gap. See
[Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Health endpoints

| Endpoint | Auth | Use |
|---|---|---|
| `GET /api/health` | public | Render readiness/liveness probe |
| `GET /api/docs-chat/health` | public | Confirms Docs RAG in-memory index loaded |

Both are intentionally public so external probes can hit them without a
secret.

## Recommended baseline (planned)

| Concern | Tool | Action |
|---|---|---|
| Uptime | Render's built-in monitor or external (e.g., BetterUptime) | Hit `/api/health` every 60s; alert on 3 consecutive failures |
| Application errors | Sentry (recommended) | Wrap `errorHandler.js`; scrub PII before send |
| Performance | Sentry / Datadog APM | Trace slow Mongoose queries |
| Cost / usage | Internal | Alert when daily `AIUsage` cost > `[FILL: USD threshold]` |
| Database | Atlas alerts | Connections, replication lag, IOPS, disk |
| Docs RAG | `/api/docs-chat/health` external check | Alert on 503 sustained > 5 min |

## What to do when alerts fire

| Alert | Likely cause | First action |
|---|---|---|
| `/api/health` 502/timeout | App crashed or restarting | Render dashboard → Logs |
| `/api/docs-chat/health` 503 | Chunks failed to load | Force-reingest from admin Docs RAG dashboard |
| Atlas connection storm | Long-running queries / index miss | Atlas Performance Advisor; consider read-only replicas |
| AI cost spike | Abuse, runaway loop, or spam | Disable `OPENAI_API_KEY` temporarily; check `AIUsage` for top user |
| 5xx error rate > 1% | Recent deploy regression | Roll back last deploy (see [Deployment Runbook](04-deployment-runbook.md)) |

## Logging policy (proposed)

Until a structured logger is wired in, treat `console.log` output as
**not safe for PII**. The error handler at
[`server/middleware/errorHandler.js:6`](../../server/middleware/errorHandler.js)
prints the full Mongoose error stack — that may include doc fragments, query
filters with phone numbers, etc. Scrub before integrating with any external
log destination. Tracked as P1 in the
[Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Related documents

- [Deployment Runbook](04-deployment-runbook.md)
- [Logging & Audit Policy](../security/05-logging-and-audit-policy.md)
- [Incident Response Plan](../security/07-incident-response-plan.md)
