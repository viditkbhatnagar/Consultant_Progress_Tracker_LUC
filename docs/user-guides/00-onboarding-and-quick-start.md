# Onboarding & Quick Start

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

Welcome to the Team Progress Tracker. This guide gets you from zero to
productive in about 15 minutes regardless of your role.

## 1. Getting an account

Accounts are provisioned by an administrator. Ask your manager to create
yours; you cannot self-register.

You will receive:

- A login URL (`[FILL: https://app.learnerseducation.ae]`)
- A username (your work email)
- A temporary password — change it immediately on first login

## 2. Logging in

1. Open the login URL.
2. Enter your email and password.
3. The platform routes you to your home dashboard based on your role:
   - Admin → `/admin/dashboard`
   - LUC team lead → `/team-lead/dashboard`
   - Manager → `/student-database` (manager has no dashboard)
   - Skillhub → `/skillhub/dashboard`

## 3. Change your password

Click your name (top right) → "Change password" — or visit
`PUT /api/auth/updatepassword` from the API. You will need the temporary
password to set a new one.

Today's minimum password rule is 6 characters. We recommend you use **at
least 12 characters** with mixed case, digits, and symbols. A stronger
policy is on the roadmap.

## 4. Find your way around

| Page | Who | Purpose |
|---|---|---|
| Dashboard | All | KPIs and quick links scoped to your role |
| Student Database | Admin / Team Lead / Manager / Skillhub | Roster and admission records |
| Commitments | Admin / Team Lead / Skillhub | Weekly sales / admission commitments |
| Meetings | Admin / Team Lead | LUC meeting log |
| Hourly Tracker | Admin / Team Lead / Skillhub | Per-counselor activity slots |
| Export Center | All | Download reports |
| Chat drawer | Admin / Team Lead / Skillhub | Tracker chat (and Docs RAG for LUC) |
| PDF Viewer | Admin / Team Lead | LUC programme PDFs |

## 5. Pick the right manual

| Your role | Manual |
|---|---|
| Admin | [Admin Manual](01-admin-manual.md) |
| LUC team lead | [Team Lead Manual](02-team-lead-manual.md) |
| Manager | [Manager Manual](03-manager-manual.md) |
| Skillhub Training / Institute | [Skillhub Counselor Manual](04-skillhub-counselor-manual.md) |

For cross-cutting features:

- [Export Center Guide](06-export-center-guide.md)
- [Chat & Docs RAG Guide](07-chat-and-docs-rag-guide.md) (LUC users)
- [Hourly Tracker Guide](08-hourly-tracker-guide.md)
- [FAQ](09-faq.md)

## 6. House rules

Read the [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)
before you do anything substantive. Highlights:

- Never share your password.
- Never paste personal data into external AI tools or chat apps.
- Never bypass the role scoping in the URL bar.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Not authorized" | Sign out and back in. If it persists, ask an admin to confirm `isActive=true`. |
| Page is blank | Hard-refresh (Cmd/Ctrl + Shift + R). Check the browser console for errors. |
| Chat returns "service unavailable" | The Docs RAG index may not be loaded yet; ask an admin to force-reingest. |
| You spot personal data leaking somewhere it shouldn't | Stop. Email `[FILL: security@…]` with details. |

## 8. Help

- `/help` channel `[FILL]`
- `[FILL: support@…]`
- Or check the [FAQ](09-faq.md)

[SCREENSHOT: login page]
[SCREENSHOT: role-specific dashboard landing]
