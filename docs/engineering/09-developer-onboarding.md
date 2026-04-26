# Developer Onboarding

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

Welcome. This is the fastest path from a fresh laptop to a working dev
environment.

## Prerequisites

- Node.js LTS (≥ 20 — `react-scripts 5.0.1` is OK on 20+)
- npm
- Python 3 with `pip` (only required to regenerate Docs RAG highlight PDFs)
- A read-write Atlas connection string (Ireland cluster). Ask the
  engineering lead.
- Access to the Render dashboard (read-only is fine for onboarding).
- Access to Groq + OpenAI accounts if you'll touch AI code.

## Get the code

```bash
git clone https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC.git
cd teamProgressTracker
npm run install:all
```

`install:all` installs root, `server/`, and `client/` deps and runs
`pip install -r server/requirements.txt`. The `pip` step is best-effort; if it
fails you can still run the app, but you can't regenerate highlight PDFs.

## Configure environment

Create `server/.env`. The committed `server/.env.example` is a template;
**replace any apparently-real credentials before reusing**.

Minimum env for dev:

```dotenv
NODE_ENV=development
PORT=5001
MONGODB_URI="mongodb+srv://USER:PASSWORD@HOST/DB"
JWT_SECRET="<32-byte random string>"
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

Generate a JWT secret:

```bash
openssl rand -base64 48
```

The frontend default API URL is `http://localhost:5001/api`. Override with
`client/.env` if needed:

```dotenv
REACT_APP_API_URL=http://localhost:5001/api
```

## Seed the dev database

```bash
npm run seed
```

This **wipes** the database and creates LUC admin + 9 team leads + LUC
consultants + 2 Skillhub branch logins
(`training@skillhub.com`, `institute@skillhub.com`) + 4 Skillhub counselors.
Credentials are written to `LOGIN_CREDENTIALS.md` (gitignored).

Never run `npm run seed` against production. Never check
`LOGIN_CREDENTIALS.md` into git.

## Run the app

```bash
npm run dev
```

This boots:

- API on `http://localhost:5001`
- React on `http://localhost:3001`

> Ports: server is **5001**, client is **3001** (not 3000). If your `.env` is
> missing `PORT`, the server falls back to **5000** — the client won't reach
> it.

## Tour the codebase

| Area | Start here |
|---|---|
| Architecture | [`docs/engineering/01-architecture-overview.md`](01-architecture-overview.md) |
| Routes & controllers | `server/server.js` → `server/routes/*` → `server/controllers/*` |
| Multi-tenancy | [`server/middleware/auth.js`](../../server/middleware/auth.js), [`server/config/organizations.js`](../../server/config/organizations.js) |
| Models | [`server/models/`](../../server/models/) (also see [Data Dictionary](03-data-dictionary.md)) |
| Frontend pages | [`client/src/pages/`](../../client/src/pages/) |
| Frontend services | [`client/src/services/`](../../client/src/services/) |
| Theme | [`client/src/theme.js`](../../client/src/theme.js) |
| Constants | [`client/src/utils/constants.js`](../../client/src/utils/constants.js) |
| Existing onboarding | [`CLAUDE.md`](../../CLAUDE.md) |

## Tests

```bash
# Server (Export Center suites only)
cd server && npm test

# Client (CRA + Jest)
cd client && npm test
```

There are **no backend tests outside `server/tests/exports/`**. Do not break
those — the 66-row anonymized fixture at
`server/tests/exports/fixtures/students_2026-04-22.json` codifies the
reference-workbook pivots.

## Conventions

- CommonJS on the backend (`require`, `module.exports`).
- Controllers use raw `try/catch` with `next(error)` — no `asyncHandler`.
- Validation is **manual** in controllers; `express-validator` is installed
  but unused.
- Frontend Axios services attach the auth token via interceptors.
- Avoid mocking the database in tests where possible — the Export Center
  suites use `mongodb-memory-server`.
- Keep CSP off only as long as CRA's inline-style story persists; document
  any change in the Gap Roadmap.

## What to read before your first PR

1. [`CLAUDE.md`](../../CLAUDE.md) — terse architectural truths.
2. [Threat Model](../security/12-threat-model.md) — what not to break.
3. [Access Control Policy](../security/02-access-control-policy.md) — what
   `protect`, `authorize`, `buildScopeFilter`, and `canAccessDoc` mean.
4. [Data Dictionary](03-data-dictionary.md) — every field and its
   classification.

## Help

- Slack/Teams: `[FILL: channel]`
- On-call: `[FILL: rotation]`
- Repo issues: `https://github.com/viditkbhatnagar/Consultant_Progress_Tracker_LUC/issues`
