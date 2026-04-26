# Secure SDLC Policy

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Purpose

Define how security is woven through the development lifecycle — from
ticket grooming through deploy and post-deploy verification.

## Branching & PR

- Default branch: `main`. Direct commits prohibited.
- Working branches: `feat/`, `fix/`, `hotfix/`, `docs/`.
- Every change merged to `main` arrives via Pull Request, reviewed by at
  least one engineer (recommended: a second reviewer for any change
  touching `server/middleware/auth.js`,
  `server/controllers/exportController.js`, or any payment-adjacent code).
- Force-push to `main` is forbidden. Rewriting history of an open PR is
  allowed; rewriting history of a merged commit is not.

## Required PR checklist

Every PR must answer:

1. What does this change do, and why?
2. What data does it touch? (Public / Internal / Confidential / Restricted)
3. Does it change auth, scoping, or input validation? If yes, request a
   second reviewer.
4. Does it add a dependency? Note license + security profile.
5. Does it require an env-var change? Update
   [Environment & Secrets](../engineering/05-environment-and-secrets.md).
6. Does it require a data migration? Add a migration script under
   `server/scripts/` and document in
   [Database & Migrations](../engineering/08-database-and-migrations.md).
7. Tests added or updated? Server tests under `server/tests/exports/`
   (existing suite is Export-Center-only); client tests under
   `client/src/**/__tests__/`.

## Tests

- **Server**: Jest + supertest + mongodb-memory-server. Currently scoped
  to Export Center (`server/tests/exports/`). Expanding coverage is a P2
  in the [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).
- **Client**: Jest + React Testing Library. Five suites today.

## Static analysis

- ESLint runs in CRA's build pipeline for the client.
- The server has **no linter** today. Recommended: ESLint + Prettier
  alignment.

## Pre-commit hooks (recommended, not yet enforced)

- `husky` + `lint-staged` for ESLint + Prettier.
- `gitleaks` for secret detection. Tied to SEC-04.
- Conventional-commits formatting check.

## Dependency management

- `npm audit --omit=dev` weekly on server + client (gap; not on CI yet).
- Dependabot security updates enabled `[FILL]`.
- Pinned beta: `react-data-grid@7.0.0-beta.59` — bump deliberately and
  regression-test the Export Center.

## Deploy

- Render auto-deploys from `main`. There is no staging environment by
  default `[FILL: confirm]`. A staging branch / Render service is a
  recommended P2.

## Post-deploy verification

For each deploy:

1. Smoke test the health endpoint and Docs RAG readiness.
2. Open the app, log in, run one query in the chat drawer, confirm a
   source chip is returned.
3. For schema-touching deploys, run the corresponding migration script
   from a controlled workstation.

## Supply chain

- Pinned versions in `package-lock.json` (committed). Do not delete
  package-locks.
- For each new direct dependency, the author records: license,
  maintenance signal (last release < 12 months), and security profile
  (CVEs in last 24 months).

## Threat-modelling cadence

- New surfaces (e.g., a new dataset in Export Center, a new AI feature)
  trigger a STRIDE walk before merge.
- Annual whole-system threat model walked through by the security lead;
  updates [Threat Model](12-threat-model.md).

## Definition of done (security checklist)

A change is "done" when:

- Code merged.
- Tests added/updated.
- Docs updated (this set is the canonical reference).
- Gap roadmap updated if a known finding is closed.
- Production smoke test passed.

## Related documents

- [Vulnerability Management Policy](06-vulnerability-management-policy.md)
- [Threat Model](12-threat-model.md)
- [Build & Release Process](../engineering/06-build-and-release-process.md)
