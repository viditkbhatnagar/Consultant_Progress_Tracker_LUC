# Team Lead Manual (LUC)

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

This guide is for **LUC team leads**. You manage your own team's
consultants, log weekly commitments, track meetings and admissions, and
run AI insights — all scoped to your own team within LUC.

## What you can do

| Capability | Where |
|---|---|
| See your team's KPIs | `/team-lead/dashboard` |
| Add / edit / soft-delete consultants on your team | dashboard → Consultant Management |
| Log weekly commitments per consultant | `/commitments` |
| Add new student admissions | `/student-database` |
| Track meetings (demo / discussion / offer / etc.) | `/meetings` |
| Log hourly activity per consultant | `/hourly-tracker` |
| Export your own team's data | `/exports` |
| Use the chat drawer (tracker + Docs RAG for LUC) | floating bubble |

## What you cannot do

- See other team leads' data.
- See Skillhub data.
- Create users (admin only).
- Pick `'all'` org or any other tenant in the Export Center.
- Reverse `admissionClosed` once it is set to `true` — that's irreversible.

## Weekly rhythm (recommended)

| Day | Action |
|---|---|
| Monday | Review last week's missed commitments. Coach your team. |
| Tuesday–Thursday | Log meetings as they happen. Update lead stages. |
| Friday | Close out the week's commitments. Mark `achieved` or `missed`. |
| Friday afternoon | Run AI insights on your dashboard for the week. |

## Adding a consultant

Dashboard → "Add Consultant" → name, email, phone, team. The consultant
does **not** get a login; this is a tracking row only. They appear in
hourly tracker, commitments, and meeting forms.

Soft-delete via "Deactivate". Historical commitments and meetings keep
the consultant's name on the row (denormalised).

## Logging weekly commitments

`/commitments` → "Add Commitment".

| Field | What |
|---|---|
| Consultant | Pick from your team's roster |
| Week | ISO week (Monday-Sunday) |
| Commitment date | The actual day you are logging the commitment for. Must fall within the week's start–end |
| Lead stage | Dead → Cold → Warm → Hot → Offer Sent → Awaiting Confirmation → Meeting Scheduled → Admission → CIF |
| Status | pending / in_progress / achieved / missed |
| Commitment made | Free text — what they committed to |
| Conversion probability | Optional |
| Closed amount | Set when admission closes |
| Admission closed | Toggle once admission is locked. **Irreversible.** |

[SCREENSHOT: commitment form]

## Tracking meetings

`/meetings` → "Add Meeting". Capture the meeting date, mode, consultant,
student name, and remarks. Meetings are LUC-only.

> Tip: do not paste personal data such as phone numbers into the
> `remarks` free-text field unless necessary. The field gets read by the
> chat drawer's tool calls and could end up in a future AI prompt
> (today, restricted to LUC adult contexts only).

## AI insights

`/team-lead/dashboard` → "AI Insights" → "Generate". The model
summarises your team's performance from the past period. Verify before
sharing — AI outputs may contain mistakes.

Cost is charged to the LUC tenant; admin can see your team's
contribution in the AI Usage panel.

## Closing an admission

1. Open the relevant commitment.
2. Set `admissionClosed: true` and fill the `closedAmount`.
3. Save. The flag is **irreversible**: the server rejects any later
   attempt to flip it back.

If you set it by mistake, contact admin / engineering to correct the
state. Document the reason — the audit trail on this action is
imperfect today (Gap Roadmap SEC-16).

## Exporting your data

`/exports` opens with your team's allowed datasets:

- Students (LUC, your team)
- Commitments (your team)
- Meetings (your team)
- Hourly (your team)

Pivot Builder is rate-limited to 5 requests per minute. See
[Export Center Guide](06-export-center-guide.md).

## Related documents

- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
- [Hourly Tracker Guide](08-hourly-tracker-guide.md)
- [Chat & Docs RAG Guide](07-chat-and-docs-rag-guide.md)
- [Export Center Guide](06-export-center-guide.md)
- [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)
