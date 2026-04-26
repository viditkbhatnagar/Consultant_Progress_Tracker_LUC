# Build & Release Process

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Tooling

| Layer | Tool |
|---|---|
| Backend | Node.js (CommonJS), Express v5, Mongoose v9 |
| Frontend | CRA (`react-scripts 5.0.1`), React 19, MUI v7 |
| Concurrency in dev | `concurrently` (root devDependency) |
| Test (server) | Jest + supertest + mongodb-memory-server (Export Center suites only) |
| Test (client) | Jest + React Testing Library |
| Highlight pipeline | Python 3 (`server/scripts/generateHighlightedPdfs.py`) |

## Root scripts (`package.json`)

| Script | Effect |
|---|---|
| `npm run dev` | `concurrently` runs server (`:5001`) and client (`:3001`) |
| `npm run dev:server` | `cd server && npm run dev` (nodemon) |
| `npm run dev:client` | `cd client && npm start` (CRA dev server on `:3001`) |
| `npm run build` | `cd client && npm install && npm run build` — produces `client/build/` |
| `npm start` | `cd server && npm start` (used in production) |
| `npm run install:all` | Install root + server + client deps + pip install for highlight script |
| `npm run seed` | **DESTRUCTIVE** — `node server/scripts/seedDatabase.js` |
| `npm run ingest:docs` | Ingest program PDFs and regenerate highlight assets |
| `npm run ingest:docs:force` | Same with `--force` |
| `npm run highlight:docs` | Python script only |

## Server scripts

| Script | Effect |
|---|---|
| `npm start` | `node server.js` |
| `npm run dev` | `nodemon server.js` |
| `npm test` | `jest --testPathPattern=tests/exports` (Export Center only) |

## Client scripts

| Script | Effect |
|---|---|
| `npm start` | `PORT=3001 react-scripts start` |
| `npm run build` | `react-scripts build` (CRA production bundle) |
| `npm test` | `react-scripts test --watchAll=false` |

## Branching & PR workflow

The repo uses a trunk-based flow with feature branches.

| Branch type | Pattern | Merge target |
|---|---|---|
| Feature | `feat/<short-slug>` | `main` |
| Bug fix | `fix/<short-slug>` | `main` |
| Hotfix | `hotfix/<short-slug>` | `main` |
| Documentation | `docs/<short-slug>` | `main` |

PRs are reviewed by at least one engineer; CI runs server tests
(`server/tests/exports/`) and client tests (`client/src/**/__tests__/`).
There is no automated SAST/DAST today (gap, see
[Secure SDLC Policy](../security/09-secure-sdlc-policy.md)).

## Release tagging

Adopt **semantic versioning** with annotated tags:

```bash
git tag -a v1.4.0 -m "Release 1.4.0"
git push origin v1.4.0
```

Render auto-deploys from `main`; tags do not trigger a deploy but document
the version. Until a release-tagging convention is enforced (Phase 2), the
deployed version can be inferred from the latest commit on `main`.

## Pinned dependencies

| Package | Pin | Reason |
|---|---|---|
| `react-data-grid` | `7.0.0-beta.59` (no caret) | Beta releases iterate fast and have surprised CRA setups; bump deliberately and regression-test the Export Center |

## Test suites

- **Server** — 6 suites under `server/tests/exports/` covering the four
  pivot datasets and access control. Run via `cd server && npm test`.
- **Client** — 5 suites under `client/src/**/__tests__/` covering exports UI
  and the `xlsxBuilder` pure function. Run via `cd client && npm test`.

The repo has **no backend tests outside Export Center** — `npm test` in
`server/` is targeted. Tracked as a P2 coverage gap.

## Pre-commit safety

There is **no pre-commit hook** today (gap). Recommended additions tracked
in [Secure SDLC Policy](../security/09-secure-sdlc-policy.md):

- `husky` + `lint-staged` for ESLint and formatter
- `gitleaks` or similar for secret scanning
- `npm audit --omit=dev` gate

## Related documents

- [Deployment Runbook](04-deployment-runbook.md)
- [Developer Onboarding](09-developer-onboarding.md)
- [Secure SDLC Policy](../security/09-secure-sdlc-policy.md)
