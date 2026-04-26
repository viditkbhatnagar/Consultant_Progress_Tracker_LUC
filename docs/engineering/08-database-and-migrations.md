# Database & Migrations

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Database

- **Engine**: MongoDB (Atlas managed)
- **Region**: Ireland (`eu-west-1`)
- **ODM**: Mongoose v9
- **Connection**: [`server/config/db.js`](../../server/config/db.js); the
  process exits if `MONGODB_URI` is missing.
- **TLS**: Atlas-default in-transit TLS.
- **At-rest encryption**: Atlas-managed (cluster-tier dependent — confirm in
  the Atlas dashboard and record `[FILL: cluster tier + encryption]`).

## Collections

17 Mongoose models, fully described in
[Data Dictionary](03-data-dictionary.md). Of those:

- 15 carry an `organization` enum and are tenant-scoped.
- `Counter` and `WeeklySummary` are currently unused (see Data Dictionary).

## Indexes

Indexes are declared on each model. Notable hot-path indexes:

| Model | Indexes |
|---|---|
| `User` | `organization` |
| `Commitment` | `(consultantName, weekNumber, year)`, `organization+status+weekStartDate`, plus `leadStage` |
| `Student` | `organization+teamLead`, `organization+source+closingDate`, `organization+status`, plus Export Center pivot indexes built in background at boot |
| `Meeting` | `organization+meetingDate`, `teamLead+meetingDate`, `consultant` |
| `HourlyActivity` | unique `(consultant, date, slotId)`, `(date)`, `(organization, date, activityType)` |
| `DailyAdmission` / `DailyReference` | unique `(consultant, date)`, `(date)` |
| `QueryCache` | `cacheKey`, TTL on `createdAt` (24h) |
| `DocsChatLog` | `userId+createdAt`, `tier+createdAt`, `programFilter+createdAt` |
| `AIUsage` | `createdAt`, `(user, createdAt)` |
| `SavedExportTemplate` | unique `(user, name)` |
| `DocChunk` | `(program, docType)`, unique `chunkId`, unique `contentHash` |

## Migration scripts

All scripts live in [`server/scripts/`](../../server/scripts/). They are
**forward-only** and **idempotent** unless noted.

| Script | Idempotent | Destructive | Purpose |
|---|---|---|---|
| `migrateOrganization.js` | Yes | No | Backfills `organization: 'luc'` on docs missing the field |
| `backfillCommitmentDate.js` | Yes | No | Sets `commitmentDate = weekStartDate` on legacy Commitment rows |
| `fixAdmissionClosedStatus.js` | Yes | No | Repairs legacy admission-closure rows |
| `seedDatabase.js` | No | **YES** — wipes DB | Dev/testing seeder; never run in prod |
| `seedSkillhub.js` | Yes | No | Skillhub-only bootstrap; safe in prod |
| `createManager.js` | Per-run | No | Adds a manager user |
| `importStudents.js` | No | Adds rows | Excel import |
| `clearAndImportStudents.js` | No | **YES** — clears students for the team | Excel import |
| `ingestProgramDocs.js` | Per-run | Replaces DocChunks | Docs RAG ingest |
| `verifyAprilCommitments.js`, `verifyRevenueApril2026.js` | Yes | No | Audit reads |

## Running a migration

```bash
cd server
MONGODB_URI="<production read-write URI>" node scripts/migrateOrganization.js
```

Run during a low-traffic window. The script logs progress per collection.

## Schema-change discipline

1. Adding a field — update the Mongoose schema; deploy code; backfill if a
   default doesn't suffice.
2. Renaming a field — add the new field in parallel, dual-write, backfill,
   switch reads, then remove the old field. Never rename in place on a live
   collection.
3. Adding an enum value — schema update, deploy. No data migration needed.
4. Removing an enum value — verify zero rows hold the value, then update the
   schema.

There is **no migration framework** (no `db-migrate`, `migrate-mongo`, etc.).
Recommended adoption tracked in
[Secure SDLC Policy](../security/09-secure-sdlc-policy.md).

## Backups

See [Backup & Disaster Recovery](../security/10-backup-and-disaster-recovery.md).

## Related documents

- [Data Dictionary](03-data-dictionary.md)
- [Architecture Overview](01-architecture-overview.md)
- [Backup & Disaster Recovery](../security/10-backup-and-disaster-recovery.md)
