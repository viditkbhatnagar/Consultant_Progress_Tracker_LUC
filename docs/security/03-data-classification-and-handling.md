# Data Classification & Handling

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]`

## Levels

| Level | Definition | Examples |
|---|---|---|
| **Public** | Could appear on a marketing site without harm | Activity-type enum values, lead-stage enum values |
| **Internal** | Operational data about Learners Education's business | Aggregate metrics, organization slugs, week numbers |
| **Confidential** | Personal data about staff or business contacts that would be embarrassing or harmful if leaked | Staff names / phones / emails, consultant phones, free-text notes that mention people |
| **Restricted** | Sensitive personal data: minors, financial, biometric, government IDs, credentials | Skillhub student DOB, parent contacts, EMI history, password hash, JWT secret, Atlas connection string |

A field's classification follows the worst-case scenario for its content.

## Field-level mapping

For full per-model coverage, see
[Data Dictionary](../engineering/03-data-dictionary.md). Highlights:

| Domain | Restricted | Confidential | Internal |
|---|---|---|---|
| Staff (`User`, `Consultant`) | password hash | name, email, phone, lastLogin | role, organization, teamName |
| Students — LUC (`Student`) | courseFee, admissionFeePaid, registrationFee, emis | studentName, phone, email, school, address, employer info, free-text notes | program, university, source, campaign, conversionTime |
| Students — Skillhub (`Student`) | DOB, courseFee, EMI history, parent phones/emails, **all minor data** | studentName, school, addressEmirate | enrollmentNumber, curriculum, academicYear, mode, subjects |
| Sales (`Commitment`, `Meeting`) | studentPhone, closedAmount, demos | studentName, free-text fields, consultantName | leadStage, status, weekNumber |
| AI traces (`ChatConversation`, `DocsChatLog`, `QueryCache`, `AIUsage`) | conversation messages and tool results when they include minors | query, answer, feedback | tier, programFilter, token counts |
| Auth (`server/.env`) | JWT_SECRET, MONGODB_URI password, OPENAI_API_KEY, GROQ_API_KEY | — | NODE_ENV, PORT |

## Handling rules

### Public

- Storage: anywhere.
- Transit: anywhere.
- Disposal: standard.

### Internal

- Storage: production-only or repo. Don't paste into personal cloud
  drives.
- Transit: TLS to/from approved systems.
- Disposal: standard.

### Confidential

- Storage: Atlas (Ireland), Render (Singapore), or laptops with FDE.
- Transit: TLS only. Email is acceptable inside Learners Education using
  staff `@learnerseducation` accounts. Never paste into external chat or
  AI tools without a written processing agreement.
- Logging: do not include in unstructured logs (gap SEC-11).
- Disposal: per [Records Retention Schedule](../legal/09-records-retention-schedule.md).
- Access: per role matrix in
  [Access Control Policy](02-access-control-policy.md).

### Restricted

- Storage: encrypted at rest (Atlas-managed today; field-level encryption
  recommended for minors' contact data — Gap Roadmap).
- Transit: TLS only. **Never** paste into external services without
  explicit DPO approval.
- Logging: never. If a stack trace contains a Restricted value, treat the
  log line as Restricted and ship to a redacted log destination.
- Disposal: per [Retention Schedule](../legal/09-records-retention-schedule.md).
  Backups must also be purged on a defined schedule.
- Access: minimum-necessary basis only. Skillhub minors' data is **never**
  visible to LUC team leads or manager (manager has read-only access via
  Export Center for the Students dataset only — see Access Control).

## Data flow boundaries

| Boundary | What crosses | Classification | Safeguard |
|---|---|---|---|
| Browser → Render Singapore | Auth headers, request bodies | Confidential / Restricted | TLS |
| Render Singapore → Atlas Ireland | Reads + writes | Confidential / Restricted | TLS, Atlas auth |
| Render Singapore → OpenAI / Groq (US) | Tool results, queries | Confidential / Restricted | TLS, vendor DPA pending (SEC-05) |
| Render stdout → Render log store | Stack traces | Variable; treat as Restricted (SEC-11) | Render-managed |
| Atlas → Snapshot (Ireland) | Database snapshot | Restricted | Atlas-managed |
| Render → engineer's laptop (debug pull) | Production data | Restricted | FDE on the laptop, ad-hoc only |

## Special handling — minors' data

Skillhub IGCSE/CBSE students are minors (age threshold confirmed by DPO
`[FILL]`). All fields under `Student.phones`, `Student.emails`,
`Student.dob`, `Student.school`, plus parent contact fields, are
**Restricted**. The
[Children's Privacy Notice](../legal/07-childrens-privacy-notice.md)
governs lawful basis (parental consent), retention, and parents' rights.

**Until DPAs (SEC-05) are signed and AI-redaction (SEC-13) is in place,
the chat drawer must not be used to query minors' personal contact
fields.** Operations workaround: counselors who must answer parent
queries do so via the standard student detail screens, not the AI chat.

## Disposal

| Mechanism | When to use |
|---|---|
| Mongoose `findByIdAndDelete` / `deleteOne` | Hard-delete entities (Student, Meeting, etc.) |
| `User.isActive = false` | Soft-delete staff accounts |
| `Commitment.isActive = false` | Soft-delete commitments |
| Cron purge (planned) | Scheduled removal of old `DocsChatLog`, `ChatConversation` per retention schedule (SEC-20) |
| Atlas snapshot rotation | Backup retention per cluster tier `[FILL]` |
| Object overwrite | Not applicable (no S3) |

## Related documents

- [Data Dictionary](../engineering/03-data-dictionary.md)
- [Privacy Policy](../legal/01-privacy-policy.md)
- [Children's Privacy Notice](../legal/07-childrens-privacy-notice.md)
- [Records Retention Schedule](../legal/09-records-retention-schedule.md)
