# Data Dictionary

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]` + DPO `[FILL]`

## Purpose

Field-by-field reference for every Mongoose model in the application. Each
model section lists fields, types, validators, indexes, hooks, retention
behavior, and an information-classification level (Public / Internal /
Confidential / Restricted). Used by engineers, the DPO, and auditors.

## Classification levels

| Level | Meaning | Examples |
|---|---|---|
| **Public** | Could be on a marketing site without harm | Activity types, lead-stage enums |
| **Internal** | Operational data, not personal | Aggregate counts, organization slug |
| **Confidential** | Personal data of staff or business contacts | Staff names/emails/phones, consultant phone |
| **Restricted** | Sensitive personal data — minors, financial, government IDs, credentials | Student DOB, parent phones, EMI history, password hash |

A more readable cross-cut by classification lives in
[`../security/03-data-classification-and-handling.md`](../security/03-data-classification-and-handling.md).

## Model index

There are 17 models in [`server/models/`](../../server/models/):

- [User](#user)
- [Consultant](#consultant)
- [Student](#student)
- [Commitment](#commitment)
- [Meeting](#meeting)
- [HourlyActivity](#hourlyactivity)
- [DailyAdmission](#dailyadmission)
- [DailyReference](#dailyreference)
- [Notification](#notification)
- [ChatConversation](#chatconversation)
- [DocChunk](#docchunk)
- [QueryCache](#querycache)
- [DocsChatLog](#docschatlog)
- [AIUsage](#aiusage)
- [SavedExportTemplate](#savedexporttemplate)
- [Counter](#counter)
- [WeeklySummary](#weeklysummary)

## User

File: [`server/models/User.js`](../../server/models/User.js)

Login accounts for staff. Soft-delete via `isActive: false`.

| Field | Type | Validation | Classification | Notes |
|---|---|---|---|---|
| `email` | String | required, unique, lowercase, regex match (`User.js:14-17`) | Restricted (account identifier) | |
| `password` | String | required, minlength 6, `select: false` (`User.js:19-24`) | Restricted (credential) | bcryptjs salt 10 (`User.js:80-82`) |
| `name` | String | required | Confidential | |
| `role` | String enum | `admin` / `team_lead` / `manager` / `skillhub` (`User.js:30-34`) | Internal | |
| `organization` | String enum | required, default `'luc'`, indexed (`User.js:35-41`) | Internal | Tenant pin |
| `teamLead` | ObjectId → User | nullable | Internal | Hierarchy |
| `teamName` | String | trimmed | Internal | Denormalised for display |
| `phone` | String | trimmed | Confidential | Staff phone |
| `isActive` | Boolean | default `true` | Internal | Soft-delete flag |
| `lastLogin` | Date | | Confidential | Behavioural log |
| `createdAt`, `updatedAt` | Date | timestamps: true | Internal | |

**Methods**: `getSignedJwtToken()` (HS256, `User.js:85-89`), `matchPassword()` (`User.js:92-94`).
**Hooks**: `pre('save')` bcrypt hashing (`User.js:75-82`).
**Retention**: soft-delete; no auto-purge. See
[Records Retention Schedule](../legal/09-records-retention-schedule.md).

## Consultant

File: [`server/models/Consultant.js`](../../server/models/Consultant.js)

Sales / counselor staff who do not have login accounts (no User row), tracked
for performance metrics. Soft-delete via `isActive: false`.

| Field | Type | Classification | Notes |
|---|---|---|---|
| `name` | String, required | Confidential | |
| `email` | String | Confidential | Optional |
| `phone` | String | Confidential | Optional |
| `teamLead` | ObjectId → User | Internal | Owning team lead |
| `teamName` | String | Internal | Denormalised |
| `organization` | String enum | Internal | Tenant pin |
| `isActive` | Boolean | Internal | Soft-delete |
| `createdAt`, `updatedAt` | Date | Internal | |

## Student

File: [`server/models/Student.js`](../../server/models/Student.js)

Enrolled students. **Dual-mode schema**: LUC fields are required only when
`organization === 'luc'`; Skillhub fields apply to the two Skillhub branches
and frequently concern **minors** (IGCSE/CBSE).

### Identity & contact

| Field | Type | Classification | Notes |
|---|---|---|---|
| `studentName` | String, required | Confidential or Restricted | Restricted when student is a minor |
| `gender` | String enum | Confidential | |
| `dob` | Date | Restricted | Date of birth — drives age determination |
| `phone` | String | Restricted (Skillhub minors) / Confidential (LUC adult) | LUC top-level field |
| `email` | String | Confidential | LUC top-level field |
| `phones.student` | String | Restricted (when minor) | Skillhub `ContactSchema` |
| `phones.mother` | String | Restricted | Parent contact |
| `phones.father` | String | Restricted | Parent contact |
| `emails.student` | String | Restricted (when minor) | Skillhub |
| `emails.mother` | String | Restricted | Parent contact |
| `emails.father` | String | Restricted | Parent contact |
| `enrollmentNumber` | String | Confidential | Skillhub manual entry; unique per curriculum/year |
| `school` | String | Confidential | Skillhub |
| `addressEmirate` | String | Confidential | Skillhub |
| `region` | String | Internal | |
| `residence`, `area` | String | Confidential (LUC) | |
| `nationality` | String | Confidential (LUC) | |

### Academic

| Field | Type | Classification | Notes |
|---|---|---|---|
| `curriculum` | String | Internal | UI-composed (`IGCSE-Cambridge`, etc.) |
| `curriculumSlug` | String | Internal | Derived in pre-validate hook |
| `academicYear` | String enum | Internal | `2024-25 \| 2025-26 \| 2026-27` |
| `yearOrGrade` | String | Internal | Skillhub |
| `subjects` | String[] | Internal | Skillhub |
| `mode` | String enum | Internal | Online / Offline / Hybrid / OneToOne |
| `courseDuration` | String enum | Internal | |
| `program`, `university` | String | Internal | LUC |
| `studentStatus` | String enum | Internal | `new_admission \| active \| inactive` |

### Financial

| Field | Type | Classification | Notes |
|---|---|---|---|
| `courseFee` | Number | Restricted (financial) | Course price (AED) |
| `admissionFeePaid` | Number | Restricted | LUC: net or gross of UAE VAT 5% — see [VAT memory note](../legal/01-privacy-policy.md) |
| `registrationFee` | Number | Restricted | Skillhub |
| `emis[]` | EmiSchema | Restricted | Installments: `dueDate`, `amount`, `paidOn`, `paidAmount` |
| `outstandingAmount` (virtual) | Number | Restricted | `courseFee - admissionFeePaid - registrationFee - sum(emis.paidAmount)`. Virtuals do not pass through `.lean()` or `$group`; resolved in pivots via `withSkillhubFinancials` |
| `closedAmount` | Number | Restricted | LUC commitment-side |

### Sales-context

| Field | Type | Classification | Notes |
|---|---|---|---|
| `source` (LUC) / `leadSource` (Skillhub) | String enum | Internal | |
| `referredBy` | String | Confidential | May be a person's name |
| `companyName`, `designation`, `experience`, `industryType`, `deptType` | String | Confidential (LUC) | Employer info |
| `consultantName`, `teamLeadName`, `teamName` | String | Confidential | Denormalised |
| `consultant`, `teamLead`, `createdBy` | ObjectId | Internal | FK |
| `enquiryDate`, `closingDate` (LUC), `dateOfEnrollment` (Skillhub), `conversionTime` | Date / Number | Internal | |
| `campaignName`, `openDay`, `openDayLocation` | String | Internal | Marketing |

**Auto-increment**: `sno` is set per team (LUC) or per organization (Skillhub)
via `Student.getNextSno(...)`. **Indexes** (Export Center hot path) are built
in the background at boot. **Retention**: hard-delete; cascading commits and
meetings preserve a denormalised name for historical reporting. See
[Retention Schedule](../legal/09-records-retention-schedule.md).

## Commitment

File: [`server/models/Commitment.js`](../../server/models/Commitment.js)

Weekly sales / admission tracking. Soft-delete via `isActive: false`.

| Field | Type | Classification | Notes |
|---|---|---|---|
| `consultantName`, `teamName` | String (denormalised) | Confidential | |
| `teamLead`, `consultant`, `createdBy`, `lastUpdatedBy` | ObjectId | Internal | |
| `studentName`, `studentPhone` | String | Restricted (minor) / Confidential | |
| `weekNumber`, `year` | Number | Internal | ISO week, weekStartsOn=1 |
| `weekStartDate`, `weekEndDate`, `commitmentDate` | Date | Internal | `commitmentDate ∈ [weekStartDate, weekEndDate]` (non-admin); admins may set any date |
| `status` | enum | Internal | `pending / in_progress / achieved / missed` |
| `leadStage` | enum (`Commitment.LEAD_STAGES`, 12 values) | Internal | Dead → CIF + Unresponsive |
| `commitmentMade`, `commitmentAchieved`, `followUpNotes`, `commitmentVsAchieved`, `correctiveActionByTL`, `adminComment`, `reasonForNotAchieving` | String | Confidential (free-text behavioural) | May contain quoted student names |
| `followUpDate`, `expectedConversionDate` | Date | Internal | |
| `conversionProbability` | Number | Internal | |
| `closedAmount` | Number | Restricted | |
| `admissionClosed` | Boolean | Internal | Irreversible once `true` |
| `demos[]` | Subdoc (Skillhub) | Confidential | `scheduledAt`, `done`, `doneAt`, `notes` |
| `organization` | enum | Internal | Tenant pin |
| `isActive` | Boolean | Internal | Soft-delete |

**Indexes**: `(consultantName, weekNumber, year)`, plus organization +
status + weekStartDate compound. **Retention**: soft-delete; no auto-purge.

## Meeting

File: [`server/models/Meeting.js`](../../server/models/Meeting.js)

LUC-only meeting log.

| Field | Type | Classification | Notes |
|---|---|---|---|
| `studentName` | String | Confidential | |
| `program` | String | Internal | |
| `mode` | String enum | Internal | |
| `meetingDate` | Date | Internal | |
| `consultantName`, `teamLeadName` | String | Confidential | Denormalised |
| `consultant`, `teamLead`, `createdBy`, `lastUpdatedBy` | ObjectId | Internal | |
| `remarks` | String | Confidential | Free-text |
| `status` | String enum | Internal | |
| `organization` | enum | Internal | |

**Retention**: hard-delete. **Index**: `organization + meetingDate`,
`teamLead + meetingDate`, `consultant`.

> Note: `studentName` is searched via raw `$regex` interpolation at
> [`server/controllers/meetingController.js:95`](../../server/controllers/meetingController.js).
> Tracked as a P0 NoSQL-injection finding in the
> [Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## HourlyActivity

File: [`server/models/HourlyActivity.js`](../../server/models/HourlyActivity.js)

Per-consultant per-day per-slot tracking. Two shapes coexist:

- **LUC (flat)** — `activityType`, `count`, `followupCount`, `duration`
- **Skillhub (array)** — `activities[]` with mixed types including
  `sh_meeting` (duration-based, 30min–3hr)

| Field | Type | Classification | Notes |
|---|---|---|---|
| `consultant`, `loggedBy` | ObjectId | Internal | |
| `consultantName` | String | Confidential | Denormalised |
| `date` | Date | Internal | |
| `slotId` | String | Internal | Fixed enum `s0930`..`s1900` |
| `activityType`, `count`, `followupCount`, `duration` | mixed | Internal | LUC shape |
| `activities[]` | Subdoc[] | Internal | Skillhub shape |
| `note` | String | Confidential | Free-text |
| `organization` | enum | Internal | |

**Indexes**: unique `(consultant, date, slotId)`, plus `(date)` and
`(organization, date, activityType)`. **Retention**: hard-delete.

## DailyAdmission

File: [`server/models/DailyAdmission.js`](../../server/models/DailyAdmission.js)

| Field | Type | Classification |
|---|---|---|
| `consultant`, `loggedBy` | ObjectId | Internal |
| `date` | Date | Internal |
| `count` | Number | Internal |
| `organization` | enum | Internal |

Unique `(consultant, date)`. Retention: hard-delete.

## DailyReference

File: [`server/models/DailyReference.js`](../../server/models/DailyReference.js)

Same shape as DailyAdmission, different domain (referrals).

## Notification

File: [`server/models/Notification.js`](../../server/models/Notification.js)

| Field | Type | Classification | Notes |
|---|---|---|---|
| `user` | ObjectId → User | Internal | Recipient |
| `title`, `message` | String | Confidential | May contain student/lead names |
| `priority` | enum | Internal | `low / medium / high` |
| `type` | enum | Internal | `follow_up_reminder / weekly_summary / commitment_due / team_update` |
| `relatedCommitment` | ObjectId | Internal | |
| `isRead` | Boolean | Internal | |

**Retention**: hard-delete on `DELETE /api/notifications/:id` (no soft flag).

## ChatConversation

File: [`server/models/ChatConversation.js`](../../server/models/ChatConversation.js)

Tracker chat history (and indirectly Docs RAG via the same drawer).

| Field | Type | Classification | Notes |
|---|---|---|---|
| `user` | ObjectId | Internal | |
| `title` | String | Confidential | Auto-derived from first user message |
| `source` | enum | Internal | `tracker / docs` |
| `messages[]` | Subdoc[] | Restricted | role, content, toolCalls, toolResults — **may contain personal data** |
| `lastActivityAt` | Date | Internal | Compound index with `user` |

**Retention**: hard-delete — current behaviour is no auto-purge. The
[Records Retention Schedule](../legal/09-records-retention-schedule.md)
proposes a 1-year purge job.

> Tool results returned to the LLM include rows from `Student`, `Commitment`,
> `Meeting`, `Consultant`. This is the largest off-platform PII flow; see
> [Threat Model](../security/12-threat-model.md) and the
> [Sub-processor List](../legal/06-subprocessor-list.md).

## DocChunk

File: [`server/models/DocChunk.js`](../../server/models/DocChunk.js)

Persisted ingested chunks for the LUC Docs RAG corpus (16 PDFs).

| Field | Type | Classification |
|---|---|---|
| `program`, `docType`, `chunkIndex`, `chunkId`, `contentHash` | mixed | Internal |
| `content` | String | Confidential (verify PDFs) |
| `questionText`, `questionEmbedding` | mixed | Internal |
| `embedding` | Float[] | Internal |
| `organization` | enum | Internal | always `'luc'` |

Indexes: `(program, docType)`, unique `chunkId`, unique `contentHash`.
Retention: replaced on each ingest.

## QueryCache

File: [`server/models/QueryCache.js`](../../server/models/QueryCache.js)

24-hour TTL cache of Docs RAG answers.

| Field | Type | Classification | Notes |
|---|---|---|---|
| `cacheKey` | String | Internal | sha1(normalize(query) + '\|' + programFilter) |
| `query`, `answer` | String | Confidential | |
| `sources[]` | Mixed | Internal | DocChunk refs |
| `createdAt` | Date | Internal | TTL index — auto-delete after 24h |

## DocsChatLog

File: [`server/models/DocsChatLog.js`](../../server/models/DocsChatLog.js)

Per-request analytical log.

| Field | Type | Classification |
|---|---|---|
| `userId`, `userOrg` | mixed | Internal |
| `query`, `normalizedQuery` | String | Confidential |
| `programFilter` | String | Internal |
| `tier` | Number | Internal | Retrieval tier 1/2/3 |
| `sourceChunkIds[]` | mixed | Internal |
| `feedback{rating, comment}` | Subdoc | Confidential |

**Retention**: indefinite today (no TTL) — gap; the
[Retention Schedule](../legal/09-records-retention-schedule.md) proposes
13 months.

## AIUsage

File: [`server/models/AIUsage.js`](../../server/models/AIUsage.js)

Per-user AI token usage and dollar cost.

| Field | Type | Classification |
|---|---|---|
| `user` | ObjectId | Internal |
| `role`, `teamName`, `organization` | mixed | Internal |
| `model` | String | Internal |
| `promptTokens`, `completionTokens`, `totalTokens`, `cost` | Number | Confidential (financial) |
| `dateRangeQueried` | Object | Internal |

Indexes: `createdAt`, `(user, createdAt)`. Retention: indefinite today;
proposed 7 years for financial audit.

## SavedExportTemplate

File: [`server/models/SavedExportTemplate.js`](../../server/models/SavedExportTemplate.js)

User-owned saved Pivot Builder configs.

| Field | Type | Classification | Notes |
|---|---|---|---|
| `user` | ObjectId | Internal | Owner |
| `name` | String | Confidential | Unique per user |
| `dataset` | String | Internal | |
| `config` | Mixed | Confidential | Filters may include lead names |
| `organization` | enum | Internal | |

**Limit**: 200 per user (server returns 429 over the cap). **Retention**:
owner-initiated delete via `DELETE /saved-templates/:id`.

## Counter

File: [`server/models/Counter.js`](../../server/models/Counter.js)

Atomic sequence generator. **Currently unused** — was the backing store for
auto-generated Skillhub enrollment numbers before they were made manual
(commit c5effc2). Do not reuse the key
`enroll:{organization}:{IGCSE|CBSE}:{year}` without coordinating.

## WeeklySummary

File: [`server/models/WeeklySummary.js`](../../server/models/WeeklySummary.js)

**Currently unused** — model exists, no controllers or routes reference it.
Recommended action: remove or repurpose; track as P3 in the
[Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md).

## Cross-cutting facts

- **`organization` enum** — only `'luc'`, `'skillhub_training'`,
  `'skillhub_institute'` are valid (see
  [`server/config/organizations.js`](../../server/config/organizations.js)).
  A backfill script
  [`server/scripts/migrateOrganization.js`](../../server/scripts/migrateOrganization.js)
  is idempotent and safe to re-run.
- **Soft-delete vs hard-delete**: Users, Consultants, Commitments use
  `isActive: false`. Students, Meetings, HourlyActivity, DailyAdmission,
  DailyReference, Notifications, ChatConversation are hard-deleted. The
  inconsistency is documented in the
  [Retention Schedule](../legal/09-records-retention-schedule.md).
- **Denormalised names** (e.g., `consultantName`, `teamLeadName`) are
  preserved on dependent docs so historical reporting survives the deletion
  of the referenced entity.

## Related documents

- [Architecture Overview](01-architecture-overview.md)
- [API Reference](02-api-reference.md)
- [Data Classification & Handling](../security/03-data-classification-and-handling.md)
- [Records Retention Schedule](../legal/09-records-retention-schedule.md)
- [Threat Model](../security/12-threat-model.md)
