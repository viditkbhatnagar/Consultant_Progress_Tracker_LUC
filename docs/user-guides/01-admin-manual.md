# Admin Manual

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

This guide is for the **Admin** role: cross-org operator who can read and
manage everything in the Team Progress Tracker. With great power, etc.

## What admins can do

| Capability | Where |
|---|---|
| See LUC and both Skillhub branches | `/admin/dashboard` (top-level org tabs) |
| Create / edit / deactivate users | `/admin/dashboard` → User Management |
| Create / edit / soft-delete consultants | `/admin/dashboard` → Consultant Management |
| View all commitments / students / meetings / hourly across orgs | the respective pages, with org tabs |
| Export across all orgs (and `'all'` on Students) | `/exports` |
| Run AI dashboard analysis | `/admin/dashboard` (AI Insights tab) |
| Force-reingest Docs RAG corpus | `/admin/dashboard` → AI Usage → Docs RAG |
| View AI cost & token usage | `/admin/dashboard` → AI Usage |
| Switch tenant on read | top-of-page org selector or `?organization=` query param |

## Daily flow (recommended)

1. Open `/admin/dashboard`. Glance at:
   - Overall commitment status for the current week.
   - Consultant performance leaderboard.
   - AI cost vs daily budget.
2. Switch to Skillhub tab if you also oversee Skillhub branches.
3. Open Notification Bell — clear anything actionable.
4. If there are P0/P1 items in the
   [Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md),
   coordinate with engineering.

[SCREENSHOT: admin dashboard with org tabs]

## Creating a user

1. `/admin/dashboard` → User Management → "Create User".
2. Fill in name, email, role, organization, team.
3. Set a strong temporary password (≥ 12 chars).
4. Hand it to the user via a secure channel; ask them to change on first
   login.
5. Confirm `isActive: true`.

For a Skillhub branch login, set role = `skillhub` and organization =
`skillhub_training` or `skillhub_institute`. Note that current Skillhub
branch logins are **shared** by branch staff; that is an accepted
business risk pending MFA rollout.

## Soft-deleting a user

User → "Deactivate" toggles `isActive: false`. Login is rejected
immediately, but any outstanding JWT is valid until expiry (default 1
hour). For sensitive offboarding, ask engineering to rotate
`JWT_SECRET` to invalidate all active tokens.

## Cross-org export

`/exports` lets admin pick **any** dataset and **any** org tab including
`'all'`. The Export Center applies the LUC zero-fee filter automatically
on Students and adds the VAT disclaimer to LUC sheets that include
`admissionFeePaid`. See [Export Center Guide](06-export-center-guide.md).

## Force-reingest Docs RAG

Use after adding or editing a programme PDF:

1. `npm run ingest:docs:force` from a workstation (regenerates chunks
   and highlight assets).
2. Push and deploy.
3. `/admin/dashboard` → AI Usage → Docs RAG → "Force re-ingest".
4. Confirm `Chunks: …` updates to the new count.

## Admin org-bypass on read

Append `?organization=skillhub_training` to a list URL to view that
tenant's data. **This bypass is not currently logged** (Gap Roadmap
SEC-18). Until it is, use the in-app tabs where possible so your action
is traceable in usage telemetry.

## Things admins should not do

- Edit `createdBy` / `lastUpdatedBy` fields by hand on the database.
- Use `npm run seed` against production (it wipes the database).
- Paste user emails or student data into external AI tools.
- Delete a user in the database directly — always use soft-delete via
  the UI.

## Related documents

- [Access Control Policy](../security/02-access-control-policy.md)
- [Export Center Guide](06-export-center-guide.md)
- [Chat & Docs RAG Guide](07-chat-and-docs-rag-guide.md)
- [Information Security Policy](../security/01-information-security-policy.md)
