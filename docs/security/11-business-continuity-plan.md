# Business Continuity Plan

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Leadership `[FILL]`

## Purpose

Keep Learners Education's core operations functional during a sustained
disruption to the Team Progress Tracker or its supporting vendors.

## Scope

Disruptions of:

- The application (Render Singapore).
- The database (Atlas Ireland).
- AI providers (OpenAI, Groq).
- Critical staff (key engineer, DPO, leadership unavailable).
- Office connectivity / power.

## Critical business processes

| Process | Acceptable downtime |
|---|---|
| Student admissions data entry | 4 hours |
| Counselor commitment logging | 1 business day |
| Hourly activity tracking | 1 business day |
| Export Center for finance reports | 3 business days |
| Chat / Docs RAG (LUC) | 5 business days |
| Admin reporting / KPI dashboards | 3 business days |

## Continuity strategies

### Application outage

| Strategy | When |
|---|---|
| Wait for Render to recover | < 4 hours |
| Redeploy to alternative host | > 4 hours and Render confirms multi-hour outage |
| Manual fallbacks: paper / spreadsheet for admissions; email for commitments | Until app is back |

### Database outage

| Strategy | When |
|---|---|
| Wait for Atlas to recover | < 2 hours |
| Restore latest snapshot to a side cluster + redeploy app pointing at it | > 2 hours |
| Accept data-entry loss for the outage window; re-enter from paper records when recovered | Always |

### AI provider outage

The platform already cascades Groq → OpenAI in
[`docsRagService.js`](../../server/services/docsRagService.js). If both
fail:

- Docs RAG returns a 503 to the chat drawer; the rest of the app continues.
- Operational impact is minimal — counselors fall back to manual
  navigation of the program PDFs.

### Key-personnel loss

| Role | Single point of failure? | Mitigation |
|---|---|---|
| Engineering lead | Yes | Backup engineer with admin access; runbooks in this `/docs/` set |
| DPO | Yes | Legal counsel `[FILL]` as backup; subject-rights handling temporarily through engineering lead with legal sign-off |
| DBA | Yes | Engineering lead has Atlas admin access |
| On-call | No | Rotation `[FILL]` |
| Leadership | Yes | Pre-authorised deputy `[FILL]` |

### Office disruption

The platform is cloud-hosted; staff with personal devices and reasonable
internet can continue. Critical credentials are not bound to specific
office IPs.

## Communication plan

| Audience | Channel | Owner |
|---|---|---|
| Internal staff | Slack/Teams + status page `[FILL]` | Comms lead |
| Customers / parents | Email + website banner | DPO + leadership |
| Regulators (when applicable) | Per [Incident Response Plan](07-incident-response-plan.md) §6 | DPO |
| Vendors (Render, Atlas, OpenAI, Groq) | Their support channels | Engineering lead |

## Testing

| Test | Frequency | Owner |
|---|---|---|
| Tabletop simulation (one scenario above) | Bi-annually | Security lead |
| Full restore drill | Annually | DBA |
| Communication-tree test | Annually | Comms lead |

## Maintenance

This plan is reviewed annually and on any material change to vendors,
staff, or business processes. Approved by leadership `[FILL]` on
`[FILL]`.

## Related documents

- [Backup & Disaster Recovery](10-backup-and-disaster-recovery.md)
- [Incident Response Plan](07-incident-response-plan.md)
- [Information Security Policy](01-information-security-policy.md)
