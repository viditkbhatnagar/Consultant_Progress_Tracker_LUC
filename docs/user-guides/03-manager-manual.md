# Manager Manual

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

The **Manager** role is intentionally narrow. You can read student
records and download student exports across organisations, but you do
not edit, do not see consultants or commitments, and do not have a
dashboard.

## What you can do

| Capability | Where |
|---|---|
| Browse all LUC students (read-only) | `/student-database` |
| Browse Skillhub students via the Export Center's cross-org carve-out | `/exports` → Students dataset → org tab `'luc'`, `'skillhub_training'`, `'skillhub_institute'`, or `'all'` |
| Download student exports | same |

## What you cannot do

- Create / edit / delete any record.
- See commitments, meetings, hourly activity, or AI insights.
- Use the chat drawer in the same way the other roles do — your role
  does not include AI features.
- Export anything other than the Students dataset.
- Pick `'all'` org on any other dataset.

## Why the carve-out

The standard rule is "non-admins are pinned to their own organisation".
The single exception for the Manager role is the Students dataset in the
Export Center, where you can pick any org including `'all'`. This is
documented in
[Access Control Policy](../security/02-access-control-policy.md) and
enforced by `assertDatasetAccess`
([`server/controllers/exportController.js`](../../server/controllers/exportController.js)).

## How to download student data

1. `/exports` → Students dataset.
2. Choose org tab (LUC / Training / Institute / All).
3. Set filters (date range, status, source, etc.).
4. Click "Download" — get an xlsx with the rows on screen, plus the LUC
   zero-fee filter applied automatically and the VAT disclaimer when
   applicable. See [Export Center Guide](06-export-center-guide.md).

## Things to remember

- Treat downloaded files as **Restricted** (per
  [Data Classification](../security/03-data-classification-and-handling.md)).
  Do not copy to personal devices or personal cloud accounts.
- Delete files when you no longer need them.
- The Pivot Builder is **disabled for the Manager role today** — you
  always get raw rows.

## Login routing

Because Manager has no dashboard, login redirects you straight to
`/student-database`.

## Related documents

- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
- [Export Center Guide](06-export-center-guide.md)
- [Access Control Policy](../security/02-access-control-policy.md)
