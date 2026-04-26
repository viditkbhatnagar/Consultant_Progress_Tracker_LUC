# Encryption & Key Management

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## In transit

| Hop | Protocol | Termination | Notes |
|---|---|---|---|
| Browser → Render | TLS 1.2+ | Render edge (Singapore) | Render-managed certificate; HSTS via Helmet defaults (SEC-22 verify) |
| Render → Atlas | TLS 1.2+ | Atlas (Ireland) | Driver-default in `mongoose` |
| Render → OpenAI | TLS 1.2+ | api.openai.com | Shared keep-alive `https.Agent` ([`docsRagService.js`](../../server/services/docsRagService.js)) |
| Render → Groq | TLS 1.2+ | api.groq.com | Same agent |

There is **no app-layer HTTPS redirect** (SEC-19). Render's edge typically
enforces HTTPS, but the app itself doesn't.

## At rest

| Surface | Mechanism | Owner |
|---|---|---|
| Atlas database | Atlas-managed at-rest encryption (cluster-tier dependent) | DBA — confirm tier in Atlas dashboard and record `[FILL]` |
| Atlas backups | Atlas-managed | DBA |
| Render runtime filesystem | Render-managed (ephemeral) | Render |
| Application secrets in Render env | Render-managed | Render |
| Application secrets in `server/.env` (dev) | Filesystem permissions on developer laptop | Developer (FDE assumed) |

There is **no field-level encryption** of Restricted data in Mongo.
Mongoose plugin options (e.g., `mongoose-encryption`) have not been
adopted. Recommended for Skillhub student contact fields and parent
contacts post-MFA — tracked in the
[Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).

## Cryptographic primitives in use

| Use | Algorithm | Source |
|---|---|---|
| Password hashing | bcryptjs salt 10 | [`server/models/User.js:80-82`](../../server/models/User.js) |
| JWT signing | HS256 (`jsonwebtoken`) | [`server/models/User.js:85-89`](../../server/models/User.js) |
| Embeddings (Docs RAG) | OpenAI `text-embedding-3-small` | [`server/services/docsRagService.js`](../../server/services/docsRagService.js) — vectors are not crypto, but they leave the cluster |
| Cache key | SHA-1 of normalised query + program filter | [`server/models/QueryCache.js`](../../server/models/QueryCache.js) — hashing only, not authentication |

## Key management

| Key | Storage | Rotation | Owner |
|---|---|---|---|
| `JWT_SECRET` | Render env (prod), `server/.env` (dev) | On compromise; quarterly cadence proposed | Engineering lead |
| `MONGODB_URI` (DB password) | Render env | On engineer offboarding; quarterly cadence | Engineering lead + DBA |
| `OPENAI_API_KEY` | Render env | Quarterly | Engineering lead |
| `GROQ_API_KEY` | Render env | Quarterly | Engineering lead |
| TLS certs | Render-managed | Render-managed | Render |

There is **no formal key inventory** today. Recommended action: a one-pager
listing each key, its scope, last rotation date, and next-rotation-due
date, owned by the security lead `[FILL]`.

## Boot-time validation

- `MONGODB_URI` — connection failure exits the process (good).
- `JWT_SECRET` — **not validated at boot** (SEC-21). Add a check that
  `process.env.JWT_SECRET.length >= 32` before `app.listen`.

## Hash & token life

| Token | Algorithm | Lifetime | Carrier |
|---|---|---|---|
| Access JWT | HS256 | `process.env.JWT_EXPIRE` (default `1h`) | `Authorization: Bearer …` |
| Refresh JWT | HS256 | `process.env.JWT_REFRESH_EXPIRE` (default `7d`) | **Reserved** — no rotation flow today |
| Password reset | n/a | n/a | Not implemented (SEC-09) |
| Session cookie | n/a | n/a | Not used (cookies are not set anywhere) |

## What we do not do

- No bring-your-own-key (BYOK) for Atlas at-rest encryption.
- No HSM-backed key store.
- No client-side encryption of payload before TLS.
- No MFA seed encryption (no MFA yet — SEC-07).

## Change procedure

When rotating any key:

1. Generate the new key (e.g., `openssl rand -base64 48` for `JWT_SECRET`).
2. Update Render env on the production service. Render redeploys.
3. Verify with a production smoke test (login + one authenticated request).
4. Revoke / delete the old key from the vendor dashboard (OpenAI / Groq /
   Atlas user) where applicable.
5. Update the (proposed) key inventory.
6. For `JWT_SECRET`: all active sessions are immediately invalidated.
   Notify staff via the usual channel.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Environment & Secrets](../engineering/05-environment-and-secrets.md)
- [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md)
