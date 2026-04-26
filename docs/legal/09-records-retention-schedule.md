# Records Retention Schedule

> v0.1 — drafted 2026-04-26 · Effective date: `[FILL]` · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]`

## Principles

We retain personal data only as long as necessary for the purpose it was
collected, plus any period required by law (UAE Commercial Companies
Law, Federal Tax Authority record-keeping rules, sectoral education
regulators). The schedule below is the canonical reference. It supersedes
any contrary local note inside the application.

| Symbol | Meaning |
|---|---|
| ✓ | Implemented today |
| ⏳ | Planned (linked to a Gap Roadmap item) |

## Table

| Category | Source model | Retention | Disposal | Status |
|---|---|---|---|---|
| Active student records | `Student` | While enrolled + 7 years | Hard-delete + cascading anonymisation of denormalised name fields on dependent docs | ⏳ (no automated purge) |
| Closed / withdrawn / dead leads | `Student` (Skillhub `studentStatus = 'inactive'`) or `Commitment.leadStage = 'Dead'` | 3 years from last activity | Hard-delete | ⏳ |
| Staff accounts | `User` | While `isActive=true`; 7 years from offboarding then anonymise | `isActive=false` then field-wise anonymisation | ⏳ partial (`isActive` exists; no anonymisation step yet) |
| Consultants | `Consultant` | Same as staff accounts | Soft-delete + anonymise | ⏳ |
| Weekly commitments | `Commitment` | 7 years from `weekEndDate` | Hard-delete; preserve denormalised text on related Notification | ⏳ |
| Meetings | `Meeting` | 5 years from `meetingDate` | Hard-delete | ⏳ |
| Hourly activity | `HourlyActivity`, `DailyAdmission`, `DailyReference` | 2 years from `date` | Hard-delete | ⏳ |
| Notifications | `Notification` | 90 days from `createdAt` | Hard-delete (no soft flag exists) | ⏳ |
| Chat conversations (tracker + Docs RAG) | `ChatConversation` | 1 year from `lastActivityAt` | Hard-delete | ⏳ (currently no purge — SEC-20) |
| Docs-chat analytics | `DocsChatLog` | 13 months from `createdAt` | Hard-delete | ⏳ (currently no TTL — SEC-20) |
| Docs-chat 24h cache | `QueryCache` | 24 hours | Mongo TTL index | ✓ |
| AI usage / cost | `AIUsage` | 7 years from `createdAt` (financial audit) | Hard-delete | ⏳ |
| Saved export templates | `SavedExportTemplate` | While owner is active or until owner deletes | Owner-initiated DELETE | ✓ |
| Application logs | Render stdout | Render-managed `[FILL]` | Render-managed | ✓ |
| Atlas snapshots | Atlas-managed | Per cluster tier `[FILL]` | Atlas rotation | ✓ |
| Audit log (planned) | `AuditLog` | 7 years | Mongo TTL index | ⏳ (SEC-16) |
| Parental consent records | `[FILL: storage location]` | While enrolled + 7 years | Per storage policy | ⏳ |

## Implementation

The implementation plan for purges is tracked in
[Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md)
under SEC-20 (DocsChatLog / AIUsage) and SEC-16 (deletion audit).

Each purge job will:

- Run against Atlas Ireland during a low-traffic window.
- Delete records older than the threshold above in batches to avoid
  index thrash.
- Log row count + collection name to the audit log (when implemented).
- Skip records that are subject to a legal hold (a `holdId` flag may be
  introduced — `[FILL]`).

## Backups and restores

A retention threshold applies to the **primary store**. Atlas snapshots
are governed by Atlas's own rotation. We document this so subjects know
that an erasure request affects the live store immediately and the
snapshots within Atlas's snapshot rotation period.

## Subject erasure requests

When a subject requests erasure (PDPL Art. 15 / GDPR Art. 17):

1. DPO receives the request.
2. DPO confirms identity.
3. Engineering runs a deletion against Mongo for the named subject's
   records, including denormalised text where it identifies the subject.
4. DPO records the action and date in the audit log.
5. DPO confirms in writing to the subject within 30 days.

Atlas snapshots are not selectively deleted; they are overwritten on the
normal rotation. The DPO discloses this to the subject in the
confirmation reply.

## Change log

| Date | Change |
|---|---|
| 2026-04-26 | Initial schedule; most categories planned (⏳) pending purge automation |

## Related documents

- [Privacy Policy](01-privacy-policy.md)
- [Children's Privacy Notice](07-childrens-privacy-notice.md)
- [Data Classification & Handling](../security/03-data-classification-and-handling.md)
- [Logging & Audit Policy](../security/05-logging-and-audit-policy.md)
