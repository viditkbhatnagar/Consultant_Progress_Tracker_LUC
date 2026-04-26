# Environment Variables & Secrets

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Server (`server/.env`)

The file `server/.env` is **gitignored** ([.gitignore:14, 19](../../.gitignore))
and never committed. The committed sibling `server/.env.example` exists as a
template — see the warning at the bottom of this doc.

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `NODE_ENV` | `development` / `production` / `test` | Yes | `production` |
| `PORT` | Server port; defaults to **5000** in code if unset (gotcha — should be `5001`) | No | `5001` |
| `MONGODB_URI` | Atlas connection string (Ireland cluster, read-write) | Yes | `mongodb+srv://USER:PASSWORD@cluster/db` |
| `JWT_SECRET` | HMAC key for signing JWTs (HS256) | Yes | 32+ random bytes |
| `JWT_EXPIRE` | Access-token lifetime | Yes | `1h` |
| `JWT_REFRESH_EXPIRE` | Refresh-token lifetime; **no rotation flow exists**, this is reserved for future use | Yes | `7d` |
| `OPENAI_API_KEY` | OpenAI key — embeddings, dashboard analysis, Docs-RAG fallback | Recommended | `sk-…` |
| `GROQ_API_KEY` | Groq key — primary Docs-RAG LLM | No (falls back to OpenAI) | `gsk_…` |
| `GROQ_CHAT_MODEL` | Override Groq model | No | default `llama-3.3-70b-versatile` |

## Client (`client/.env`)

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `REACT_APP_API_URL` | Backend base URL | No (defaults sensibly) | dev: `http://localhost:5001/api`; prod: `/api` |

## Where each value comes from

| Variable | Source of truth | Owner |
|---|---|---|
| `MONGODB_URI` | Atlas dashboard → Connection string | DBA / engineering lead |
| `JWT_SECRET` | Generated locally with `openssl rand -base64 48` | Engineering lead |
| `JWT_EXPIRE` / `JWT_REFRESH_EXPIRE` | Engineering decision | Engineering lead |
| `OPENAI_API_KEY` | OpenAI dashboard | Engineering lead |
| `GROQ_API_KEY` | Groq console | Engineering lead |

## Secrets management policy

- **Production secrets** live in **Render's environment-variable panel**.
  Never commit them.
- **Local development** `server/.env` is gitignored.
- Rotate `JWT_SECRET` if you suspect a compromise; rotation invalidates **all
  active sessions** (no token-version field on `User`).
- Rotate `OPENAI_API_KEY` and `GROQ_API_KEY` quarterly or on staff change.
- Rotate `MONGODB_URI` (DB password) on offboarding any engineer with prior
  access.

## Boot-time validation

Mongoose connection failure exits the process at
[`server/config/db.js`](../../server/config/db.js). However, there is **no
explicit boot-time check** that `JWT_SECRET` is set or sufficiently strong;
the app will start, then crash on the first login attempt. Tracked as a P2
in the [Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Required at runtime

| Endpoint group | Hard-required env vars |
|---|---|
| `/api/auth/*` | `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE` |
| `/api/exports/*` | `MONGODB_URI` |
| `/api/ai/analysis` | `OPENAI_API_KEY` |
| `/api/chat/stream` | `OPENAI_API_KEY` |
| `/api/docs-chat` | At least one of `GROQ_API_KEY` or `OPENAI_API_KEY`; `OPENAI_API_KEY` for embeddings on ingest |
| `/api/health` | none |

## Warning: `server/.env.example`

The committed `server/.env.example` template ships with values that look
real (an apparently-real MongoDB connection string). Before using it as a
template:

1. Replace the hostname, username, password, and database name with
   placeholders such as `<USER>`, `<PASSWORD>`, `<HOST>`, `<DB>`.
2. Replace `JWT_SECRET=your-super-secret-jwt-key-change-in-production` with a
   placeholder; never ship a default.

This is tracked as a P0 in the
[Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md):
even if those credentials are no longer live, ANY hard-coded credential in a
public template undermines secrets discipline and triggers automated
secret-scanners.

## Related documents

- [Deployment Runbook](04-deployment-runbook.md)
- [Encryption & Key Management](../security/04-encryption-and-key-management.md)
- [Vendor & Sub-processor Management](../security/08-vendor-and-subprocessor-management.md)
