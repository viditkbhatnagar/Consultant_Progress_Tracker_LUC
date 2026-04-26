# Team Progress Tracker — Documentation Set

This folder is the canonical documentation set for the Team Progress Tracker
platform operated by Learners Education (UAE) for its LUC division and Skillhub
branches (Training + Institute).

It is organised by audience:

| Folder | Audience | Purpose |
|---|---|---|
| [`engineering/`](engineering/) | Engineers, auditors | Architecture, API reference, data dictionary, runbooks |
| [`security/`](security/) | Security/compliance, auditors, leadership | Policies, threat model, control mapping, gap roadmap |
| [`legal/`](legal/) | Customers, partners, regulators, DPO | Privacy Policy, ToS, DPA template, sub-processor list |
| [`user-guides/`](user-guides/) | End users (admin / team lead / manager / counselor) | Per-role manuals, FAQ |

## Document index

### Engineering — [`engineering/`](engineering/)

| # | Doc | Audience |
|---|---|---|
| 01 | [Architecture Overview](engineering/01-architecture-overview.md) | Engineers |
| 02 | [API Reference](engineering/02-api-reference.md) | Engineers, integrators |
| 03 | [Data Dictionary](engineering/03-data-dictionary.md) | Engineers, DPO, auditors |
| 04 | [Deployment Runbook](engineering/04-deployment-runbook.md) | Engineers, ops |
| 05 | [Environment & Secrets](engineering/05-environment-and-secrets.md) | Engineers, ops |
| 06 | [Build & Release Process](engineering/06-build-and-release-process.md) | Engineers |
| 07 | [Monitoring & Alerting Runbook](engineering/07-monitoring-and-alerting-runbook.md) | Engineers, ops |
| 08 | [Database & Migrations](engineering/08-database-and-migrations.md) | Engineers |
| 09 | [Developer Onboarding](engineering/09-developer-onboarding.md) | New engineers |

### Security & Compliance — [`security/`](security/)

| # | Doc | Audience |
|---|---|---|
| 01 | [Information Security Policy](security/01-information-security-policy.md) | All staff, auditors |
| 02 | [Access Control Policy](security/02-access-control-policy.md) | Security, ops, auditors |
| 03 | [Data Classification & Handling](security/03-data-classification-and-handling.md) | All staff, auditors |
| 04 | [Encryption & Key Management](security/04-encryption-and-key-management.md) | Engineers, auditors |
| 05 | [Logging & Audit Policy](security/05-logging-and-audit-policy.md) | Engineers, security, auditors |
| 06 | [Vulnerability Management Policy](security/06-vulnerability-management-policy.md) | Engineers, security |
| 07 | [Incident Response Plan](security/07-incident-response-plan.md) | All staff, on-call |
| 08 | [Vendor & Sub-processor Management](security/08-vendor-and-subprocessor-management.md) | Procurement, security, DPO |
| 09 | [Secure SDLC Policy](security/09-secure-sdlc-policy.md) | Engineers |
| 10 | [Backup & Disaster Recovery](security/10-backup-and-disaster-recovery.md) | Engineers, ops |
| 11 | [Business Continuity Plan](security/11-business-continuity-plan.md) | Leadership, ops |
| 12 | [Threat Model](security/12-threat-model.md) | Security, engineers, auditors |
| 13 | [SOC 2 / ISO 27001 Control Mapping](security/13-soc2-iso27001-control-mapping.md) | Auditors, security |
| 14 | [Security Gap Analysis & Remediation Roadmap](security/14-security-gap-analysis-and-remediation-roadmap.md) | Engineers, security, leadership |
| 15 | [Vulnerability Disclosure](security/15-vulnerability-disclosure.md) | External researchers |

### Legal — [`legal/`](legal/)

