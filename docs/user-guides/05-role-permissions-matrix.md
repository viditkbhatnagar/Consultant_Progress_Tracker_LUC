# Role Permissions Matrix

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]`

A simplified, human-readable view of what each role can do. The
authoritative reference — including the Mongoose-level scoping
primitives — is the [Access Control Policy](../security/02-access-control-policy.md).

## Roles

| Role | Type |
|---|---|
| **admin** | Cross-organisation operator |
| **team_lead** | LUC team-scoped manager |
| **manager** | LUC role with a narrow read-only carve-out for the Students export |
| **skillhub** | Per-branch shared counselor login (Training or Institute) |

## Pages

| Page | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| `/admin/dashboard` | ✓ | — | — | — |
| `/team-lead/dashboard` | — | ✓ | — | — |
| `/skillhub/dashboard` | — | — | — | ✓ |
| `/student-database` (LUC) | ✓ | ✓ | ✓ (read) | — |
| `/student-database` (Skillhub) | ✓ | — | — | ✓ (own branch) |
| `/commitments` | ✓ | ✓ | — | ✓ |
| `/meetings` | ✓ | ✓ | — | — |
| `/hourly-tracker` | ✓ | ✓ | — | ✓ |
| `/exports` | ✓ | ✓ | ✓ (Students only) | ✓ (own branch only) |
| `/pdf-viewer` | ✓ | ✓ | — | — |
| Chat → tracker | ✓ | ✓ | — | ✓ |
| Chat → Docs RAG | ✓ (LUC) | ✓ (LUC) | — | — |

## Datasets in Export Center

| Dataset | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| Students | All orgs incl. `'all'` | LUC, own team | LUC, Skillhub Training, Skillhub Institute, `'all'` (read-only) | own branch |
| Commitments | All orgs | LUC, own team | — | own branch |
| Meetings | All orgs | LUC, own team | — | — |
| Hourly | All orgs | LUC, own team | — | own branch |

## Mutations (create / edit / delete)

| Action | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| Create / edit / deactivate users | ✓ | — | — | — |
| Create / edit / soft-delete consultants | ✓ | own team | — | — |
| Create / edit students | ✓ | LUC own team | — | own branch |
| Delete students | ✓ | LUC own team | — | own branch |
| Create / edit commitments | ✓ | own team | — | own branch |
| Set `admissionClosed: true` | ✓ | own team | — | own branch |
| Reverse `admissionClosed` | — | — | — | — |
| Create / edit meetings | ✓ | own team | — | — |
| Log hourly activity | ✓ (any) | own team | — | own branch |
| Force-reingest Docs RAG | ✓ | — | — | — |
| Save export templates | ✓ | ✓ | ✓ | ✓ |

## AI features

| Feature | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| Tracker chatbot | ✓ | ✓ | — | ✓ |
| Docs RAG (programme PDFs) | ✓ (LUC scope) | ✓ (LUC scope) | — | — |
| Dashboard AI Insights | ✓ | ✓ (own team) | — | — |
| API usage stats | ✓ | — | — | — |

## Data access summary

| Sees this row | admin | team_lead | manager | skillhub |
|---|---|---|---|---|
| Any LUC student | ✓ | own team | ✓ (read) | — |
| Any Skillhub student in own branch | ✓ | — | ✓ (export only) | ✓ |
| Any Skillhub student in the other branch | ✓ | — | ✓ (export only) | — |
| Staff `User` rows | ✓ | — | — | — |
| Their own user row | ✓ | ✓ | ✓ | ✓ |

## Things every role should know

- All exports may contain personal data; treat downloaded files at the
  highest classification of any field they include.
- Personal data must not be pasted into external AI tools or chat apps
  (see [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)).
- The role enforcement is real and tested — but URL-tampering and
  body-tampering attempts will be logged once SEC-18 (admin org bypass
  audit) and SEC-16 (deletion audit) land.

## Related documents

- [Access Control Policy](../security/02-access-control-policy.md)
- [Threat Model](../security/12-threat-model.md)
- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
