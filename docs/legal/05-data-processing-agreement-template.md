# Data Processing Agreement (Template)

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]`

This template is offered for B2B engagements where Learners Education
acts as a **processor** for a customer or partner who is the **controller**
of personal data on the Team Progress Tracker. Where Learners Education
is itself the controller (most current usage), this template does not
apply.

The text below should be reviewed by qualified legal counsel before use.
Provisions in `[brackets]` indicate fact-specific decisions to be made by
the parties.

---

## Data Processing Agreement

**This Data Processing Agreement** ("DPA") is entered into between:

(1) `[Customer name + address]` ("Controller")

(2) `[Learners Education registered name + address]` ("Processor")

each a "Party" and together the "Parties".

This DPA forms part of, and is governed by, the principal services
agreement between the Parties (the "Agreement"). Capitalised terms have
the meaning given in the GDPR or PDPL where applicable; otherwise, the
Agreement's definitions apply.

### 1. Subject matter and duration

The Processor processes personal data on behalf of the Controller for the
purpose of providing the Team Progress Tracker (the "Services"). This
DPA continues for as long as the Processor processes personal data under
the Agreement, and survives termination as set out in clause 11.

### 2. Nature, purpose, and categories

| Item | Value |
|---|---|
| Nature of processing | Storage, retrieval, transmission, analysis, optionally AI-assisted analysis. |
| Purpose | Provide the Services to the Controller. |
| Categories of personal data | Identity, contact, academic, financial, sales-context, behavioural, account, AI traces — as detailed in the [Privacy Policy](01-privacy-policy.md) §3. |
| Categories of data subjects | The Controller's staff, leads, students, parents/guardians of minors. |
| Special categories | None intentionally collected. Where users insert special-category data into free-text fields, the same lawful basis as the field applies. |

### 3. Controller obligations

The Controller:

- Provides instructions for processing by way of the Agreement, this
  DPA, and the Platform's standard configuration.
- Is responsible for the lawful basis of any processing it asks the
  Processor to perform.
- Is responsible for obtaining any consent (including parental consent
  for minors).
- Notifies the Processor of any limit on processing as soon as it is
  aware.

### 4. Processor obligations

The Processor:

- Processes personal data only on the documented instructions of the
  Controller.
- Ensures persons authorised to process are bound by confidentiality.
- Takes all measures required by GDPR Art. 32 / PDPL Art. 20 — see
  Annex 2 (Technical and Organisational Measures).
- Assists the Controller in fulfilling subject rights, security
  obligations, breach notifications, and any DPIA the Controller is
  required to perform.
- Deletes or returns personal data on termination of the Services as
  set out in clause 11.
- Makes available to the Controller all information necessary to
  demonstrate compliance, and allows audits as set out in clause 8.

### 5. Sub-processors

The Processor may engage sub-processors as listed in Annex 3 (the
"[Sub-processor List](06-subprocessor-list.md)"). The Processor will:

- Bind each sub-processor to terms substantially equivalent to this DPA.
- Notify the Controller at least 14 days before adding or replacing a
  sub-processor.
- Allow the Controller to object to the change. If the Parties cannot
  agree, the Controller may terminate the affected Services.

### 6. International transfers

Where personal data is transferred outside the UAE or the EEA, the
Parties rely on the safeguards listed in Annex 1.6 (cross-border
safeguards). The current setup involves transfers to:

- MongoDB Atlas (Ireland)
- Render (Singapore)
- OpenAI (United States)
- Groq (United States)

### 7. Personal data breach

The Processor notifies the Controller without undue delay, and in any
event within **48 hours** of becoming aware of a personal data breach
affecting Controller data, providing the information required by GDPR
Art. 33 / PDPL Art. 9.

### 8. Audit

The Controller may, on reasonable notice and not more than once per
12 months, audit the Processor's compliance with this DPA. The
Processor may satisfy this obligation by providing a current SOC 2
report, an ISO 27001 certificate, or equivalent third-party assurance —
when available — together with the
[SOC 2 / ISO 27001 Control Mapping](../security/13-soc2-iso27001-control-mapping.md)
maintained by the Processor.

### 9. Data subject requests

The Processor will assist the Controller in responding to data-subject
requests within the timelines required by applicable law.

### 10. Liability

Liability under this DPA is governed by the limitation of liability
clause in the Agreement, save where applicable law prevents such
limitation.

### 11. Termination

On termination of the Services, the Processor — at the Controller's
election — deletes or returns Controller personal data within `[FILL: 30
days]`, save where retention is required by law (e.g., 7 years tax
record-keeping under UAE law).

### 12. Governing law

This DPA is governed by `[FILL: UAE law / customer's preferred law]`.

### Signatures

For the Controller: `___________________` (name, title, date)

For the Processor: `___________________` (name, title, date)

---

## Annex 1 — Description of processing

| Item | Detail |
|---|---|
| 1. Subject matter | As clause 1. |
| 2. Duration | As clause 1. |
| 3. Nature and purpose | As clause 2. |
| 4. Categories of personal data | As clause 2. |
| 5. Categories of data subjects | As clause 2. |
| 6. Cross-border safeguards | `[FILL: SCCs Module 2; UAE adequacy / consent route]` |
| 7. Frequency and retention | Continuous; retention per [Records Retention Schedule](09-records-retention-schedule.md) |

## Annex 2 — Technical and Organisational Measures

The Processor's TOMs are documented in:

- [Information Security Policy](../security/01-information-security-policy.md)
- [Access Control Policy](../security/02-access-control-policy.md)
- [Encryption & Key Management](../security/04-encryption-and-key-management.md)
- [Logging & Audit Policy](../security/05-logging-and-audit-policy.md)
- [Vulnerability Management Policy](../security/06-vulnerability-management-policy.md)
- [Incident Response Plan](../security/07-incident-response-plan.md)
- [Backup & Disaster Recovery](../security/10-backup-and-disaster-recovery.md)

The current state and known gaps are documented in:

- [Security Gap Analysis & Remediation Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md)

## Annex 3 — Sub-processors

The current list is at [Sub-processor List](06-subprocessor-list.md).

## Annex 4 — Customer-specific provisions

`[FILL: any deviations agreed with this Customer]`
