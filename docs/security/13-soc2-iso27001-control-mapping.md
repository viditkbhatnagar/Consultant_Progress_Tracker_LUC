# SOC 2 / ISO 27001 Control Mapping

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]` + Engineering lead `[FILL]`

## Purpose

Map AICPA SOC 2 Trust Services Criteria (TSC) and ISO/IEC 27001:2022
Annex A controls to evidence in this codebase or to documented
operational practices. Honest about what is **not implemented**;
unimplemented controls cross-reference the
[Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).

This is an **alignment exercise**, not an attestation. A formal SOC 2
Type II would require an external auditor and a sustained operating
period; an ISO 27001 certification would require an ISMS programme and
external certification audit.

## Trust Services Criteria — Common Criteria

### CC1 — Control Environment

| TSC | Status | Evidence |
|---|---|---|
| CC1.1 — Demonstrates commitment to integrity and ethical values | Partial | Information Security Policy (this set, §3); HR onboarding policy `[FILL]` |
| CC1.2 — Board oversight | `[FILL]` | Recorded in leadership minutes `[FILL]` |
| CC1.3 — Management's authorities and responsibilities | Implemented | Roles in [Information Security Policy](01-information-security-policy.md) §3 |
| CC1.4 — Attracts, develops, retains competent individuals | `[FILL]` | HR records |
| CC1.5 — Holds individuals accountable | Partial | Audit fields `createdBy` / `lastUpdatedBy`; no deletion log (SEC-16) |

### CC2 — Communication and Information

| TSC | Status | Evidence |
|---|---|---|
| CC2.1 — Quality information for internal control | Partial | This documentation set; no formal change log discipline `[FILL]` |
| CC2.2 — Internal communication | Partial | Slack/Teams `[FILL]` |
| CC2.3 — External communication | Partial | [Privacy Policy](../legal/01-privacy-policy.md), [Vulnerability Disclosure](15-vulnerability-disclosure.md) |

### CC3 — Risk Assessment

| TSC | Status | Evidence |
|---|---|---|
| CC3.1 — Specifies suitable objectives | Partial | Risk objectives in this folder |
| CC3.2 — Identifies and analyses risks | Implemented | [Threat Model](12-threat-model.md), [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md) |
| CC3.3 — Considers fraud risk | Partial | Audit fields; admission-closed irreversibility |
| CC3.4 — Identifies and assesses change | Partial | Threat model annual + on-change |

### CC4 — Monitoring Activities

| TSC | Status | Evidence |
|---|---|---|
| CC4.1 — Ongoing and/or separate evaluations | Partial | Quarterly access review (planned); no external audit yet |
| CC4.2 — Communicates deficiencies | Implemented | Gap Roadmap is the open-item register |

### CC5 — Control Activities

| TSC | Status | Evidence |
|---|---|---|
| CC5.1 — Selects controls that contribute to mitigation of risk | Implemented | RBAC, scoping, rate limit (export only) |
| CC5.2 — Selects general controls over technology | Partial | TLS, bcrypt, JWT; gaps tracked |
| CC5.3 — Deploys through policies and procedures | Implemented | This documentation set |

### CC6 — Logical and Physical Access

| TSC | Status | Evidence |
|---|---|---|
| CC6.1 — Logical access security software, infrastructure, and architectures | Implemented | [`auth.js`](../../server/middleware/auth.js); [Access Control Policy](02-access-control-policy.md) |
| CC6.2 — Authenticates and authorises users | Implemented (with gaps) | JWT auth; gaps: no MFA (SEC-07), no password reset (SEC-09) |
| CC6.3 — Manages access | Implemented | Soft-delete via `isActive: false`; quarterly access reviews planned |
| CC6.4 — Restricts physical access | N/A (cloud-hosted) | Render / Atlas data-centres |
| CC6.5 — Discontinues logical access | Partial | `isActive: false`; JWT lingers until expiry (SEC-10) |
| CC6.6 — Implements logical access security boundaries | Partial | Helmet defaults; CSP off (SEC-06); CORS open (SEC-02) |
| CC6.7 — Restricts movement of information | Partial | Multi-tenancy enforced; AI exfil concern (SEC-13) |
| CC6.8 — Manages malicious software | Out of scope | Trusted runtime |

### CC7 — System Operations

| TSC | Status | Evidence |
|---|---|---|
| CC7.1 — Detects and monitors changes that could pose a threat | Partial | [Monitoring runbook](../engineering/07-monitoring-and-alerting-runbook.md); no Sentry yet (SEC-23) |
| CC7.2 — Monitors components and operates them effectively | Partial | Render dashboard, Atlas dashboard |
| CC7.3 — Evaluates security events | Partial | [Incident Response Plan](07-incident-response-plan.md); no SIEM |
| CC7.4 — Responds to security incidents | Implemented | [Incident Response Plan](07-incident-response-plan.md) |
| CC7.5 — Recovers from incidents | Partial | [Backup & Disaster Recovery](10-backup-and-disaster-recovery.md); no drill executed yet |

### CC8 — Change Management

| TSC | Status | Evidence |
|---|---|---|
| CC8.1 — Authorises, designs, develops, and tests changes | Implemented | PR-based [SDLC](09-secure-sdlc-policy.md); tests for Export Center |

### CC9 — Risk Mitigation

| TSC | Status | Evidence |
|---|---|---|
| CC9.1 — Identifies and addresses risks of business disruption | Implemented | [BCP](11-business-continuity-plan.md), [BDR](10-backup-and-disaster-recovery.md) |
| CC9.2 — Manages vendor and third-party risks | Partial | [Vendor Management](08-vendor-and-subprocessor-management.md); DPAs pending (SEC-05) |

## Privacy Criterion (P)

| TSC | Status | Evidence |
|---|---|---|
| P1 — Notice | Partial | [Privacy Policy](../legal/01-privacy-policy.md) drafted; `[FILL]` legal review |
| P2 — Choice and consent | Partial | [Parental Consent Form](../legal/08-parental-consent-form.md); no per-feature consent UI yet |
| P3 — Collection | Implemented | Schema enforces required fields; no over-collection identified |
| P4 — Use, retention, disposal | Partial | [Records Retention Schedule](../legal/09-records-retention-schedule.md); some retention gaps (SEC-20) |
| P5 — Access | Partial | Manual subject-rights handling via DPO |
| P6 — Disclosure to third parties | Implemented | [Sub-processor List](../legal/06-subprocessor-list.md) |
| P7 — Quality | Partial | Schema validation; deduping not automated |
| P8 — Monitoring and enforcement | Partial | Audit-log gap (SEC-16) |

## ISO/IEC 27001:2022 Annex A (key controls)

| Control | Status | Evidence |
|---|---|---|
| A.5.1 Policies for information security | Implemented | This set |
| A.5.7 Threat intelligence | Partial | Vendor advisories monitored manually |
| A.5.10 Acceptable use | Implemented | [AUP](../legal/03-acceptable-use-policy.md) |
| A.5.15 Access control | Implemented | RBAC |
| A.5.16 Identity management | Implemented | `User` model, soft-delete |
| A.5.17 Authentication information | Partial | bcrypt; no MFA |
| A.5.18 Access rights | Implemented | Admin-only `/users` CRUD |
| A.5.23 Information security in cloud services | Partial | Vendor management policy; DPAs pending |
| A.5.24 IS incident management planning | Implemented | Incident response plan |
| A.5.30 ICT readiness for business continuity | Partial | BCP drafted; not drilled |
| A.6.3 Information security awareness | `[FILL]` | Staff training programme |
| A.7 Physical controls | N/A (cloud) | — |
| A.8.1 User endpoint devices | `[FILL]` | Laptop FDE policy |
| A.8.2 Privileged access rights | Partial | Admin role; no formal PAM |
| A.8.5 Secure authentication | Partial | JWT; no MFA |
| A.8.7 Protection against malware | Partial | Render-managed runtime |
| A.8.8 Management of technical vulnerabilities | Partial | [Vulnerability Management Policy](06-vulnerability-management-policy.md); no automated scans on CI |
| A.8.9 Configuration management | Partial | Env vars in Render |
| A.8.12 Data leakage prevention | Partial | Scope filters; AI exfil gap (SEC-13) |
| A.8.13 Information backup | Implemented | Atlas snapshots |
| A.8.15 Logging | Partial | console.* logs; structured logger pending |
| A.8.16 Monitoring activities | Partial | Health endpoints; no APM yet |
| A.8.20 Network security | Partial | Helmet partial; CORS open (SEC-02) |
| A.8.21 Security of network services | Partial | TLS via Render |
| A.8.23 Web filtering | N/A | — |
| A.8.24 Use of cryptography | Implemented | TLS, bcrypt, JWT-HS256 |
| A.8.25 Secure development life cycle | Partial | [SDLC](09-secure-sdlc-policy.md) |
| A.8.28 Secure coding | Partial | Code reviews; no linter on server |
| A.8.29 Security testing in development and acceptance | Partial | Jest tests for Export Center only |
| A.8.32 Change management | Implemented | PR + branch protection |
| A.8.34 Protection of information systems during audit testing | Implemented | Testing on isolated envs |

## How to use this document

- **External auditor**: walks the table; for "Partial" or "Not implemented"
  rows, look up the corresponding finding in the
  [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md).
- **Customer security questionnaire**: most enterprise questionnaires can
  be answered by reading this document; cite the column "Status" and the
  evidence.
- **Internal review**: re-walk every quarter; update statuses as fixes
  land.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Threat Model](12-threat-model.md)
- [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md)
- [Vendor & Sub-processor Management](08-vendor-and-subprocessor-management.md)