| # | Doc | Audience |
|---|---|---|
| 01 | [Privacy Policy](legal/01-privacy-policy.md) | Public, customers, regulators |
| 02 | [Terms of Service / EULA](legal/02-terms-of-service.md) | Customers |
| 03 | [Acceptable Use Policy](legal/03-acceptable-use-policy.md) | Customers |
| 04 | [Cookie & Local Storage Disclosure](legal/04-cookie-and-local-storage-disclosure.md) | Public |
| 05 | [Data Processing Agreement (Template)](legal/05-data-processing-agreement-template.md) | B2B partners |
| 06 | [Sub-processor List](legal/06-subprocessor-list.md) | Public, DPO |
| 07 | [Children's Privacy Notice](legal/07-childrens-privacy-notice.md) | Parents, regulators |
| 08 | [Parental Consent Form](legal/08-parental-consent-form.md) | Skillhub onboarding |
| 09 | [Records Retention Schedule](legal/09-records-retention-schedule.md) | DPO, ops, auditors |
| 10 | [Intellectual Property & Copyright](legal/10-intellectual-property-and-copyright.md) | Public, partners |

### User Guides — [`user-guides/`](user-guides/)

| # | Doc | Audience |
|---|---|---|
| 00 | [Onboarding & Quick Start](user-guides/00-onboarding-and-quick-start.md) | All new users |
| 01 | [Admin Manual](user-guides/01-admin-manual.md) | Admin |
| 02 | [Team Lead Manual](user-guides/02-team-lead-manual.md) | Team lead (LUC) |
| 03 | [Manager Manual](user-guides/03-manager-manual.md) | Manager |
| 04 | [Skillhub Counselor Manual](user-guides/04-skillhub-counselor-manual.md) | Skillhub Training & Institute |
| 05 | [Role Permissions Matrix](user-guides/05-role-permissions-matrix.md) | All users, ops |
| 06 | [Export Center Guide](user-guides/06-export-center-guide.md) | All export-eligible users |
| 07 | [Chat & Docs RAG Guide (LUC)](user-guides/07-chat-and-docs-rag-guide.md) | LUC users |
| 08 | [Hourly Tracker Guide](user-guides/08-hourly-tracker-guide.md) | Counselors, team leads |
| 09 | [FAQ](user-guides/09-faq.md) | All users |

## Conventions

1. **`[FILL: …]` markers** — placeholders for facts only Learners Education
   can provide (registered company name, exact address, DPO email, signed-DPA
   dates, etc.). Replace before publication.
2. **`file:line` citations** — every security claim links to the actual
   implementation in this repo. If a control is not implemented, the doc says
   so and links to [Security Gap Analysis](security/14-security-gap-analysis-and-remediation-roadmap.md).
3. **Versioning** — each doc carries a header line `v0.1 — drafted YYYY-MM-DD`
   and a "Last reviewed" date.
4. **No fabricated controls** — claims describe the system as it actually is.
   Aspirational or planned controls are clearly marked "Planned" and tracked
   in the gap roadmap.

## Cross-border data-flow summary

A typical request from a Learners Education staff user touches **four
jurisdictions**:

| Hop | Location | Role |
|---|---|---|
| 1 | UAE | Data subject (staff, student, parent) and controller |
| 2 | Singapore | Application processing — Render `ap-southeast-1` |
| 3 | Ireland (EU/EEA) | Primary database — MongoDB Atlas `eu-west-1` |
| 4 | United States | OpenAI + Groq when AI features are used |

Every customer-facing legal document (Privacy Policy, DPA, Sub-processor List,
Children's Privacy Notice) discloses this flow. UAE PDPL Art. 22–23 and GDPR
Art. 44–49 both apply.

## Maintenance

| Folder | Owner | Review cadence |
|---|---|---|
| `engineering/` | Engineering lead `[FILL]` | Quarterly + on each architecture change |
| `security/` | CISO / security lead `[FILL]` | Quarterly + on each material change |
| `legal/` | DPO / legal counsel `[FILL]` | Annually + on each material change |
| `user-guides/` | Product / training lead `[FILL]` | On each material UX change |

## Change log

| Date | Author | Change |
|---|---|---|
| 2026-04-26 | Initial draft | Created complete documentation set across all four folders |
