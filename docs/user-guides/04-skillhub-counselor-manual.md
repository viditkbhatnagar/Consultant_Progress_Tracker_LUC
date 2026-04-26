# Skillhub Counselor Manual

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Skillhub training lead `[FILL]`

This guide is for **Skillhub** counselors using the shared branch logins
`training@skillhub.com` (Skillhub Training) or `institute@skillhub.com`
(Skillhub Institute). Both branches use the same Platform but each is
scoped to its own organisation.

## What you can do

| Capability | Where |
|---|---|
| See your branch's KPIs | `/skillhub/dashboard` |
| Add / edit students | `/student-database` (Skillhub form) |
| Log weekly commitments | `/commitments` |
| Log hourly activity (incl. `sh_meeting`) | `/hourly-tracker` |
| Log daily admission and reference counts | `/hourly-tracker` |
| Export your branch's data | `/exports` |
| Use the tracker chatbot | floating chat bubble |

## What you cannot do

- See LUC data or the other Skillhub branch's data.
- Use Docs RAG (Documents chat) — that is LUC-only.
- See or change consultant rosters (admin manages those).

## Daily flow

1. Open `/skillhub/dashboard`. Confirm KPI strip and any cohort
   indicators are within target.
2. Open `/hourly-tracker`. Log your activity for the day in 1-hour slots.
3. As leads progress, update their `Commitment` rows on `/commitments`.
4. When an enrolment is completed, open the student's row and complete
   the financial fields.

## Adding a student

`/student-database` → "Add Student" (or "Enrol Student"). The Skillhub
form includes:

| Field | What |
|---|---|
| Enrolment number | **You enter manually**. Format hint: `SH/IGCSE/26/11/042` (branch prefix / curriculum / year / month / sequence). Required and unique. |
| Curriculum | Cascading: Board (IGCSE / CBSE / Other) → variant (IGCSE-Cambridge / IGCSE-Edexcel / etc.). |
| Academic year | `2024-25` / `2025-26` / `2026-27` |
| Year / grade | Free text |
| Mode | Online / Offline / Hybrid / OneToOne |
| Course duration | Monthly / OneYear / TwoYears |
| Subjects | Multi-select |
| Course fee, registration fee, admission fee paid | Numeric (AED) |
| EMI plan | Optional installments — `dueDate`, `amount`, `paidOn`, `paidAmount` |
| Phones (student / mother / father) | At least one is required |
| Emails (student / mother / father) | At least one is required |
| Address (emirate) | Required |
| School | Required |
| Date of birth | Required |
| Lead source | Pick from list |
| Counselor | Pick from your branch's roster |

[SCREENSHOT: Skillhub student form]

> Reminder: most Skillhub students are **minors**. Their data is
> classified Restricted. Treat the form fields with care, and do not
> paste them into any external tool.

## Logging commitments

`/commitments` → "Add Commitment" → Skillhub variant.

| Field | What |
|---|---|
| Counselor | Pick from your branch |
| Week | ISO week |
| Commitment date | Day within that week |
| Lead stage | 12-stage funnel as in LUC |
| Status | pending / in_progress / achieved / missed |
| Enrolment number, curriculum, academic year, mode, course fee | When the commitment maps to a planned admission |
| Demos | Subdoc list — scheduledAt, done, doneAt, notes |
| Closed amount | Once admission closes |
| Admission closed | Irreversible toggle |

## EMI tracking

The student's EMI plan is in their record. Each month, when an EMI is
paid, edit the corresponding `emis[i]` and set `paidOn` and `paidAmount`.
The `outstandingAmount` virtual field updates automatically:

```
outstandingAmount = courseFee - admissionFeePaid - registrationFee - sum(emis.paidAmount)
```

The Export Center surfaces this for branch financial reports — see
[Export Center Guide](06-export-center-guide.md).

## Hourly tracker — Skillhub multi-activity

Skillhub hourly slots support multiple activities per slot, including
the `sh_meeting` type which is **duration-based** (30 min – 3 hours).
See [Hourly Tracker Guide](08-hourly-tracker-guide.md) for slot detail.

## What `sh_meeting` is

`sh_meeting` is a Skillhub-only activity type that captures longer
in-person or video meetings (parent counselling, demo sessions). It is
scored between Calling and Demo Meeting in the leaderboard.

## Branch-locked exports

`/exports` for the Skillhub role is **always** locked to your own
branch. You cannot pick another tenant.

## Two important rules

1. **Never paste a student's name, phone, or email into an external AI
   tool, search engine, or chat app.** That is a hard rule under
   [Acceptable Use Policy](../legal/03-acceptable-use-policy.md). Even
   the in-app AI chat is restricted to LUC adult contexts today.
2. **Parental consent must exist before you create a Skillhub student
   record.** Use the [Parental Consent Form](../legal/08-parental-consent-form.md)
   and store the signed copy in the student's admission file.

## Related documents

- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
- [Hourly Tracker Guide](08-hourly-tracker-guide.md)
- [Export Center Guide](06-export-center-guide.md)
- [Children's Privacy Notice](../legal/07-childrens-privacy-notice.md)
- [Parental Consent Form](../legal/08-parental-consent-form.md)
- [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)
