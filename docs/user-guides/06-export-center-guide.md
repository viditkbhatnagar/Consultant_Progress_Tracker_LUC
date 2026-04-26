# Export Center Guide

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

The Export Center (`/exports`) is the canonical place to download data
out of the Platform. It replaces the four scattered "Export" buttons
that used to live inside the dataset pages.

## Datasets

| Dataset | Roles allowed | Date field |
|---|---|---|
| Students | admin, team_lead (LUC own team), manager (cross-org carve-out), skillhub (own branch) | `closingDate` (LUC) / `createdAt` (Skillhub + `'all'`) |
| Commitments | admin, team_lead, skillhub | `commitmentDate` |
| Meetings | admin, team_lead | `meetingDate` |
| Hourly | admin, team_lead, skillhub | `date` |

## Modes

- **Raw** — table of rows, paginated server-side (5,000 / page),
  client-side capped at 100,000 total rows in a single download.
  The on-screen preview shows the first 10,000 rows with a banner
  ("Showing first 10,000 of N — download to see all").
- **Pivot** — choose row dimension, optional column dimension, measure,
  and aggregation (count / distinct / sum / avg / min / max).
  **Rate-limited to 5 requests / minute / user.**
- **Templates** — pre-built multi-sheet xlsx workbooks for common
  reports.
- **Saved templates** — your own pivot configurations, persisted on the
  server, up to 200 per user.

## How to download

1. `/exports` → pick a dataset.
2. Pick an org tab (the tabs you see depend on your role).
3. Set filters: date range, status, source, team, etc.
4. Choose Raw or Pivot mode.
5. Click **Download**. You get an xlsx.

## Business rules baked into the Center

- **LUC zero-fee row hide**. 626 importer-bug rows where
  `admissionFeePaid = 0` are hidden from every Students-LUC query.
  Documented in
  [`server/controllers/studentController.js`](../../server/controllers/studentController.js)
  and the [memory note](../legal/01-privacy-policy.md). Apply also when
  the org tab is `'all'`.
- **VAT disclaimer**. LUC sheets that surface `admissionFeePaid` (raw or
  pivot measure) get a row-1 note: `Note: Admission Fee Paid in LUC
  mixes net-of-VAT and gross-of-VAT entries (UAE VAT 5%). Treat sums as
  approximate.` Skillhub sheets do not get this disclaimer.
- **Skillhub `outstandingAmount`**. The Mongoose virtual is resolved at
  the aggregation level via `withSkillhubFinancials` so it is available
  in pivots.
- **Subjects pivot double-counting (Skillhub)**. Counting on `subjects`
  with `agg=count` post-`$unwind` counts subject-enrolments, not
  students. The UI shows a disclaimer; switch to `agg=distinct` for
  unique-student counts.

## Saved templates

- Name uniqueness: `(user, name)` is unique. Server returns 409 on
  duplicate.
- 200-template cap per user (server returns 429 over the cap).
- Owner-only edit and delete.

## Pre-built templates

The catalog is filtered by your role. Examples (LUC):

- "Source × Month — sum admissionFee"
- "Source — counts"
- "University × Programme — counts"
- "Campaign × Source — counts"

Skillhub templates focus on enrolment, EMI, and curriculum breakdowns.
Manager sees the Students-only template subset (cross-org allowed).

## Performance

- The pivot endpoint is rate-limited to 5 requests / minute / user.
- The raw endpoint is **not** rate-limited today (Gap Roadmap SEC-17).
  Please do not iterate the raw endpoint at high frequency; ask
  engineering to add a real backend job for any recurring need.
- Large pivots run server-side as a Mongo aggregation; a 200k-row
  Students pivot completes in seconds on the current cluster but expect
  a few seconds of latency.

## Storage and disposal

- Treat downloaded xlsx files as **Confidential** at minimum, and
  **Restricted** if they include Skillhub minors or financial data.
- Store on Learners Education-managed devices only.
- Delete when no longer needed.

## Common errors

| Error | Likely cause |
|---|---|
| `429 Too many requests` | You exceeded the 5/min pivot limit. Wait a minute. |
| `403` | Role / org allowlist mismatch. Confirm with admin. |
| `404` saved template | Template renamed or deleted. |
| Empty preview | Filters too narrow. |

## Related documents

- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
- [Role Permissions Matrix](05-role-permissions-matrix.md)
- [Data Classification & Handling](../security/03-data-classification-and-handling.md)
- [API Reference §Exports](../engineering/02-api-reference.md)
