# Information Security Policy

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]`

## 1. Purpose

Establish the principles, responsibilities, and minimum controls that govern
information security at Learners Education for the Team Progress Tracker
platform. This document is the umbrella policy; subordinate policies in
this folder elaborate specific controls.

## 2. Scope

Applies to:

- All Team Progress Tracker code, data, and supporting infrastructure
  (Render Singapore, MongoDB Atlas Ireland, OpenAI, Groq).
- All staff, contractors, vendors, and partners who can read, write, or
  process platform data.
- All endpoints and devices used to access the platform.

## 3. Roles and responsibilities

| Role | Holder | Accountability |
|---|---|---|
| Information owner | Learners Education leadership | Approves the policy; accepts residual risk |
| Security lead (CISO function) | `[FILL]` | Owns this policy and the Gap Roadmap |
| Data Protection Officer (DPO) | `[FILL]` | Owns customer-facing privacy disclosures and the Records Retention Schedule |
| Engineering lead | `[FILL]` | Owns implementation; runs Secure SDLC |
| Operations / on-call | `[FILL]` | Operates Render + Atlas; responds to alerts |
| Every staff member | — | Adheres to this policy and Acceptable Use |

## 4. Principles

1. **Least privilege** — every role gets only the access it needs (see
   [Access Control Policy](02-access-control-policy.md)).
2. **Defense in depth** — no single control is allowed to be load-bearing.
3. **Data minimisation** — collect, process, and retain only what is
   necessary for the stated purpose.
4. **Accountability** — every action that creates, modifies, or deletes
   personal data is attributable to a user where technically feasible.
5. **Transparency** — customers and data subjects can find out what is
   collected, why, where it goes, and how to challenge it.
6. **Honest posture** — known gaps are recorded in the
   [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md), not
   hidden.

## 5. Information classification

Four levels (full handling rules in
[Data Classification & Handling](03-data-classification-and-handling.md)):

| Level | Examples |
|---|---|
| Public | Marketing copy, activity-type enums |
| Internal | Aggregate metrics, organization slug |
| Confidential | Staff PII, consultant phone, free-text notes |
| Restricted | Minors' personal data, payment / EMI history, password hash, JWT secret |

## 6. Acceptable use

Staff using the platform must follow the
[Acceptable Use Policy](../legal/03-acceptable-use-policy.md) and:

- Use a unique strong password (post-SEC-08 fix: ≥ 12 chars, strength ≥ 3).
- Log out of shared devices.
- Never paste credentials, API keys, or production data into external
  AI tools or chat apps that do not have a written processing agreement
  with Learners Education.
- Report any suspected incident immediately per the
  [Incident Response Plan](07-incident-response-plan.md).

## 7. Authentication & access

- All access requires a unique user account; shared logins are prohibited
  (current carve-out: the two Skillhub branch logins
  `training@skillhub.com` and `institute@skillhub.com` are shared by branch
  staff; this is an accepted business risk and is documented in the
  [Access Control Policy](02-access-control-policy.md) — to be revisited
  when MFA lands).
- MFA is **not yet enforced** (SEC-07). Once implemented, MFA is mandatory
  for `admin` and `manager` roles.
- Access reviews quarterly: every `User` row checked against active
  employment.

## 8. Encryption

- All data in transit is TLS-encrypted (Render → Atlas, browser → Render).
- Atlas-managed at-rest encryption is enabled; cluster-tier specifics are
  recorded in [Encryption & Key Management](04-encryption-and-key-management.md).
- Passwords are hashed with bcryptjs salt 10
  ([`server/models/User.js:80-82`](../../server/models/User.js)).
- No field-level encryption today; introduce for sensitive Skillhub fields
  if/when minors' data volumes increase.

## 9. Logging, monitoring, and audit

- Application logs go to Render's stdout (line-based; not yet structured).
  Tracked as P1/P3 in the Gap Roadmap.
- Mutations on `Commitment`, `Student`, `Meeting` carry `createdBy` and
  `lastUpdatedBy`. Deletions are not yet tracked (SEC-16).
- The full logging policy lives in
  [Logging & Audit Policy](05-logging-and-audit-policy.md).

## 10. Vendor management

Every sub-processor must have:

- A written DPA / processing agreement.
- A regional / cross-border transfer safeguard (SCC, adequacy, or
  equivalent).
- A breach-notification clause.
- A documented role in the
  [Sub-processor List](../legal/06-subprocessor-list.md).

OpenAI and Groq DPA status is tracked under SEC-05.

## 11. Secure development

The [Secure SDLC Policy](09-secure-sdlc-policy.md) governs branch
protection, peer review, dependency hygiene, and pre-merge security
checks.

## 12. Incident response

Suspected or confirmed incidents follow the
[Incident Response Plan](07-incident-response-plan.md). Notifiable
breaches under PDPL Art. 9 / GDPR Art. 33 are reported within 72 hours of
becoming aware.

## 13. Business continuity

Regular backup testing and a documented continuity plan are owned by the
operations function — see
[Backup & Disaster Recovery](10-backup-and-disaster-recovery.md) and
[Business Continuity Plan](11-business-continuity-plan.md).

## 14. Compliance

The platform is designed against:

- **UAE PDPL** (Federal Decree-Law No. 45 of 2021) — primary
- **EU GDPR** — applicable because data is stored in Ireland and may
  concern EU residents
- **SOC 2 Trust Services Criteria** — alignment exercise; mapping in
  [SOC 2 / ISO 27001 Control Mapping](13-soc2-iso27001-control-mapping.md)
- **ISO/IEC 27001:2022** — Annex A control mapping in the same document

## 15. Enforcement

Wilful violation of this policy may result in disciplinary action up to
and including termination of employment or contract, and (where
applicable) referral to law enforcement.

## 16. Review

This policy is reviewed at least annually and on any material change to
the platform, vendor list, or applicable law. Approved by `[FILL: name +
title]` on `[FILL: date]`.

## Related documents

- [Access Control Policy](02-access-control-policy.md)
- [Data Classification & Handling](03-data-classification-and-handling.md)
- [Encryption & Key Management](04-encryption-and-key-management.md)
- [Logging & Audit Policy](05-logging-and-audit-policy.md)
- [Vulnerability Management Policy](06-vulnerability-management-policy.md)
- [Incident Response Plan](07-incident-response-plan.md)
- [Vendor & Sub-processor Management](08-vendor-and-subprocessor-management.md)
- [Secure SDLC Policy](09-secure-sdlc-policy.md)
- [Backup & Disaster Recovery](10-backup-and-disaster-recovery.md)
- [Business Continuity Plan](11-business-continuity-plan.md)
- [Threat Model](12-threat-model.md)
- [SOC 2 / ISO 27001 Control Mapping](13-soc2-iso27001-control-mapping.md)
- [Security Gap Analysis & Remediation Roadmap](14-security-gap-analysis-and-remediation-roadmap.md)
- [Vulnerability Disclosure](15-vulnerability-disclosure.md)
