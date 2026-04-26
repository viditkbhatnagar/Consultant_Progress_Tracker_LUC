# Incident Response Plan

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Security lead `[FILL]`

## Purpose

Define how Learners Education detects, contains, eradicates, recovers
from, and learns from security incidents affecting the Team Progress
Tracker.

## Definitions

- **Event** — any observable occurrence on the platform.
- **Incident** — an event that has caused, or threatens to cause, a
  compromise of confidentiality, integrity, or availability of personal
  data or platform availability.
- **Breach** — an incident with confirmed or likely impact on personal
  data, requiring regulator/subject notification.

## Severity matrix

| Severity | Trigger | Response time | Examples |
|---|---|---|---|
| **SEV-1** | Active exfiltration / outage > 30 min / regulator-notifiable breach | < 15 min | Atlas breach, JWT secret leak, mass account takeover |
| **SEV-2** | Suspected breach, partial outage, single-account takeover | < 1 hour | Unusual mass-export, suspicious admin org-bypass, defaced page |
| **SEV-3** | Limited / contained issue, no data impact yet | Next business day | Single failed-login storm, dependency CVE in non-prod path |
| **SEV-4** | Informational | Triage in next standup | Phishing email reported by staff |

## Roles

| Role | Holder | Duties during incident |
|---|---|---|
| Incident commander | Security lead `[FILL]` | Owns the response; declares SEV; calls escalation |
| Tech lead | Engineering lead `[FILL]` | Drives technical containment + recovery |
| Comms lead | Leadership / DPO `[FILL]` | Internal + external communication; regulator notification |
| Scribe | On-call engineer `[FILL]` | Maintains the incident timeline in the runbook channel |
| DPO | `[FILL]` | Determines notifiability under PDPL/GDPR |

A single person may hold more than one role on small incidents.

## Phases

### 1. Detect

Detection sources:

- Render alert on health-check failure.
- Atlas alert (connections, IOPS, replication lag).
- Failed-login alert (planned — SEC-12).
- AI cost spike alert (planned).
- External report via the
  [Vulnerability Disclosure](15-vulnerability-disclosure.md) channel.
- Staff observation.

### 2. Triage

The incident commander confirms the event, declares severity, opens an
incident channel `[FILL: Slack/Teams pattern]`, pages the tech lead, and
starts the timeline.

### 3. Contain

Possible containment actions, ordered by impact:

| Action | When | Who |
|---|---|---|
| Disable a compromised user (`isActive: false`) | Account takeover | Admin |
| Rotate `JWT_SECRET` | Mass takeover or token leak | Engineering lead |
| Rotate `OPENAI_API_KEY` / `GROQ_API_KEY` | API-key leak | Engineering lead |
| Rotate Atlas user password | DB-credential leak | DBA |
| Pause Render deploy | Bad release | Engineering lead |
| Roll back deploy | Confirmed regression | Engineering lead |
| Take service offline | Active exfiltration | Engineering lead + leadership |
| Block IP at edge | Targeted attack | Render WAF / network `[FILL]` |
| Temporarily disable AI features | LLM data-exfil concern | Engineering lead |

### 4. Eradicate

Identify and remove the root cause: patch the vulnerable code, revoke the
abused credential, remove malicious data. Confirm via the same detection
that originally fired.

### 5. Recover

- Restore service. If data restoration is needed, follow
  [Backup & Disaster Recovery](10-backup-and-disaster-recovery.md).
- Verify with smoke tests (see
  [Deployment Runbook](../engineering/04-deployment-runbook.md)).
- Re-enable any defenses that were temporarily relaxed.

### 6. Notify

- **Regulators**:
  - UAE PDPL Art. 9: notify the UAE Data Office without undue delay if a
    breach affects personal data.
  - GDPR Art. 33: notify the lead supervisory authority `[FILL: which]`
    within 72 hours of awareness if there is a risk to data subjects.
- **Data subjects** (PDPL Art. 9 / GDPR Art. 34): when high risk to their
  rights, notify them in clear language.
- **Customers / partners**: per the [DPA template](../legal/05-data-processing-agreement-template.md)
  Annex 2 obligations.
- **Insurers**: `[FILL: cyber insurer]`.

### 7. Post-incident review

Within 5 business days of resolution:

- Timeline reconstructed from the scribe's notes.
- Root cause identified.
- Action items captured: prevent recurrence, improve detection, improve
  response.
- Post-mortem written and stored under `[FILL: location]`.
- Affected items in the [Gap Roadmap](14-security-gap-analysis-and-remediation-roadmap.md)
  updated.

## Templates

### Internal notification (SEV-1/2)

```
Subject: [INC-####] Incident declared — SEV-2 — suspected mass export

Time: 2026-04-26 14:32 GST
Status: Investigating
Commander: <name>
Tech lead: <name>
Public statement: not yet — comms lead drafting
Action so far:
  - Rotated session for affected admin user
  - Rate limit on /exports/raw being added in hotfix
Next update: 30 min
```

### Regulator notification (PDPL / GDPR)

Use templates `[FILL]` provided by legal counsel. Include: nature of the
breach, categories and approximate number of subjects, likely
consequences, measures taken, contact point.

### Subject notification

Plain-language, no jargon. Identify the data, the date range, the
suspected source, what we did, what they should do, our contact.

## Tabletop exercise

Bi-annually the security lead runs a tabletop scenario (e.g., "an admin's
laptop is stolen", "OpenAI key leaked on GitHub"). Outcomes feed the Gap
Roadmap.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Logging & Audit Policy](05-logging-and-audit-policy.md)
- [Vulnerability Management Policy](06-vulnerability-management-policy.md)
- [Backup & Disaster Recovery](10-backup-and-disaster-recovery.md)
- [Vulnerability Disclosure](15-vulnerability-disclosure.md)
