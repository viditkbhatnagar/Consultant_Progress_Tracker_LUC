# 03 — Database Schema & Configuration

This is the field-by-field reference for every one of the **27 Mongoose models** in
[`server/models/`](../../server/models/), plus the database connection configuration and the
migration/backfill scripts in [`server/scripts/`](../../server/scripts/). In this application the
data model *is* the domain model — there is no ORM layer, no service/repository abstraction, and
almost no shared validation library. Business rules live either in a schema definition or in a hand-
written check inside a controller, and several of them live in **both** because Mongoose silently
skips the schema version on update. Everything below was read directly out of the code on
**5 September 2026**; where the existing [`docs/engineering/03-data-dictionary.md`](../engineering/03-data-dictionary.md)
(last touched 2026-04-26, 207 commits ago) disagrees, this document is correct and the disagreement
is called out explicitly.

---

## Contents

1. [Connection & configuration](#1-connection--configuration)
2. [Multi-tenancy: the `organization` field](#2-multi-tenancy-the-organization-field)
3. [Model index (all 27)](#3-model-index-all-27)
4. [The traps — read this before writing any query](#4-the-traps--read-this-before-writing-any-query)
5. [Model reference — core identity & sales](#5-model-reference--core-identity--sales)
6. [Model reference — Skillhub Institute](#6-model-reference--skillhub-institute)
7. [Model reference — leadership, tiers & announcements](#7-model-reference--leadership-tiers--announcements)
8. [Model reference — AI, chat & Docs RAG](#8-model-reference--ai-chat--docs-rag)
9. [Model reference — exports & system](#9-model-reference--exports--system)
10. [Unique and compound indexes — consolidated](#10-unique-and-compound-indexes--consolidated)
11. [TTL and expiry behaviour](#11-ttl-and-expiry-behaviour)
12. [Migration & backfill scripts](#12-migration--backfill-scripts)
13. [Seed and import scripts](#13-seed-and-import-scripts)
14. [Backups](#14-backups)
15. [What the older docs get wrong](#15-what-the-older-docs-get-wrong)
16. [Related documents](#16-related-documents)

---

## 1. Connection & configuration

### 1.1 How the app connects

The entire connection layer is 14 lines:

`server/config/db.js`

```js
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
```

Called once at boot from `server/server.js:14`, before any route is mounted.

Notable properties of this setup:

| Property | Reality | Consequence |
|---|---|---|
| Connection options | **None passed.** No `maxPoolSize`, no `serverSelectionTimeoutMS`, no `retryWrites` override. | Everything is Mongoose 9 defaults + whatever is embedded in the URI query string. |
| Failure behaviour | `process.exit(1)` on initial connect failure. | Render restarts the service. A DB outage at boot = crash loop, not a degraded-mode server. |
| Reconnect | Handled by the driver (default). No custom listeners on `disconnected` / `reconnected`. | Mid-life disconnects are silent in the logs. |
| Buffering | Mongoose default (`bufferCommands: true`). | Queries issued before the connection is up are queued, not rejected. `server.js:129-144` relies on this: `docsRag.loadChunks()` is called immediately after `connectDB()` without awaiting it. |
| Database name | Comes from the path segment of `MONGODB_URI` — currently `team_progress_tracker`. | There is no `dbName` option in code, so changing databases means changing the URI. |

### 1.2 The cluster is called "dev" and it **is** production

The Atlas cluster host is `dev.gdddmth.mongodb.net`. **There is no separate development database.**
Local `npm run dev`, every one-off script in `server/scripts/`, and the live Render service all point
at the same `MONGODB_URI` and therefore the same live data.

Practical consequences you must internalise:

* Every script run is a production operation. Prefer the `--dry-run` / no-flag default that most
  scripts in `server/scripts/` implement (see [§12](#12-migration--backfill-scripts)).
* `npm run seed` (`server/scripts/seedDatabase.js:35-37`) begins with
  `User.deleteMany({})`, `Consultant.deleteMany({})`, `Commitment.deleteMany({})`. Running it "just
  to see what happens" destroys live logins, consultants and the entire commitment history.
* A local test that writes will write to production.

### 1.3 Environment variables that touch the database or model behaviour

Names only — values live in Render's environment settings and in the local `server/.env`.

| Variable | Used at | Purpose |
|---|---|---|
| `MONGODB_URI` | `server/config/db.js:5` | Full Atlas connection string incl. database name. |
| `JWT_SECRET` | `server/models/User.js:86`, `server/middleware/auth.js:25` | Signs/verifies tokens. Not DB, but `User.getSignedJwtToken()` reads it directly from the model. |
| `JWT_EXPIRE` | `server/models/User.js:87` | Token lifetime (`1h` in `.env.example`). |
| `NODE_ENV` | `server/server.js:107,149,157` | `production` serves the React build; `test` disables cron jobs and the drift monitor. |
| `PORT` | `server/server.js:119` | **Defaults to 5000, not 5001**, if `server/.env` is absent. |
| `DOCS_RAG_CACHE_TTL_SECONDS` | `server/config/docsRagConfig.js:25` → `server/models/QueryCache.js:41` | **Read at require-time and baked into a MongoDB TTL index.** See [§11](#11-ttl-and-expiry-behaviour). |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` | `server/services/s3.js` | Nightly DB snapshot destination + tier-image storage. Snapshot is skipped entirely if unset (`server/server.js:161-170`). |
| `OPENAI_API_KEY`, `GROQ_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `GROQ_CHAT_MODEL`, `LLM_PRIMARY`, `LLM_FALLBACK` | `server/config/docsRagConfig.js`, `server/services/aiService.js` | Populate `AIUsage`, `DocChunk.embedding`, `DocsChatLog`. |
| `DOCS_RAG_ENABLED`, `DOCS_RAG_TOPK`, `DOCS_RAG_MIN_SCORE`, `DOCS_RAG_EXACT_MATCH_THRESHOLD` | `server/config/docsRagConfig.js` | Retrieval tuning; not schema-affecting. |
| `EXCEL_PATH`, `DRY_RUN`, `YEAR`, `WIPE_YEAR`, `ENV_PATH` | Various scripts in `server/scripts/` | Script-only inputs. |

> **Security note, no values reproduced here:** `server/.env.example` (committed to the repo)
> contains a **fully-populated, real-looking Atlas connection string including username and
> password**, not a placeholder. Treat that credential as compromised — it is in git history. The
> rotation runbook is in [11 — Credentials & Access Handover](11-credentials-and-access-handover.md).

### 1.4 Index creation

No model sets `autoIndex: false` and nothing calls `syncIndexes()` or `createIndexes()` anywhere in
the codebase (verified by grep across `server/` excluding `node_modules`). That means:

* Mongoose builds every declared index **in the background on every boot**, against production.
* Adding an index to a schema and deploying is the whole migration — there is no separate step.
* **Dropping** an index from a schema does *nothing* to the database. Removed indexes linger in Atlas
  forever until someone drops them by hand. If you rename an index's key set, expect the old one to
  still be there.
* A `unique: true` added to a schema that already has duplicate data will fail the background build
  silently (logged by the driver, not surfaced by the app). Always check for duplicates first — see
  `server/scripts/auditStudents.js:72-77` for the pattern.

### 1.5 Mongoose 9 / Express 5 notes that affect data code

* `mongoose@^9.0.0` (`server/package.json:36`). **Pipeline updates require the raw collection** —
  `server/scripts/backfillCommitmentDate.js:43-46` documents this and uses
  `Commitment.collection.updateMany(filter, [ ... ])`.
* `updateMany` / `updateOne` **do not run enum validators**
  (`server/scripts/renamePaymentPlanApproved.js:22`).
* `bulkWrite` upserts **do not run Mongoose validators at all**, even with `runValidators: true`.
  The Institute Tests feature works around this with a hand-written `toNonNegativeNumber()` guard in
  `server/controllers/instituteController.js`. If you add a bulk path, you must re-implement the
  schema's constraints in JS.
* Document `pre('validate')` / `pre('save')` hooks **do not run** on `findByIdAndUpdate`,
  `updateOne`, `updateMany`, or `bulkWrite`. This is the root cause of trap
  [4.3](#43-derived-fields-drift-because-hooks-dont-run-on-update).

---

## 2. Multi-tenancy: the `organization` field

### 2.1 The enum

`server/config/organizations.js` is the single source of truth:

```js
const ORG_LUC = 'luc';
const ORG_SKILLHUB_TRAINING = 'skillhub_training';
const ORG_SKILLHUB_INSTITUTE = 'skillhub_institute';
const ORGANIZATIONS = [ORG_LUC, ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];
const SKILLHUB_ORGS = [ORG_SKILLHUB_TRAINING, ORG_SKILLHUB_INSTITUTE];
const isSkillhub = (org) => SKILLHUB_ORGS.includes(org);
const isLuc = (org) => org === ORG_LUC;
```

There is **no** `'all'` organization at the data layer. `'all'` exists only as an *export scope*
value (see `SavedExportTemplate` in [§9](#9-model-reference--exports--system)) and as a query
parameter meaning "don't filter".

### 2.2 Which collections carry `organization` — and which don't

**21 of 27 models have an `organization` field. 6 do not.** Knowing which is which is the difference
between a correctly-scoped query and a cross-tenant data leak.

| Model | `organization`? | Enum source | Default | Indexed | Notes |
|---|---|---|---|---|---|
| `User` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `Consultant` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `Student` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. Drives the whole dual-mode schema. |
| `Commitment` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `Meeting` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `HourlyActivity` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `DailyAdmission` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `DailyReference` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Required. |
| `PaymentPlan` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | LUC-only in practice. |
| `Announcement` | ✅ | `ORGANIZATIONS` | `luc` | ❌ (compound only) | Required. |
| `Tier` | ✅ | `ORGANIZATIONS` | `luc` | ❌ (compound only) | Required. |
| `TierImage` | ✅ | `ORGANIZATIONS` | `luc` | ❌ (compound only) | Required. |
| `DocChunk` | ✅ | `ORGANIZATIONS` | `luc` | ✅ | Always `luc` — the RAG corpus is LUC-only. |
| `Teacher` | ✅ | `ORGANIZATIONS` | **`skillhub_institute`** | ✅ | Institute-only. |
| `TimetableEntry` | ✅ | `ORGANIZATIONS` | **`skillhub_institute`** | ✅ | Institute-only. |
| `Attendance` | ✅ | `ORGANIZATIONS` | **`skillhub_institute`** | ✅ | Institute-only. |
| `TestRecord` | ✅ | `ORGANIZATIONS` | **`skillhub_institute`** | ✅ | Institute-only. |
| `InstituteEnrollment` | ✅ | `ORGANIZATIONS` | **`skillhub_institute`** | ✅ | Institute-only. |
| `TeamMonthlyEntry` | ⚠️ | **Hardcoded `['luc']`** | `luc` | ✅ | Enum does not import `ORGANIZATIONS`. Only LUC can ever be stored. Deliberate (Leadership dashboards are LUC-only) but it is schema drift. |
| `AIUsage` | ⚠️ | **Plain `String`, no enum** | `''` | ❌ | Free text. A typo here is stored happily. Populated from `req.user` at the service layer. |
| `SavedExportTemplate` | ⚠️ | **Hardcoded** `['luc','skillhub_training','skillhub_institute','all']` | `luc` | ❌ | Includes the pseudo-org `'all'`. Does not import `ORGANIZATIONS`; adding a fourth real org means editing this file too. |
| `Notification` | ❌ | — | — | — | Scoped only through `user` (a `User` ref, which carries the org). |
| `ChatConversation` | ❌ | — | — | — | Scoped only through `user`. |
| `DocsChatLog` | ❌ (has `userOrg`) | Plain `String` | — | ❌ | `userOrg` is a denormalised snapshot, not the tenancy key. |
| `QueryCache` | ❌ | — | — | — | Global cache; keyed by `sha1(normalizedQuery + '|' + programFilter)`. LUC-only in practice because only LUC can reach the docs chat. |
| `WeeklySummary` | ❌ | — | — | — | **Dead code** — see [§9](#9-model-reference--exports--system). |
| `Counter` | ❌ | — | — | — | **Legacy / unused** — see [§9](#9-model-reference--exports--system). |

**Practical rule:** if a model has no `organization`, you cannot scope it with `buildScopeFilter`.
`Notification` and `ChatConversation` must be scoped by `user`; anything else needs a manual join.

### 2.3 The three scoping helpers

All in `server/middleware/auth.js`. Controllers call these by hand — there is no automatic query
middleware, so a new controller that forgets them has no tenant isolation at all.

**`buildScopeFilter(req)` — `auth.js:69-86`**

```js
if (user.role === 'admin') {
    if (req.query && req.query.organization) filter.organization = req.query.organization;
} else {
    filter.organization = user.organization;
}
if (user.role === 'team_lead' || user.role === 'skillhub') {
    filter.teamLead = user._id;
}
```

* `admin` → `{}` (everything) unless they opt in with `?organization=`.
* `manager` → `{ organization: 'luc' }` (its stored org), no ownership filter.
* `team_lead` / `skillhub` → `{ organization: <own>, teamLead: <own _id> }`.

**`canAccessDoc(user, doc)` — `auth.js:91-100`** — the single-document equivalent, used on
GET-by-id / PUT / DELETE. Admin always passes; others must match `organization`, and
team_lead/skillhub must additionally own the `teamLead` FK. Note the `doc.organization &&` guard:
**a document without an `organization` field passes the org check unconditionally.**

**`resolveOrganization(req)` — `auth.js:105-110`** — for creates. Non-admin: `req.user.organization`
(body ignored). Admin: `req.body.organization || 'luc'`.

### 2.4 Feature-level org gates

Two additional gates exist beyond the generic helpers:

* `server/middleware/orgGate.js` — used as `orgGate('luc')` on the Docs RAG routes and the static
  `/program-docs/*` mounts (`server/server.js:59-96`).
* `assertInstitute(req, res)` — `server/controllers/instituteController.js:22-28`. Called at the top
  of **every** Institute handler. Admin passes; a `skillhub` login passes only if
  `user.organization === 'skillhub_institute'`. A **Training** branch login gets a 403 even though
  the route-level `authorize('admin','skillhub')` let it through.

---

## 3. Model index (all 27)

Collection names follow Mongoose's default pluralisation. The ones marked ✔ are confirmed against
raw-driver usage in scripts (`server/scripts/importInstituteFromExcel.js:237-239`,
`server/scripts/normalizeInstituteSubjects.js:30`, `server/scripts/roundSkillhubWholeAed.js:26`);
the rest are derived from the pluralisation rule and are **UNVERIFIED against the live database** —
if you need certainty, run `server/scripts/runDbSnapshot.js`, which prints every real collection
name.

| # | Model | Collection | Org? | Status | Purpose |
|---|---|---|---|---|---|
| 1 | `User` | `users` | ✅ | live | Login accounts (4 roles). Soft-delete via `isActive`. |
| 2 | `Consultant` | `consultants` | ✅ | live | Sales consultants / counsellors. **No login.** Soft-delete. |
| 3 | `Student` | `students` ✔ | ✅ | live | Admitted students. Dual-mode LUC/Skillhub schema. |
| 4 | `Commitment` | `commitments` | ✅ | live | Weekly sales commitments + Skillhub demo slots. |
| 5 | `Meeting` | `meetings` | ✅ | live | Meeting Tracker rows. |
| 6 | `HourlyActivity` | `hourlyactivities` | ✅ | live | Per-consultant per-slot daily activity. |
| 7 | `DailyAdmission` | `dailyadmissions` | ✅ | live | Per-consultant per-day admission count. |
| 8 | `DailyReference` | `dailyreferences` | ✅ | live | Per-consultant per-day reference count. |
| 9 | `PaymentPlan` | `paymentplans` | ✅ | live | LUC payment-plan approval workflow. |
| 10 | `Notification` | `notifications` | ❌ | live | Per-user in-app bell notifications. |
| 11 | `Announcement` | `announcements` | ✅ | live | Org-wide dashboard banner with per-user ack. |
| 12 | `Teacher` | `teachers` ✔ | ✅ | live | Institute faculty. No login. |
| 13 | `TimetableEntry` | `timetableentries` ✔ | ✅ | live | Recurring weekly Institute class sessions. |
| 14 | `Attendance` | `attendances` ✔ | ✅ | live | Institute per-student per-session attendance. |
| 15 | `TestRecord` | `testrecords` ✔ | ✅ | live | Institute weekly test results. |
| 16 | `InstituteEnrollment` | `instituteenrollments` | ✅ | live | Durable class-roster membership. |
| 17 | `TeamMonthlyEntry` | `teammonthlyentries` | ⚠️ luc-only | live | Manual Excel-replica leadership numbers. |
| 18 | `Tier` | `tiers` | ✅ | live | Tier Fight competition groups. |
| 19 | `TierImage` | `tierimages` | ✅ | live | AI-generated tier posters (S3-backed). |
| 20 | `AIUsage` | `aiusages` | ⚠️ free text | live | OpenAI/Groq token + cost ledger. |
| 21 | `ChatConversation` | `chatconversations` | ❌ | live | Tracker + docs chatbot threads. |
| 22 | `DocChunk` | `docchunks` | ✅ (always luc) | live | RAG corpus chunks + embeddings. |
| 23 | `QueryCache` | `querycaches` | ❌ | live | 24h TTL cache of docs-chat answers. |
| 24 | `DocsChatLog` | `docschatlogs` | ❌ (`userOrg`) | live | One row per docs-chat request. |
| 25 | `SavedExportTemplate` | `savedexporttemplates` | ⚠️ own enum | live | User-saved Pivot Builder configs. |
| 26 | `WeeklySummary` | `weeklysummaries` | ❌ | **DEAD** | Zero references outside its own file. |
| 27 | `Counter` | `counters` | ❌ | **LEGACY / UNUSED** | Was the enrollment-number sequencer. |

---

## 4. The traps — read this before writing any query

These have each caused a real production bug. They are listed in order of how much damage they can do.

### 4.1 Conditional `required` silently passes on update (the big one)

`Student.js:50-55` defines two predicate functions used as `required` validators:

```js
const lucOnly       = function () { return isLuc(this.organization); };
const skillhubOnly  = function () { return isSkillhub(this.organization); };
```

They are used like `program: { type: String, required: lucOnly, trim: true }`
(`Student.js:112`) and `curriculum: { ..., required: skillhubOnly }` (`Student.js:148-152`).

**On `.save()` this works.** `this` is the document, `this.organization` is populated, the predicate
returns the right answer.

**On `findByIdAndUpdate` / `findOneAndUpdate` / `updateOne` it does not.** Mongoose runs update
validators in **query context**: `this` is the `Query`, not a document, so `this.organization` is
`undefined`. `isLuc(undefined)` is `false`, `isSkillhub(undefined)` is `false` — **so every
conditional `required` evaluates to "not required" and passes**, even with
`runValidators: true`. You can null out `program` on a LUC student, or `curriculum` on a Skillhub
student, and Mongoose will happily save it.

**Every field below is affected.** Any of them can be blanked via an update path that doesn't
re-check in JS:

| Model | `required: lucOnly` | `required: skillhubOnly` |
|---|---|---|
| `Student` | `month`, `program`, `university`, `courseFee`, `source`, `enquiryDate`, `closingDate`, `residence`, `area`, `nationality`, `companyName`, `designation`, `experience`, `industryType`, `deptType` | `enrollmentNumber`, `curriculum`, `yearOrGrade`, `academicYear`, `mode`, `courseDuration` |
| `Meeting` | `program` | — |

**The mitigation is a hand-written JS re-check in the controller.** The canonical example is
`server/controllers/meetingController.js:298-314`, which includes the explanation in a comment:

```js
// The schema's `required: lucOnly` on `program` cannot run here:
// findByIdAndUpdate validators execute with query context, so
// `this.organization` is undefined and the rule silently passes.
const effectiveOrg =
    (req.user.role === 'admin' && req.body.organization) || meeting.organization;
if ('program' in req.body && isLuc(effectiveOrg) && !String(req.body.program || '').trim()) {
    return res.status(400).json({ success: false, message: 'Program is required' });
}
```

`updateStudent` takes a different approach (`server/controllers/studentController.js:487-494`): it
merges the incoming patch over `student.toObject()` and runs `validateStudentPayload(merged, {
isUpdate: true })` against the merged state. That covers the money rules but **does not currently
re-check every conditional `required` field** — `program`, `university`, `source` etc. can still be
cleared through the Students update endpoint. Treat that as a known gap, not a guarantee.

> **Rule for any new code:** if you add a `required: <predicate>` field, you must also add a JS
> re-check in every controller that updates that model. If you add a new update endpoint for
> `Student` or `Meeting`, you must port the re-checks.

The `Meeting.program` case is covered by specs at `server/tests/meetings/meetings.test.js`.

### 4.2 `outstandingAmount` is a virtual — it does not survive `.lean()` or `$group`

`Student.js:350-361`:

```js
StudentSchema.virtual('outstandingAmount').get(function () {
    if (!isSkillhub(this.organization)) return 0;
    const paidEmi = (this.emis || []).reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    const totalPaid = (this.admissionFeePaid || 0) + (this.registrationFee || 0) + paidEmi;
    return Math.max(0, (this.courseFee || 0) - totalPaid);
});
```

It reaches the client only because the schema sets
`{ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }` (`Student.js:293`)
**and** `studentController.js` never calls `.lean()` on its student queries (verified: zero `.lean()`
calls in that file).

It **disappears** in three situations:

1. **`.lean()`** — returns plain POJOs, no getters. The Export Center raw path hits this and
   recomputes by hand: `server/services/exports/pivots/students.js:236-244`.
2. **Aggregation `$group` / `$match`** — the field does not exist in storage, so Mongo cannot see it.
   Every Skillhub export pipeline therefore runs `withSkillhubFinancials(pipeline)`
   (`server/services/exports/pivots/_shared.js:6-50`) which `$addFields` the real columns
   `emiPaid`, `totalPaidPerStudent`, `outstandingPerStudent`, `overdueEmiCount` before grouping.
3. **Any `.select()` that omits the inputs** — the getter needs `courseFee`, `admissionFeePaid`,
   `registrationFee`, `emis`. `students.js:210-215` explicitly re-adds those four to the projection
   whenever `outstandingAmount` is a requested column.

**Never write a new aggregation that references `outstandingAmount`.** Use
`withSkillhubFinancials()` and reference `outstandingPerStudent`.

Note the naming asymmetry that will bite you: the *virtual* is `outstandingAmount`; the *aggregation
field* is `outstandingPerStudent`. Client column configs use `outstandingAmount`
(`client/src/config/exportColumns/students.js:38`).

### 4.3 Derived fields drift because hooks don't run on update

`Student.js:298-338` is a `pre('validate')` hook that derives `conversionTime`, `month` (LUC) and
`curriculumSlug` (Skillhub). It runs on `.save()` **only**.

Three separate pieces of code have had to re-implement it:

| Derived field | Hook (authoritative) | Re-implementation | Status |
|---|---|---|---|
| `conversionTime` | `Student.js:301-306` | `studentController.js:562-566` | In sync. |
| `month` | `Student.js:307-316` — uses **`getUTCMonth()`** | `studentController.js:571` — uses **`getMonth()`** (local time) | ⚠️ **Divergent.** The hook was deliberately switched to UTC (comment at `Student.js:312-314`) so a UTC-midnight `closingDate` labels correctly regardless of server TZ. The update path was not. On a server west of UTC, editing a student's dates can label them with the previous month. |
| `curriculumSlug` | `Student.js:321-329` — board = `curriculum.split('-')[0]`, valid slugs `CBSE / IGCSE / IELTS / GRE / SAT` | `studentController.js:556-558` — `startsWith('IGCSE') ? 'IGCSE' : 'CBSE'` | ⚠️ **Divergent and wrong.** Editing a student whose curriculum is `IELTS`, `GRE` or `SAT` writes `curriculumSlug: 'CBSE'`, filing them under the CBSE tab. The hook's comment at `Student.js:323-326` explicitly warns against exactly this behaviour. |

There is a repair script for one of these: `server/scripts/recomputeStaleConversionTime.js`. There is
**no** repair script for the `curriculumSlug` drift.

`server/scripts/backfillStudentDateTimezone.js` exists because an earlier version of this same class
of bug (local-midnight `Date` → `toISOString()` → previous UTC day at 20:00) mislabelled `month` on
LUC rows. `server/scripts/backfillMeetingDateTimezone.js` is the same fix for `Meeting.meetingDate`.
**All date fields the UI writes are expected to be UTC midnight.** If you add a date picker, pin it.

### 4.4 `sno` is generated with a read-then-write race

`Student.js:341-347`:

```js
StudentSchema.statics.getNextSno = async function (teamLeadId, organization) {
    const filter = organization && organization !== ORG_LUC
        ? { organization }
        : { teamLead: teamLeadId };
    const last = await this.findOne(filter).sort({ sno: -1 }).select('sno');
    return last ? last.sno + 1 : 1;
};
```

Called once, at `server/controllers/studentController.js:396`.

* Scope differs by tenant: **LUC = per team lead**, **Skillhub = per organization**.
* There is **no unique index on `sno`** anywhere in the schema. Two concurrent creates in the same
  scope will both read the same max and both write the same `sno`. Nothing rejects it.
* This is the job `Counter` used to do. `Counter.increment()` is atomic
  (`findOneAndUpdate` + `$inc` + `upsert`) but is no longer wired to anything.

If duplicate serials become a problem, the fix is to route `getNextSno` through `Counter`, not to
add a unique index to a collection that already has duplicates.

### 4.5 `enrollmentNumber` is `unique + sparse` and globally scoped

`Student.js:140-147`:

```js
enrollmentNumber: { type: String, index: true, sparse: true, unique: true,
                    required: skillhubOnly, trim: true },
```

* **Unique across the entire `students` collection**, not per organization. A Training and an
  Institute student cannot share a number.
* `sparse` means documents *missing* the field are excluded from the index — that is what lets
  ~all LUC rows coexist. **But `sparse` does not exclude empty strings.** If any code path ever
  writes `enrollmentNumber: ''`, the *second* such write fails with `E11000`.
  `server/scripts/auditStudents.js:58` explicitly counts `'' | null` as "missing enrollment", so the
  condition has been seen in the data.
* It is **manually typed by the counsellor**. The UI hints the shape `SH/IGCSE/26/11/042` but nothing
  enforces it. The auto-generation pre-validate hook was removed in commit `c5effc2`.
* Duplicate check: `server/scripts/auditStudents.js:72-77`.

### 4.6 `admissionClosed` is irreversible, and closed rows are pinned to `achieved`

`Commitment.admissionClosed` has no schema-level guard — it is a plain `Boolean`. The rules are
entirely in `server/controllers/commitmentController.js`:

* `:297-302` — setting `admissionClosed: false` on a row that is already `true` returns **400
  "Cannot reopen a closed admission - this action is irreversible"**.
* `:309-318` — sending any `status` other than `'achieved'` on a closed row returns **400 "This
  admission is closed - its status stays Achieved"**. Without this, `admissionClosed: true` +
  `status: 'missed'` would be storable, and every `achieved || admissionClosed` aggregate would
  count it inconsistently.
* `:213-222` and `:283-292` — the controller *auto-flips* `admissionClosed = true` (and stamps
  `admissionClosedDate = new Date()`) when `leadStage === 'Admission'` and `status === 'achieved'`,
  even if the client didn't tick the box.

A raw `updateOne` bypasses all three. Specs: `server/tests/commitments/admissionLock.test.js`.
Repair script for historical inconsistency: `server/scripts/fixAdmissionClosedStatus.js`.

### 4.7 `Commitment.description` is a phantom alias

`Commitment.js:133-143` defines `description` as a **real schema path** whose getter returns
`commitmentMade` and whose setter writes `commitmentMade`:

```js
description: {
    type: String, trim: true,
    get: function () { return this.commitmentMade; },
    set: function (value) { this.commitmentMade = value; }
},
```

Consequences:

* The stored `description` value is always `undefined`/absent — the setter never assigns to itself.
* Reading `doc.description` through a Mongoose document returns `commitmentMade`.
* Reading it through `.lean()` or an aggregation returns **nothing**, because there is no stored
  value.
* Getters do not fire on `toJSON` unless `toObject: { getters: true }` is set — and it is not on this
  schema. So the API response for a commitment has **no** `description` field.

Treat `description` as write-only sugar. Always read/query `commitmentMade`.

### 4.8 626 LUC students are hidden from every list and aggregate

`applyHideLucZeroFeeFilter(filter)` — `server/controllers/studentController.js:58-73`:

```js
const guard = { $or: [ { organization: { $ne: 'luc' } }, { admissionFeePaid: { $gt: 0 } } ] };
```

Merged into `$and` on every Students list, KPI and export query (LUC and `'all'` scopes alike;
Skillhub rows are never affected). It hides ~626 LUC rows where `admissionFeePaid` is `0`/null/unset
— the residue of an importer bug. **The rows are still in the database.** There is no UI toggle to
show them. A backup dump exists at
`server/dumps/luc_zero_admission_fee_20260423125500.json`.

If a stakeholder says "the student count is wrong", this is almost certainly why.

### 4.9 `HourlyActivity` has two mutually-incompatible shapes

The same collection stores two shapes:

* **Legacy / LUC** — flat `activityType` + `count` + `duration`.
* **Multi-activity / Skillhub** — an `activities[]` array; the flat fields mirror the *first* item
  only, for backwards compatibility (`HourlyActivity.js:52-67`).

There are exactly two normalisers, and you must use one of them rather than writing a third:

| Layer | Helper | Location |
|---|---|---|
| Aggregation | `normalizeHourlyActivities(pipeline)` → emits `activityTypeNorm` / `countNorm` / `durationNorm` after `$unwind` | `server/services/exports/pivots/_shared.js` |
| JS | `getActivityItems(doc)` | `server/controllers/hourlyController.js:88-103` |

### 4.10 `Skillhub subjects` is an array — `count` double-counts

`Student.subjects` is `[String]`. Any pivot that `$unwind`s it and then uses `agg=count` is counting
*subject enrolments*, not students. The Export Center UI shows a disclaimer for `count`/`sum`;
`agg=distinct` runs `$addToSet: '$_id'` then `$size` for true student counts.

---

## 5. Model reference — core identity & sales

### 5.1 `User` — `server/models/User.js`

Login accounts. There are only four roles and **consultants do not have accounts** — they are
`Consultant` documents.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `email` | String | ✅ | — | `unique: true`, lowercased, trimmed, regex-validated (`:14-17`). |
| `password` | String | ✅ | — | `minlength: 6`, **`select: false`** — never returned unless explicitly `.select('+password')`. bcrypt hash. |
| `name` | String | ✅ | — | Trimmed. |
| `role` | String | ✅ | — | Enum `admin` \| `team_lead` \| `manager` \| `skillhub`. |
| `organization` | String | ✅ | `luc` | Enum `ORGANIZATIONS`. Indexed. |
| `teamLead` | ObjectId → `User` | ❌ | `null` | Self-reference. Mostly unused; the org's actual hierarchy is `Consultant.teamLead`. |
| `teamName` | String | ❌ | — | Trimmed. Denormalised onto every dependent doc. |
| `phone` | String | ❌ | — | Trimmed. |
| `isActive` | Boolean | ❌ | `true` | **Soft delete.** `protect` rejects `isActive: false` with 401 (`auth.js:36-41`). |
| `lastLogin` | Date | ❌ | — | Set by the auth controller. |
| `createdAt` / `updatedAt` | Date | auto | — | `{ timestamps: true }`. |

**Hooks**

* `pre('save')` (`:75-82`) — bcrypt-hashes `password` with a cost-10 salt, but only
  `if (this.isModified('password'))`. **This does not run on `findByIdAndUpdate`.** Any admin
  password-reset path must use `.save()`, or it will store the plaintext. (`server/scripts/resetBahrainPassword.js`
  is the reference implementation.)

**Methods**

* `getSignedJwtToken()` (`:85-89`) — signs `{ id, role }` only. **`organization` is NOT in the
  token**; `protect` reloads the full user from the DB on every request (`auth.js:27`), so an org
  change takes effect immediately without re-login. That also means every authenticated request
  costs one `User.findById`.
* `matchPassword(entered)` (`:92-94`) — `bcrypt.compare`.

**Indexes** — `email` unique (implicit), `organization` (implicit).

---

### 5.2 `Consultant` — `server/models/Consultant.js`

Sales consultants (LUC) / counsellors (Skillhub). **No login account.** Referenced by name string on
most historical rows so a deleted consultant doesn't erase history.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum `ORGANIZATIONS`, indexed. |
| `name` | String | ✅ | — | Trimmed. |
| `email` | String | ❌ | — | Lowercased, trimmed. Not unique. |
| `phone` | String | ❌ | — | |
| `teamName` | String | ✅ | — | |
| `teamLead` | ObjectId → `User` | ✅ | — | The owning team lead. |
| `isActive` | Boolean | ❌ | `true` | Soft delete. |
| `excludeFromHourly` | Boolean | ❌ | `false` | Hides them from the Hourly Tracker grid while keeping them assignable on the student form. Set by `server/scripts/excludeLegacyHourly.js`. |
| `createdAt` | Date | ❌ | `Date.now` | **Manual field, not `timestamps`.** |
| `updatedAt` | Date | ❌ | `Date.now` | Manual. Refreshed by a `pre('save')` hook (`:58-60`) — which **does not run on `findByIdAndUpdate`**, so `updatedAt` is unreliable on this model. |

**Indexes** — `organization` (implicit) only.

---

### 5.3 `Student` — `server/models/Student.js` (377 lines, the most complex model)

Admitted student records. **Dual-mode**: a LUC student and a Skillhub student are stored in the same
collection with two almost disjoint field sets, gated by `organization`. Read
[§4.1](#41-conditional-required-silently-passes-on-update-the-big-one) before touching it.

#### Enum constants (defined at the top of the file, `:9-48`)

| Constant | Values |
|---|---|
| `SKILLHUB_SUBJECTS` | Math, Science, Physics, Chemistry, Biology, Accounting, Business Studies, Economics, English, JEE, NEET |
| `SKILLHUB_CURRICULA` | CBSE, IGCSE-Cambridge, IGCSE-Edexcel, IGCSE-AQA, IELTS, GRE, SAT |
| `SKILLHUB_CURRICULUM_SLUGS` | CBSE, IGCSE, IELTS, GRE, SAT |
| `SKILLHUB_MODES` | Online, Offline, Hybrid, OneToOne |
| `SKILLHUB_COURSE_DURATIONS` | Monthly, OneYear, TwoYears |
| `SKILLHUB_LEAD_SOURCES` | Google, FacebookMeta, Instagram, School, Reference, Walk-In, Tele-Inquiry |
| `STUDENT_STATUSES` | new_admission, active, inactive |
| `ACADEMIC_YEARS` | 2024-25, 2025-26, 2026-27 |

> ⚠️ `SKILLHUB_SUBJECTS` (on `Student`) and `INSTITUTE_SUBJECTS` (in
> `server/config/instituteSubjects.js`) are **two different lists** — e.g. the student form offers
> `Accounting`, the Institute canonical list uses `Accountancy`; the Institute list has `IELTS` and
> `Mechanics`, the student list has `JEE` and `NEET`. They are not reconciled.

#### Sub-schemas

**`ContactSchema`** (`:57-64`, `_id: false`) — used for `phones` and `emails`:
`{ student: String='', mother: String='', father: String='' }`, all trimmed.

**`EmiSchema`** (`:66-71`, **has `_id`**):
`{ dueDate: Date, amount: Number=0 min 0, paidOn: Date=null, paidAmount: Number=0 min 0 }`.

#### Fields

**Tenancy & serials**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum `ORGANIZATIONS`, indexed. Controls every conditional below. |
| `sno` | Number | ✅ | — | Per-team (LUC) or per-org (Skillhub). **Not unique.** See [§4.4](#44-sno-is-generated-with-a-read-then-write-race). |
| `month` | String | `lucOnly` | — | Full English month name. Derived in `pre('validate')` from `closingDate`. |

**Common identity**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `studentName` | String | ✅ (always) | — | Trimmed. |
| `gender` | String | ✅ (always) | — | Enum `Male` \| `Female`. **No other value is storable** — including for Skillhub minors. |
| `dob` | Date | ❌ | — | Drives the birthday-notification cron. |
| `phone` | String | ❌ | `''` | LUC single contact. |
| `email` | String | ❌ | `''` | Lowercased. |
| `phones` | `ContactSchema` | ❌ | `{}` | Skillhub 3-contact (student/mother/father). |
| `emails` | `ContactSchema` | ❌ | `{}` | Skillhub 3-contact. |

**LUC academic**

| Field | Type | Required | Notes |
|---|---|---|---|
| `program` | String | `lucOnly` | Free text (the distinct values back the Meeting Tracker dropdown — `studentController.js:80-90`). |
| `certificate` | String | ❌ | Enum `KHDA` \| `AGI` \| `KHDA + AGI`. |
| `university` | String | `lucOnly` | Enum: `Swiss School of Management (SSM)`, `Knights College`, `Malaysia University of Science & Technology (MUST)`, `AGI – American Global Institute (Certifications)`, `CMBS`, `OTHM`. Note the **en-dash** in the AGI value. |

**Skillhub academic**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `studentStatus` | String | ❌ | `new_admission` | Enum `STUDENT_STATUSES`. Indexed. |
| `enrollmentNumber` | String | `skillhubOnly` | — | **`unique` + `sparse`.** See [§4.5](#45-enrollmentnumber-is-unique--sparse-and-globally-scoped). |
| `curriculum` | String | `skillhubOnly` | — | Enum `SKILLHUB_CURRICULA`. Composed in the UI from cascading Board + IGCSE-variant dropdowns. |
| `curriculumSlug` | String | ❌ | — | Enum `SKILLHUB_CURRICULUM_SLUGS`. Derived. See [§4.3](#43-derived-fields-drift-because-hooks-dont-run-on-update). |
| `yearOrGrade` | String | `skillhubOnly` | — | Free text ("Grade 9", "Year 10"). |
| `academicYear` | String | `skillhubOnly` | — | Enum `ACADEMIC_YEARS` — **hardcoded, ends at 2026-27.** Will need extending. |
| `subjects` | `[String]` | ❌ | `[]` | Each element enum `SKILLHUB_SUBJECTS`. |
| `school` | String | ❌ | `''` | |
| `mode` | String | `skillhubOnly` | — | Enum `SKILLHUB_MODES`. |
| `courseDuration` | String | `skillhubOnly` | — | Enum `SKILLHUB_COURSE_DURATIONS`. |

**Fees** (all AED)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `courseFee` | Number | `lucOnly` | `0` | `min: 0`. |
| `admissionFeePaid` | Number | ❌ | `0` | `min: 0`. ⚠️ **LUC values mix net-of-VAT and gross-of-VAT** (UAE VAT 5%) — roughly a 50/50 split across ~348 rows. No backfill was done; the Export Center adds a disclaimer row instead. Also the field behind [§4.8](#48-626-luc-students-are-hidden-from-every-list-and-aggregate). |
| `feesPaid` | String | ❌ | — | Enum `Partial registration fees` \| `Full registration fees`. LUC. Optional so legacy rows pass. |
| `modeOfPayment` | String | ❌ | — | Enum `Gateway` \| `Cash` \| `Bank Transfer` \| `Tabby` \| `Installment Payments` \| `POS`. Both tenants. |
| `registrationFee` | Number | ❌ | `0` | `min: 0`. |
| `emis` | `[EmiSchema]` | ❌ | `[]` | Skillhub instalment plan. |

**Lead source**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `source` | String | `lucOnly` | — | 14-value enum: `Google Ads`, `Facebook`, `Tik Tok`, `Call-In`, `Old Crm`, `Linkedin`, `Whatsapp`, `Alumni`, `Seo`, `Instagram`, `Reference`, `B2C`, `Open Day`, `Re-Registration`. Note the irregular casing — these are exact strings. |
| `leadSource` | String | ❌ | — | Skillhub. Enum `SKILLHUB_LEAD_SOURCES`. |
| `referredBy` | String | ❌ | `''` | |
| `openDay` / `openDayLocation` | String | ❌ | `''` | |
| `campaignName` | String | ❌ | `''` | |

**Dates & conversion**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `enquiryDate` | Date | `lucOnly` | — | Expected UTC midnight. |
| `closingDate` | Date | `lucOnly` | — | Expected UTC midnight. Drives `month`. |
| `dateOfEnrollment` | Date | ❌ | — | Skillhub. |
| `conversionTime` | Number | ❌ | `0` | Days between enquiry and closing, `Math.ceil`. Derived. |

**Ownership**

| Field | Type | Required | Notes |
|---|---|---|---|
| `consultantName` | String | ✅ | Denormalised. |
| `consultant` | ObjectId → `Consultant` | ❌ | May be null on legacy rows. |
| `teamLeadName` | String | ✅ | Denormalised. |
| `teamLead` | ObjectId → `User` | ✅ | **The tenancy ownership key** used by `buildScopeFilter` / `canAccessDoc`. |
| `teamName` | String | ✅ | Denormalised. |

**LUC profile (residence + professional)** — all `required: lucOnly` with `default: ''` / `0`:
`residence`, `area`, `nationality`, `companyName`, `designation`, `experience` (Number, `min: 0`),
`industryType`, `deptType`. Plus optional `region` (String, `''`) and Skillhub-only
`addressEmirate` (String, `''`).

**Cross-tracker link (LUC)**

| Field | Type | Default | Notes |
|---|---|---|---|
| `commitmentId` | ObjectId → `Commitment` | `null` | Indexed. FK to the commitment that produced this admission. Required **at the controller level** for new LUC records unless the admin sets `manualEntry`. Nullable on the schema so legacy rows pass. |
| `manualEntry` | Boolean | `false` | Admin opt-out of the link requirement. |
| `manualEntryReason` | String | `''` | Surfaced on the reconciliation page. |

**Audit** — `createdBy` (ObjectId → `User`, required), plus `createdAt` / `updatedAt` from
`{ timestamps: true }`.

#### Options

```js
{ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
```

The two `virtuals: true` flags are what make `outstandingAmount` reach the client.

#### Hooks

**`pre('validate')` — `:298-338`** (async). Runs on `.save()` only.

* LUC branch: recomputes `conversionTime` from `|closingDate - enquiryDate|`; sets `month` from
  `new Date(closingDate).getUTCMonth()`.
* Skillhub branch: derives `curriculumSlug` as `curriculum.split('-')[0]` if that board is in
  `SKILLHUB_CURRICULUM_SLUGS`, else `'CBSE'`; recomputes `conversionTime`.
* It is a `pre('validate')` (not `pre('save')`) specifically so the derived `month` can satisfy its
  own `required: lucOnly`.

#### Statics

`getNextSno(teamLeadId, organization)` — `:341-347`. See [§4.4](#44-sno-is-generated-with-a-read-then-write-race).

#### Virtuals

`outstandingAmount` — `:350-361`. See [§4.2](#42-outstandingamount-is-a-virtual--it-does-not-survive-lean-or-group).
Returns `0` for LUC unconditionally.

#### Indexes — `:364-375`

```
{ teamLead: 1, closingDate: -1 }
{ consultantName: 1 }
{ closingDate: -1 }
{ month: 1 }
{ source: 1 }
{ program: 1 }
{ organization: 1, studentStatus: 1 }
{ organization: 1, source: 1, closingDate: -1 }     // Export Center
{ organization: 1, leadSource: 1, createdAt: -1 }   // Export Center
{ organization: 1, university: 1, program: 1 }      // Export Center
```
Plus implicit singles on `organization`, `studentStatus`, `enrollmentNumber` (unique+sparse),
`commitmentId`.

---

### 5.4 `Commitment` — `server/models/Commitment.js`

The weekly sales-commitment record. Weeks are **Monday–Sunday**, ISO week numbers
(`date-fns`, `weekStartsOn: 1`).

**Exported constant:** `Commitment.LEAD_STAGES` (`:7-20`) — a **12-value** array shared with
`Meeting.status`:

```
Dead · Cold · Warm · Hot · Offer Sent · Awaiting Confirmation ·
Meeting Scheduled · Admission · CIF · Unresponsive · No Answer · Lost
```

`server/tests/exports/commitments.test.js` asserts `enumValues.length === 12` — this is a guard
against re-introducing the duplicate `leadStage` definition that used to exist in this file (removed;
only one definition remains, at `:170-174`).

**Sub-schema `DemoSlotSchema`** (`:25-42`, `_id: false`) — Skillhub only, up to 4 per commitment:

| Field | Type | Required | Default |
|---|---|---|---|
| `slot` | String | ✅ | — (enum `Demo 1`..`Demo 4`) |
| `scheduledAt` | Date | ❌ | `null` |
| `done` | Boolean | ❌ | `false` |
| `doneAt` | Date | ❌ | `null` |
| `notes` | String | ❌ | `''` |
| `demoDoneBy` | String | ❌ | `''` — Institute teacher **name string**, not a ref |

**Main fields**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum, indexed. |
| `consultantName` | String | ✅ | — | Denormalised (no `consultant` ref on this model). |
| `teamLead` | ObjectId → `User` | ✅ | — | Ownership key. |
| `teamName` | String | ✅ | — | |
| `weekNumber` | Number | ✅ | — | `min: 1`, `max: 53`. |
| `year` | Number | ✅ | — | |
| `weekStartDate` | Date | ✅ | — | Monday. |
| `weekEndDate` | Date | ✅ | — | Sunday. |
| `commitmentDate` | Date | ✅ | — | The actual calendar day being logged. For non-admins the controller enforces `commitmentDate ∈ [weekStartDate, weekEndDate]` (`commitmentController.js:150-165`); admins bypass. |
| `dayCommitted` | String | ❌ | — | Enum Monday..Sunday. |
| `studentName` | String | ❌ | — | |
| `gradeOrYear` | String | ❌ | `''` | Skillhub Institute demos. |
| `studentPhone` | String | ❌ | `''` | Custom validator (`:118-127`): empty OK, else `/^[\d\s\-\+\(\)]+$/`. |
| `commitmentMade` | String | ✅ | — | The commitment text. |
| `description` | String | ❌ | — | **Phantom alias — see [§4.7](#47-commitmentdescription-is-a-phantom-alias).** |
| `commitmentAchieved` | String | ❌ | — | |
| `meetingsDone` | Number | ❌ | `0` | `min: 0`. |
| `demos` | `[DemoSlotSchema]` | ❌ | `[]` | Skillhub only. |
| `achievementPercentage` | Number | ❌ | `0` | `min: 0`, `max: 100`. |
| `reasonForNotAchieving` | String | ❌ | — | |
| `leadStage` | String | ❌ | `Cold` | Enum `LEAD_STAGES` (12 values). |
| `conversionProbability` | Number | ❌ | `0` | `min: 0`, `max: 100`. |
| `followUpDate` | Date | ❌ | — | |
| `followUpNotes` | String | ❌ | — | |
| `expectedConversionDate` | Date | ❌ | — | |
| `commitmentVsAchieved` | String | ❌ | — | Management oversight. |
| `correctiveActionByTL` | String | ❌ | — | |
| `adminComment` | String | ❌ | — | |
| `prospectForWeek` | Number | ❌ | — | `min: 0`. |
| `admissionClosed` | Boolean | ❌ | `false` | **Irreversible — [§4.6](#46-admissionclosed-is-irreversible-and-closed-rows-are-pinned-to-achieved).** |
| `admissionClosedDate` | Date | ❌ | `null` | Stamped by the controller. |
| `closedDate` | Date | ❌ | — | Separate legacy field; **not** the same as `admissionClosedDate`. |
| `closedAmount` | Number | ❌ | — | `min: 0`. Revenue. Not auto-set by the auto-close path, so back-filled rows under-report revenue. |
| `status` | String | ❌ | `pending` | Enum `pending` \| `in_progress` \| `achieved` \| `missed`. ⚠️ The client's `STATUS_LIST` in `client/src/utils/constants.js` still lists `not_achieved`, which the server rejects. |
| `isActive` | Boolean | ❌ | `true` | Soft delete. |
| `studentId` | ObjectId → `Student` | ❌ | `null` | Indexed. Reverse FK of `Student.commitmentId`; written in lockstep. |
| `createdBy` / `lastUpdatedBy` | ObjectId → `User` | ❌ | — | |
| `createdAt` / `updatedAt` | Date | auto | — | |

**Indexes** — `:267-273`

```
{ consultantName: 1, weekNumber: 1, year: 1 }
{ teamLead: 1, weekNumber: 1, year: 1 }
{ weekStartDate: 1 }
{ leadStage: 1 }
{ admissionClosed: 1 }
{ organization: 1, status: 1, weekStartDate: 1 }   // Export Center
```
Plus implicit `organization`, `studentId`.

**No hooks, no virtuals, no statics** (only the `LEAD_STAGES` export).

---

### 5.5 `Meeting` — `server/models/Meeting.js`

Meeting Tracker rows. Reuses `LEAD_STAGES` from `Commitment` as its `status` enum — importing from
`./Commitment` at `:3`, which creates a **hard load-order dependency**: requiring `Meeting` pulls in
`Commitment`.

**Exported constant:** `Meeting.MEETING_MODES` = `['Zoom', 'Out Meeting', 'Office Meeting', 'Student Meeting']`.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum, indexed. |
| `meetingDate` | Date | ✅ | — | **No week-bound validation** — any role may backdate or forward-date. |
| `studentName` | String | ✅ | — | |
| `program` | String | **`lucOnly`** | — | The canonical example of [§4.1](#41-conditional-required-silently-passes-on-update-the-big-one). |
| `mode` | String | ✅ | — | Enum `MEETING_MODES`. |
| `consultant` | ObjectId → `Consultant` | ❌ | `null` | Nullable **by design**: a team lead may conduct a meeting, and TLs live in `User`, not `Consultant`. |
| `consultantName` | String | ✅ | — | Always populated (TL name when `consultant` is null). |
| `teamLead` | ObjectId → `User` | ✅ | — | Ownership key. Admin-created Skillhub meetings derive it from the picked counsellor's populated `teamLead._id`. |
| `teamLeadName` | String | ✅ | — | |
| `status` | String | ✅ | — | Enum `LEAD_STAGES` (12 values). |
| `remarks` | String | ❌ | `''` | |
| `commitmentId` | ObjectId → `Commitment` | ❌ | `null` | Indexed. Required **at controller level** when `status === 'Admission'` for LUC. |
| `manualEntry` | Boolean | ❌ | `false` | Admin opt-out mirroring `Student.manualEntry`. |
| `manualEntryReason` | String | ❌ | `''` | |
| `meetingTakenBy` | `[String]` | ❌ | `[]` | Multi-select denormalised names of everyone who co-led. Independent of `consultant`. |
| `demoDoneBy` | String | ❌ | `''` | Institute teacher **name string**. Sourced from `instituteService.getTeachers()`; the dropdown only renders when `viewOrg === 'skillhub_institute'`. |
| `createdBy` / `lastUpdatedBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `:133-135`: `{ organization: 1, meetingDate: -1 }`, `{ teamLead: 1, meetingDate: -1 }`,
`{ consultant: 1 }`.

---

### 5.6 `HourlyActivity` — `server/models/HourlyActivity.js`

One row per consultant per date per time slot. Read [§4.9](#49-hourlyactivity-has-two-mutually-incompatible-shapes).

Slot IDs and activity types come from `server/utils/hourlyConstants.js`:

* **`ALL_SLOT_IDS`** (union of LUC + Skillhub) — `s0930`, `s1030`, `s1130`, `s1230`, `s1400`,
  `s1500`, `s1600`, `s1700`, `s1800`, `s1900`, **`s1300`**. LUC has no `s1300` (lunch 1–2 is a UI-only
  gap); Skillhub has `s1300` as a working slot and flags `s1400` as `isLunch` while still allowing
  entries there.
* **`LUC_ACTIVITY_TYPES`** — `call`, `followup`, `call_followup`, `noshow`, `drip`, `meeting`,
  `zoom`, `outmeet`, `teammeet`, `tlmeet`.
* **`SKILLHUB_ACTIVITY_TYPES`** — `sh_call`, `sh_followup_admission`, `sh_schedule`, `sh_break`,
  `sh_demo_meeting`, `sh_meeting`, `sh_payment_followup`, `sh_operations`. (`sh_meeting` is
  duration-based, 30 min–3 h, no count.)
* The schema enum is `ALL_ACTIVITY_TYPES` — the union. **A LUC row can store a Skillhub type and vice
  versa; nothing prevents it.**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum, indexed. |
| `consultant` | ObjectId → `Consultant` | ✅ | — | |
| `consultantName` | String | ✅ | — | |
| `date` | Date | ✅ | — | UTC midnight expected. |
| `slotId` | String | ✅ | — | Enum `ALL_SLOT_IDS`. |
| `activityType` | String | ✅ | — | Enum `ALL_ACTIVITY_TYPES`. Mirrors `activities[0]` when the array is used. |
| `count` | Number | ❌ | `1` | |
| `followupCount` | Number | ❌ | `0` | |
| `duration` | Number | ❌ | **`60`** | Minutes. Note the non-zero default. |
| `activities` | `[{...}]` | ❌ | `[]` | `_id: false` items: `{ activityType (enum, required), count=1, followupCount=0, duration=0 }`. Note `duration` defaults to **0** here vs **60** on the flat field. |
| `note` | String | ❌ | `''` | |
| `isContinuation` | Boolean | ❌ | `false` | Multi-slot activities write continuation rows. |
| `parentSlotId` | String | ❌ | `null` | |
| `loggedBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `:89-97`

| Index | Unique |
|---|---|
| `{ consultant: 1, date: 1, slotId: 1 }` | **✅ UNIQUE** — one entry per consultant/date/slot. This is what makes the slot editor an upsert. |
| `{ date: 1 }` | |
| `{ organization: 1, date: 1, activityType: 1 }` | Export Center |

> Note the unique index does **not** include `organization`. That is safe only because `consultant`
> is already org-specific.

---

### 5.7 `DailyAdmission` / `DailyReference` — identical shape

`server/models/DailyAdmission.js` and `server/models/DailyReference.js` are byte-for-byte identical
apart from the model name. Both served by `/api/hourly`.

| Field | Type | Required | Default |
|---|---|---|---|
| `organization` | String | ✅ | `luc` (enum, indexed) |
| `consultant` | ObjectId → `Consultant` | ✅ | — |
| `date` | Date | ✅ | — |
| `count` | Number | ❌ | `0` |
| `loggedBy` | ObjectId → `User` | ❌ | — |

**Indexes** — `{ consultant: 1, date: 1 }` **UNIQUE**, plus `{ date: 1 }` and implicit `organization`.

---

### 5.8 `PaymentPlan` — `server/models/PaymentPlan.js`

LUC-only payment-plan approval workflow ("Pending Approvals" tab under Tier Fight).

**Exported constant:** `PaymentPlan.STATUSES` (`:10-17`):
`Pending from TL` · `Pending from SM` · `Pending from FD` · `Approved and Submitted` ·
`Pending from Student` · `Drop Out`.

> The value `Approved and Submitted` was renamed from `Submitted`. `server/scripts/renamePaymentPlanApproved.js`
> migrates old rows. Because `updateMany` skips enum validators, that script can match the removed
> value — which is exactly why it works.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum, indexed. |
| `student` | ObjectId → `Student` | ✅ | — | **`unique: true`** — one plan per admission. The controller pre-checks so callers get a friendly 409 rather than a raw `E11000`. |
| `studentName` | String | ✅ | — | Denormalised snapshot. |
| `program` / `month` / `consultantName` | String | ❌ | `''` | Denormalised snapshot. |
| `teamLead` | ObjectId → `User` | ✅ | — | Indexed. Ownership key. |
| `teamLeadName` / `teamName` | String | ❌ | `''` | |
| `status` | String | ✅ | `Pending from TL` | Enum `PAYMENT_PLAN_STATUSES`. |
| `remarks` | String | ❌ | `''` | |
| `createdBy` | ObjectId → `User` | ✅ | — | |
| `lastUpdatedBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `{ organization: 1, teamLead: 1, createdAt: -1 }`, plus unique `student` and implicit
`organization`, `teamLead`.

---

### 5.9 `Notification` — `server/models/Notification.js`

Per-user in-app bell notifications. **No `organization` field** — scoped purely through `user`.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `user` | ObjectId → `User` | ✅ | — | The recipient. |
| `type` | String | ✅ | — | Enum: `follow_up_reminder`, `weekly_summary`, `commitment_due`, `team_update`, **`student_birthday`**. |
| `title` | String | ✅ | — | Trimmed. |
| `message` | String | ✅ | — | Trimmed. |
| `relatedCommitment` | ObjectId → `Commitment` | ❌ | — | |
| `isRead` | Boolean | ❌ | `false` | |
| `priority` | String | ❌ | `medium` | Enum `low` \| `medium` \| `high`. |
| `readAt` | Date | ❌ | — | |

**Indexes** — `{ user: 1, isRead: 1 }`, `{ createdAt: -1 }`.

**Deletion is a hard delete** — there is no `isActive` on this model. An older bug where the
controller referenced non-existent `recipient` / `isActive` fields has been fixed.

`student_birthday` rows are produced by `server/services/birthdayNotifier.js`, run by a cron at
**08:00 Asia/Dubai** (`server/server.js:176-185`). The job is idempotent — a retry posts nothing
extra. Specs: `server/tests/institute/birthdays.test.js`.

---

## 6. Model reference — Skillhub Institute

All five models default `organization` to **`skillhub_institute`** and are gated by
`assertInstitute()` (see [§2.4](#24-feature-level-org-gates)). A Skillhub **Training** login is
rejected with 403.

### 6.1 `Teacher` — `server/models/Teacher.js`

Institute faculty. **Records only — teachers have no login.**

| Field | Type | Required | Default |
|---|---|---|---|
| `organization` | String | ✅ | `skillhub_institute` (enum `ORGANIZATIONS`, indexed) |
| `name` | String | ✅ | — |
| `subjects` | `[String]` | ❌ | `[]` — free text, canonicalised via `config/instituteSubjects.js` |
| `isActive` | Boolean | ❌ | `true` |
| `createdBy` | ObjectId → `User` | ❌ | — |

**Index** — `{ organization: 1, name: 1 }` (**not unique** — duplicate teacher names are storable;
the schedule importer matches case-insensitively and collapses sheets whose names normalise alike).

Because teachers are referenced from `Meeting.demoDoneBy` and `Commitment.demos[].demoDoneBy` as
**plain name strings**, renaming a teacher does not rewrite history — but it also breaks the join.

### 6.2 `TimetableEntry` — `server/models/TimetableEntry.js`

One recurring weekly class session. `TimetableEntry.DAYS` is exported (`:44`).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `skillhub_institute` | Enum, indexed. |
| `teacher` | ObjectId → `Teacher` | ✅ | — | Indexed. |
| `teacherName` | String | ❌ | `''` | Denormalised. |
| `dayOfWeek` | String | ✅ | — | Enum Monday..Sunday. |
| `time` | String | ✅ | — | **Raw text**, e.g. `"12.30 pm - 1.30 pm"` — source formats are inconsistent. |
| `startMinutes` | Number | ❌ | `null` | Parsed minutes-from-midnight, for ordering only. |
| `gradeOrYear` | String | ❌ | `''` | `"Grade 9"` / `"Year 10"` / `"G11"`. |
| `curriculum` | String | ❌ | `''` | Free text (`"CBSE"`, `"IGCSE Edexcel"`, `"Cambridge"`…) — **not** the `Student.curriculum` enum. |
| `subject` | String | ❌ | `''` | Canonicalised on import. |
| `studentLabel` | String | ❌ | `''` | The raw "Grade / Student" cell, which mixes grades, individuals and pairs. |
| `students` | `[ObjectId → Student]` | ❌ | — | Resolved by name where possible. |
| `createdBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `{ organization: 1, teacher: 1 }`, `{ organization: 1, dayOfWeek: 1, startMinutes: 1 }`,
`{ organization: 1, gradeOrYear: 1 }`. **None unique.**

**Bulk import trap** — `POST /api/institute/timetable/import` (parser at
`server/services/institute/scheduleParser.js`) *replaces* only the teachers present in the uploaded
file, so one teacher's upload can never wipe another's schedule. Within a teacher the order is
capture-old-ids → `insertMany(new)` → `deleteMany(old)`, so a mid-flight failure leaves **duplicates**
(visible and fixable) rather than an emptied schedule. There is **no transaction**; instead every row
is validated before the first write. Merged Day cells (Excel merges the Day column down a block)
arrive blank and are forward-filled — without that the parser silently dropped most of a normal
schedule and the replace then deleted real sessions. Specs:
`server/tests/institute/scheduleImport.test.js`.

### 6.3 `Attendance` — `server/models/Attendance.js`

One student's attendance for one session on one date.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `skillhub_institute` | Enum, indexed. |
| `date` | Date | ✅ | — | Indexed. |
| `student` | ObjectId → `Student` | ❌ | `null` | Indexed. Null when the name didn't match a `Student`. |
| `studentName` | String | ✅ | — | Always kept, so unmatched/legacy names still render. |
| `gradeOrYear` / `subject` / `curriculum` | String | ❌ | `''` | |
| `teacher` | ObjectId → `Teacher` | ❌ | `null` | |
| `teacherName` | String | ❌ | `''` | |
| `status` | String | ✅ | — | Enum `Present` \| `Absent`. **No "Late"/"Excused".** |
| `markedBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `{ organization: 1, gradeOrYear: 1, subject: 1, date: 1 }`,
`{ organization: 1, date: 1 }`, `{ student: 1, date: 1 }`. **Deliberately NOT unique** — the comment
at `:35-36` explains: a class can legitimately have multiple rows.

### 6.4 `TestRecord` — `server/models/TestRecord.js`

One student's result in one weekly test. Mirrors `Attendance` structurally, but with a **unique**
key.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `skillhub_institute` | Enum, indexed. |
| `date` | Date | ✅ | — | Indexed. Normalised to UTC midnight by the controller. |
| `student` | ObjectId → `Student` | ❌ | `null` | Indexed. |
| `studentName` | String | ✅ | — | |
| `gradeOrYear` / `curriculum` / `subject` / `testTopic` | String | ❌ | `''` | Defaults to `''` **specifically so the unique key is always fully populated**. |
| `marksObtained` | Number | ✅ | — | `min: 0`. |
| `maxMarks` | Number | ❌ | `null` | `min: 0`. When set, the UI renders `X / Y (Z%)`. |
| `teacher` | ObjectId → `Teacher` | ❌ | `null` | |
| `teacherName` | String | ❌ | `''` | |
| `markedBy` | ObjectId → `User` | ❌ | — | |

**Indexes** — `:45-53`

| Index | Unique |
|---|---|
| `{ organization, date, gradeOrYear, subject, testTopic, studentName }` | **✅ UNIQUE** |
| `{ organization: 1, gradeOrYear: 1, subject: 1, date: 1 }` | |
| `{ organization: 1, date: 1 }` | |
| `{ organization: 1, teacherName: 1 }` | |
| `{ student: 1, date: 1 }` | |

**Two traps live on this model:**

1. **`createTests` upserts, it does not delete-then-insert.** Re-recording a session only touches the
   students in the payload; a stray result must be removed with the per-row `DELETE`. The unique
   index above is what makes a double-clicked save collapse to one row instead of racing two inserts.
   The `bulkWrite` runs `ordered: false` and swallows all-`E11000` errors as benign.
2. **`bulkWrite` upserts do not run validators**, so the schema's `min: 0` on marks is enforced by
   the JS guard `toNonNegativeNumber()` in `server/controllers/instituteController.js` — it trims
   whitespace (`'  '` → skipped, **not** `0`) and drops negatives. The `updateTest` path uses
   `row.save()` and *does* validate. **Keep the two in step.** Specs:
   `server/tests/institute/tests.test.js`.

### 6.5 `InstituteEnrollment` — `server/models/InstituteEnrollment.js`

The **durable class-roster membership record**. Added because the roster used to be *derived* from
attendance/test history, which meant a student only appeared once they already had a mark: adding
someone and saving without ticking Present/Absent wrote nothing and they silently vanished on reload
— and marking them for one subject put them on every subject of that grade.

| Field | Type | Required | Default |
|---|---|---|---|
| `organization` | String | ✅ | `skillhub_institute` (enum, indexed) |
| `gradeOrYear` | String | ✅ | — |
| `subject` | String | ❌ | `''` |
| `student` | ObjectId → `Student` | ❌ | `null` (indexed) — null renders as "(unlinked)" |
| `studentName` | String | ✅ | — |
| `addedBy` | ObjectId → `User` | ❌ | — |

**Index** — `{ organization, gradeOrYear, subject, studentName }` **UNIQUE**, so a double-click or
re-add is idempotent.

`getRoster` (`instituteController.js:445-470`) unions `InstituteEnrollment` with historical
`Attendance` + `TestRecord` names, so pre-existing students still appear without a migration.

---

## 7. Model reference — leadership, tiers & announcements

### 7.1 `TeamMonthlyEntry` — `server/models/TeamMonthlyEntry.js`

Manual, Excel-replica leadership numbers. One row per **(consultant, year, month)**.

Fields are assembled programmatically (`:14-49`): a fixed base set plus **one `Number` field per
bucket slug**, generated by `for (const slug of ALL_SLUGS) fields[slug] = numField();` where
`ALL_SLUGS` comes from `server/services/execOverview/bucketing.js`.

**The 17 generated numeric fields** (14 program buckets + KHDA + 2 AGI):

`ssm_mba`, `ssm_bba`, `othm_mba`, `ioscm_mba`, `knights_mba`, `knights_bba`, `must`, `othm_7`,
`ioscm_7`, `othm_3`, `dba`, `othm_ext_l5`, `othm_4_5`, `othm_6`, `khda`, `agi`, `agi_standalone`

> `khda`, `agi` and `agi_standalone` are **tracked but never summed into Total Admissions**
> (`EXCLUDED_SLUGS` in `bucketing.js`). `khda` is manual-entry only — `bucketProgram()` never
> classifies a student into it.
>
> **Adding a bucket to `bucketing.js` adds a schema field.** Removing one orphans stored data.

| Base field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | **Enum is hardcoded `['luc']`** — not `ORGANIZATIONS`. Indexed. |
| `teamLead` | ObjectId → `User` | ✅ | — | Indexed. |
| `consultant` | ObjectId → `Consultant` | ✅ | — | Indexed. |
| `consultantName` | String | ✅ | — | |
| `year` | Number | ✅ | — | `min: 2020`, `max: 2100`. |
| `month` | Number | ✅ | — | `min: 1`, `max: 12` (1-based). |
| `monthlyTarget` | Number | ❌ | `0` | `min: 0`. |
| `achievedRevenue` | Number | ❌ | `0` | `min: 0`. |
| `notes` | String | ❌ | `''` | |
| `createdBy` / `lastUpdatedBy` | ObjectId → `User` | ❌ | — | |

Every numeric field defaults to `0` **specifically so callers can upsert just the cell they edited**
without re-supplying the rest.

**Index** — `{ consultant: 1, year: 1, month: 1 }` **UNIQUE**. Note it does not include
`organization` (moot while the enum is LUC-only) or `teamLead` — reassigning a consultant to a
different team does not create a new row.

Derived (never stored): Total Admissions, % Revenue, TEAM TOTAL row, YTD strip.

### 7.2 `Tier` — `server/models/Tier.js`

A Tier Fight competition group (1, 2, 3) spanning teams.

| Field | Type | Required | Default |
|---|---|---|---|
| `organization` | String | ✅ | `luc` (enum `ORGANIZATIONS`) |
| `tier` | Number | ✅ | — (`min: 1`, `max: 3`) |
| `label` | String | ❌ | `''` |
| `members` | `[ObjectId → Consultant]` | ❌ | — |

**Index** — `{ organization: 1, tier: 1 }` **UNIQUE**.

Members are `Consultant` refs (stable — no name-matching at calculation time). The "MTD amount" is
computed live from members' current-month achieved revenue; it is **not stored** on this model.
Seeded once by `server/scripts/seedTiers.js`.

### 7.3 `TierImage` — `server/models/TierImage.js`

One AI-generated tier-standings poster.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum `ORGANIZATIONS`. |
| `image` | String | ❌ | `''` | **Fallback only** — an inline data URL, used when the S3 upload fails. Keeping images out of Mongo is deliberate. |
| `s3Key` | String | ❌ | `''` | Primary storage: `tier-images/YYYY/MM/DD/<ts>-<theme>.png`. |
| `theme` | String | ❌ | `''` | |
| `headline` | String | ❌ | `'Month-End Race Is On!'` | |
| `month` / `year` | Number | ❌ | — | |
| `tiers` | `[{ tier, label, mtdAchieved }]` | ❌ | — | `_id: false`. **Snapshot of the totals at generation time** so the client's text overlay matches the moment it was generated. |
| `generatedBy` | ObjectId → `User` | ❌ | `null` | |

**Index** — `{ organization: 1, createdAt: -1 }`.

The AI draws a **text-free** scene; tier labels and amounts are overlaid as real text on the client,
so the numbers are always crisp.

### 7.4 `Announcement` — `server/models/Announcement.js`

An org-wide broadcast banner. **Distinct from `Notification`**: a `Notification` is one row per user,
passive (only seen if you open the bell); an `Announcement` is a **single document everyone in the
org sees as a prominent dashboard banner until they personally acknowledge it**.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum `ORGANIZATIONS`. Not individually indexed. |
| `type` | String | ❌ | `manual` | Enum `admission` \| `manual` \| `tier`. |
| `priority` | String | ❌ | **`high`** | Enum `normal` \| `high`. `high` → app-wide banner + live toast; `normal` → quiet. |
| `title` | String | ✅ | — | |
| `message` | String | ✅ | — | |
| `meta` | Mixed | ❌ | `{}` | Free-form context (studentId, consultantName, teamName, program, link…). **Unvalidated** — anything can be stored here. |
| `createdBy` | ObjectId → `User` | ❌ | `null` | `null` for system-generated (auto-on-admission). |
| `acknowledgedBy` | `[{ user: ObjectId→User, at: Date=now }]` | ❌ | `[]` | `_id: false`. Per-user dismissal — the banner stays pinned until each person dismisses it. **Grows unboundedly with org size.** |
| `expiresAt` | Date | ❌ | — | Set by the creator. See below. |

**Indexes** — `{ organization: 1, createdAt: -1 }`, `{ expiresAt: 1 }`.

⚠️ **`{ expiresAt: 1 }` is a plain index, not a TTL index** — there is no `expireAfterSeconds`.
Expired announcements are **filtered out at read time**, not deleted:

```js
// server/controllers/announcementController.js:13
$or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
```

They accumulate forever. `server/services/announcer.js:5` sets `ANNOUNCEMENT_TTL_MS` to 7 days for
auto-generated ones. If the collection ever needs pruning, that is a manual job.

---

## 8. Model reference — AI, chat & Docs RAG

### 8.1 `AIUsage` — `server/models/AIUsage.js`

Token + cost ledger for every OpenAI/Groq call.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `user` | ObjectId → `User` | ✅ | — | |
| `role` | String | ✅ | — | Enum `admin` \| `team_lead` \| `manager` \| `skillhub`. **Expanded from the original admin+team_lead pair**, which silently rejected chat rows from skillhub/manager accounts (comment at `:12-14`). |
| `type` | String | ❌ | `analysis` | Enum `analysis` \| `chat` \| `image`. Indexed. Default keeps pre-chatbot rows labelled correctly. |
| `teamName` | String | ❌ | `''` | Cached at write time so the admin "by team" breakdown avoids a populate-join. |
| `organization` | String | ❌ | `''` | **Plain String, no enum.** |
| `model` | String | ✅ | — | e.g. `gpt-4o-mini`, `llama-3.3-70b-versatile`, `gpt-image-2`. |
| `promptTokens` / `completionTokens` / `totalTokens` | Number | ✅ | — | |
| `cost` | Number | ✅ | — | USD. Computed at the service layer from a hardcoded price table — **stale prices produce silently wrong cost reporting.** |
| `dateRangeQueried` | `{ startDate: String, endDate: String }` | ❌ | — | Strings, not Dates. |

**Indexes** — `{ createdAt: -1 }`, `{ user: 1, createdAt: -1 }`, implicit `type`.

Surfaced by `GET /api/ai/usage` (admin only).

### 8.2 `ChatConversation` — `server/models/ChatConversation.js`

Chatbot threads. Messages are **embedded**, not a separate collection, so a thread streams to the
client in one round-trip. **No `organization` field** — scoped by `user`.

**Embedded `messageSchema`** (`:8-37`, `_id: true`):

| Field | Type | Notes |
|---|---|---|
| `role` | String, required | Enum `system` \| `user` \| `assistant` \| `tool`. |
| `content` | String | Default `''`. |
| `toolCalls` | `[{ id, name, arguments }]` | `arguments` is the **raw JSON string** as received from OpenAI. Persisted so (a) the exact context can be reconstructed on resume and (b) admins can audit which backend queries an answer was based on. |
| `toolCallId` / `toolName` | String | For `role: 'tool'` replies. |
| `usage` | `{ promptTokens, completionTokens, totalTokens }` | Per assistant completion. |
| `createdAt` | Date | `Date.now`. |

**Parent fields**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `user` | ObjectId → `User` | ✅ | — | Indexed. |
| `title` | String | ❌ | `'New chat'` | Auto-derived from the first user message after turn 1. |
| `source` | String | ❌ | `tracker` | Enum `tracker` \| `docs`. Indexed. Default matches pre-existing rows. |
| `messages` | `[messageSchema]` | ❌ | `[]` | |
| `lastActivityAt` | Date | ❌ | `Date.now` | Indexed. Drives list ordering without reading the embedded array. |

**Index** — `{ user: 1, lastActivityAt: -1 }`.

⚠️ **Unbounded document growth.** A long conversation grows a single document toward MongoDB's 16 MB
limit. There is no message cap, no archival, no TTL.

### 8.3 `DocChunk` — `server/models/DocChunk.js`

The Docs RAG corpus: 16 LUC program PDFs (8 programs × overview + QNA), ~215 chunks at current corpus
size. `organization` is always `luc`.

**Exported constants:** `DocChunk.PROGRAMS` (slug → display name), `PROGRAM_SLUGS`, `DOC_TYPES`,
`SECTIONS`.

| Constant | Values |
|---|---|
| `PROGRAM_SLUGS` | `ssm-dba`, `ioscm-l7`, `knights-bsc`, `knights-mba`, `malaysia-mba`, `othm-l5`, `ssm-bba`, `ssm-mba` |
| `DOC_TYPES` | `overview`, `qna` |
| `SECTIONS` | `accreditation`, `product`, `scenario`, `closing`, `quick_ref`, `overview` |

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `organization` | String | ✅ | `luc` | Enum, indexed. |
| `chunkId` | String | ✅ | — | **`unique: true`**, indexed. Stable id used by the cache and logs. |
| `program` | String | ✅ | — | Enum `PROGRAM_SLUGS`. |
| `programDisplayName` | String | ✅ | — | |
| `docType` | String | ✅ | — | Enum `DOC_TYPES`. |
| `section` | String | ✅ | — | Enum `SECTIONS`. |
| `questionText` | String | ❌ | `null` | QNA chunks only. |
| `content` | String | ✅ | — | The chunk body. |
| `embedding` | `[Number]` | ❌ | `[]` | 1536-dim content vector. |
| `questionEmbedding` | `[Number]` | ❌ | `[]` | Separate 1536-dim vector for `questionText` alone. Tier-1 exact match uses this so the cosine threshold answers "does this query match this *question*" rather than "…this entire Q+A body", which scores low for short queries. |
| `sourceFile` | String | ✅ | — | |
| `pageNumber` | Number | ✅ | — | `min: 1`. |
| `pdfPath` | String | ✅ | — | Served behind auth from `/program-docs/*`. |
| `highlightedPdfPath` | String | ❌ | `null` | Single-page PDF with the chunk pre-highlighted. Populated by `server/scripts/generateHighlightedPdfs.py` **after** the embedding ingest — null until that runs. |
| `snippetPath` | String | ❌ | `null` | PNG crop for the in-drawer preview. |
| `contentHash` | String | ✅ | — | Indexed. Powers idempotent re-ingest. |
| `tokens` | Number | ❌ | `0` | |

**Index** — `{ program: 1, docType: 1 }`, plus implicit `organization`, `chunkId` (unique),
`contentHash`.

> **These vectors are searched in memory, not by Mongo.** `server/services/docsRagService.js` loads
> every chunk into `docChunks[]` / `questionIndex[]` plus a wink-BM25 index once at boot
> (`server/server.js:135`). There is no Atlas Vector Search index. Adding chunks means a restart or
> an admin-triggered `POST /api/docs-chat/admin/reingest`.

**Adding a new program:** drop two PDFs in `client/public/program-docs/<new-slug>/`, extend
`PROGRAMS` in `DocChunk.js`, extend `DOC_TYPE_MAP` in `server/scripts/ingestProgramDocs.js`, run
`npm run ingest:docs:force`, deploy, then click "Force re-ingest" in the admin dashboard.

### 8.4 `QueryCache` — `server/models/QueryCache.js`

24-hour cache of docs-chat answers. Key: `sha1(normalize(query) + '|' + programFilter)`.

**Embedded `SourceSchema`** (`:4-22`, `_id: false`): `chunkId`, `program`, `programDisplayName`,
`docType`, `section`, `sourceFile`, `pageNumber`, `pdfUrl`, `highlightedPdfPath`, `snippetPath`,
`score`, `retrievalMethod`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `cacheKey` | String | ✅ | **`unique: true`**, indexed. |
| `query` | String | ✅ | |
| `programFilter` | String | ❌ | `null`. Part of the key. |
| `answer` | String | ✅ | |
| `sources` | `[SourceSchema]` | ❌ | `[]` |
| `tier` | Number | ✅ | 1 or 2. **Refusals (tier 3) are never cached.** |
| `createdAt` | Date | ❌ | `Date.now`, **`expires: config.cacheTtl`** — a real MongoDB TTL index. |

Options: `{ timestamps: { createdAt: false, updatedAt: true } }` — `createdAt` is declared manually
so the `expires` option can be attached to it.

⚠️ **The TTL is baked into the index at first boot.** `config.cacheTtl` reads
`DOCS_RAG_CACHE_TTL_SECONDS` (default 86400) at require-time. Changing that env var will **not**
change an already-created TTL index — MongoDB will not silently rebuild it. You must
`collMod` the index or drop it and let Mongoose recreate it.

### 8.5 `DocsChatLog` — `server/models/DocsChatLog.js`

One row per docs-chat request (**cache hits included**). Analytical, no TTL, kept indefinitely.

**Embedded `FeedbackSchema`** (`:6-13`, `_id: false`): `{ rating: 'up'|'down' (required), comment: String='', submittedAt: Date=now }`.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `userId` | ObjectId → `User` | ❌ | — | |
| `userOrg` | String | ❌ | — | Denormalised snapshot, no enum. |
| `query` | String | ✅ | — | Raw user text. |
| `normalizedQuery` | String | ✅ | — | Indexed. |
| `programFilter` | String | ❌ | `null` | |
| `detectedVia` | String | ❌ | `null` | Enum `lead_context` \| `alias_match` \| `free_text_map` \| `program_hint` \| `null`. |
| `tier` | Number | ✅ | — | 1 \| 2 \| 3. **`tier: 3` = a refusal** — these surface in the admin dashboard's "Refusals (last 24h)" table as corpus-gap signals. |
| `exactMatch` | Boolean | ❌ | `false` | |
| `cached` | Boolean | ❌ | `false` | |
| `topScore` | Number | ❌ | `null` | |
| `retrievalMethods` | `[String]` | ❌ | `[]` | |
| `sourceChunkIds` | `[String]` | ❌ | `[]` | |
| `provider` | String | ❌ | `null` | `groq` \| `openai` \| null. |
| `latencyMs` | Number | ❌ | — | |
| `refusalReason` | String | ❌ | `null` | `low_score` \| `no_candidates` \| null. |
| `feedback` | `FeedbackSchema` | ❌ | `null` | Thumbs up/down. |
| `createdAt` | Date | ❌ | `Date.now` | Indexed. **No `{ timestamps: true }`** — declared manually, and there is no `updatedAt`. |

**Indexes** — `{ userId: 1, createdAt: -1 }`, `{ tier: 1, createdAt: -1 }`,
`{ programFilter: 1, createdAt: -1 }`, implicit `normalizedQuery` and `createdAt`.

⚠️ This collection **stores raw user queries indefinitely**, including anything a consultant typed
about a named lead. It is the highest-retention PII surface in the system and has no retention job.

---

## 9. Model reference — exports & system

### 9.1 `SavedExportTemplate` — `server/models/SavedExportTemplate.js`

User-saved Pivot Builder configurations, persisted server-side so they follow the user across
devices.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `user` | ObjectId → `User` | ✅ | — | Indexed. |
| `name` | String | ✅ | — | Trimmed, `maxlength: 120`. |
| `dataset` | String | ✅ | — | Enum `students` \| `commitments` \| `meetings` \| `hourly`. **Adding a dataset requires editing this enum.** |
| `config` | Mixed | ❌ | `{}` | `{ rowDim, colDim?, measure?, agg, filters?, columns? }`. Free-form so the schema doesn't chase every dim/measure addition — **so it is entirely unvalidated.** |
| `organization` | String | ❌ | `luc` | Enum `luc` \| `skillhub_training` \| `skillhub_institute` \| **`all`**. Hardcoded, does not import `ORGANIZATIONS`. |

**Index** — `{ user: 1, name: 1 }` **UNIQUE** → the controller returns **409** on a duplicate name.
There is also a **200-template cap per user** enforced in the controller (returns **429**).
`DELETE /saved-templates/:id` is owner-only.

### 9.2 `WeeklySummary` — `server/models/WeeklySummary.js` — **DEAD CODE**

Pre-aggregated weekly metrics. **Zero references anywhere outside its own file** — verified by
grepping `server/` and `client/` (excluding `node_modules`). No controller, no route, no script, no
test. Nothing ever writes it, so any documents in the collection are stale.

Recorded for completeness:

| Field | Type | Required | Default |
|---|---|---|---|
| `consultant` | ObjectId → **`User`** | ❌ | — (note: refs `User`, not `Consultant` — itself a bug) |
| `teamLead` | ObjectId → `User` | ❌ | — |
| `teamName` | String | ❌ | — |
| `weekNumber` | Number | ✅ | — (`min: 1`, `max: 53`) |
| `year` | Number | ✅ | — |
| `weekStartDate` / `weekEndDate` | Date | ✅ | — |
| `totalCommitments`, `totalAchieved`, `totalMeetingsDone`, `totalAdmissionsClosed`, `totalProspects` | Number | ❌ | `0` |
| `overallAchievementPercentage` | Number | ❌ | `0` (`min: 0`, `max: 100`) |
| `generatedAt` | Date | ❌ | `Date.now` |

Indexes: `{ consultant: 1, weekNumber: 1, year: 1 }`, `{ teamLead: 1, weekNumber: 1, year: 1 }`.

**Recommendation:** delete the model, or wire it up. Leaving it is how a future engineer wastes a day
believing weekly rollups exist.

### 9.3 `Counter` — `server/models/Counter.js` — **LEGACY / UNUSED**

An atomic sequence generator.

| Field | Type | Required | Default |
|---|---|---|---|
| `key` | String | ✅ | — (`unique: true`, indexed) |
| `seq` | Number | ❌ | `0` |

**Static:** `Counter.increment(key)` — `findOneAndUpdate({key}, {$inc:{seq:1}}, {new, upsert, setDefaultsOnInsert})`,
returns the new `seq`. Genuinely atomic.

**Nothing calls it.** It was the backing store for auto-generated Skillhub enrollment numbers before
commit `c5effc2` made them manual. (The `snoCounters` `Map` in `server/scripts/importStudents.js:136`
and `clearAndImportStudents.js:147` is a plain in-memory object with a coincidentally similar name —
unrelated.)

⚠️ **Do not reuse the collection key format `enroll:{organization}:{IGCSE|CBSE}:{year}` without
coordinating** — stale counter documents for those keys may still exist in the `counters` collection
and would resume from an old sequence.

If you fix [§4.4](#44-sno-is-generated-with-a-read-then-write-race), this is the right tool.

---

## 10. Unique and compound indexes — consolidated

Every **unique** index in the system. These are the constraints that will throw `E11000` in
production.

| Model | Index | Scope | What it prevents |
|---|---|---|---|
| `User` | `{ email: 1 }` | global | Duplicate logins. |
| `Student` | `{ enrollmentNumber: 1 }` sparse | **global** | Duplicate Skillhub enrollment numbers — across both branches. |
| `HourlyActivity` | `{ consultant: 1, date: 1, slotId: 1 }` | per consultant | Two entries in one time slot; makes the editor an upsert. |
| `DailyAdmission` | `{ consultant: 1, date: 1 }` | per consultant | Duplicate daily counts. |
| `DailyReference` | `{ consultant: 1, date: 1 }` | per consultant | Duplicate daily counts. |
| `PaymentPlan` | `{ student: 1 }` | global | More than one plan per admission. |
| `TestRecord` | `{ organization, date, gradeOrYear, subject, testTopic, studentName }` | per org | A double-clicked bulk save racing two inserts. |
| `InstituteEnrollment` | `{ organization, gradeOrYear, subject, studentName }` | per org | Duplicate roster membership. |
| `TeamMonthlyEntry` | `{ consultant: 1, year: 1, month: 1 }` | per consultant | Two rows for the same consultant-month. |
| `Tier` | `{ organization: 1, tier: 1 }` | per org | Two tier-2 groups. |
| `SavedExportTemplate` | `{ user: 1, name: 1 }` | per user | Duplicate template name → 409. |
| `DocChunk` | `{ chunkId: 1 }` | global | Duplicate chunk on re-ingest. |
| `QueryCache` | `{ cacheKey: 1 }` | global | Duplicate cache entry. |
| `Counter` | `{ key: 1 }` | global | (unused) |

**Notably absent:** there is no unique index on `Student.sno`, on `Consultant.name`, on
`Teacher.name`, or on `Attendance` (deliberately — see [§6.3](#63-attendance--servermodelsattendancejs)).

---

## 11. TTL and expiry behaviour

| Model | Mechanism | Actually deletes? |
|---|---|---|
| `QueryCache` | **Real TTL index** — `createdAt` with `expires: config.cacheTtl` (default 86400s). | ✅ Yes, by MongoDB. |
| `Announcement` | Plain index on `expiresAt`; filtered at read time in `announcementController.js:13`. | ❌ **No.** Rows accumulate forever. |
| `DocsChatLog` | None — explicitly "no TTL, kept indefinitely" (`:3-5`). | ❌ No. |
| `AIUsage` | None. | ❌ No. |
| `ChatConversation` | None. | ❌ No. Documents also grow unboundedly. |
| Everything else | None. | ❌ No. |

**The system has no data-retention job of any kind** beyond the `QueryCache` TTL. The
[Records Retention Schedule](../legal/09-records-retention-schedule.md) describes an intent that the
code does not implement.

---

## 12. Migration & backfill scripts

All live in `server/scripts/` and are run as `cd server && node scripts/<name>.js`. They connect
using the same `MONGODB_URI` — i.e. **production** ([§1.2](#12-the-cluster-is-called-dev-and-it-is-production)).

**There is no migration framework.** No versioning, no `migrations` collection, no up/down. Each
script is a standalone idempotent program. Nothing records that a script has been run — you must
check the data.

⚠️ **The dry-run flag is not consistent.** Three different conventions exist. Read the header comment
of any script before running it.

| Convention | Scripts |
|---|---|
| Dry-run is the **default**; `--apply` writes | `fixAdmissionClosedStatus`, `recomputeStaleConversionTime`, `normalizeInstituteSubjects` |
| Dry-run is the **default**; `--commit` writes | `backfillStudentDateTimezone`, `backfillMeetingDateTimezone` |
| `--dry-run` opts *out* of writing (i.e. **writes by default**) | `backfillAutoCloseAdmission`, `backfillCommitmentStudentLinks` |
| **Always writes**, no flag | `migrateOrganization`, `backfillCommitmentDate`, `renamePaymentPlanApproved`, `roundSkillhubWholeAed`, `excludeLegacyHourly` |

### 12.1 Schema-shape migrations (run once per environment)

| Script | What it does | Idempotent |
|---|---|---|
| `migrateOrganization.js` | Sets `organization: 'luc'` on any doc missing/null/empty across **7 collections** (`User`, `Consultant`, `Commitment`, `Student`, `HourlyActivity`, `DailyAdmission`, `DailyReference`). ⚠️ It does **not** cover the 14 other org-carrying models added later — they were introduced with the field already present, so this is fine today, but do not assume it is a general-purpose fixer. | ✅ |
| `backfillCommitmentDate.js` | Populates the required `commitmentDate` on legacy rows. Uses a **pipeline update via `Commitment.collection`** (Mongoose 9 requirement) setting `commitmentDate = $ifNull($createdAt, $weekStartDate)`. ⚠️ **`CLAUDE.md` says this sets `commitmentDate = weekStartDate`. That is wrong** — `createdAt` is preferred; `weekStartDate` is only the fallback. The header comment at `:1-10` explains why (weekStartDate would force every legacy row onto a Monday). | ✅ |
| `renamePaymentPlanApproved.js` | `PaymentPlan.status`: `'Submitted'` → `'Approved and Submitted'`. Works precisely because `updateMany` skips enum validators. | ✅ |

### 12.2 Data-correctness backfills

| Script | What it fixes |
|---|---|
| `backfillStudentDateTimezone.js` | LUC students whose `enquiryDate`/`closingDate` were shifted by the old local-midnight → `toISOString()` bug (UAE UTC+4 → previous UTC day 20:00). Shifts +4h, rewrites UTC midnight, recomputes `month`. Rows already at UTC midnight are skipped. `--commit` to write. |
| `backfillMeetingDateTimezone.js` | Same fix for `Meeting.meetingDate`. `--commit` to write. |
| `recomputeStaleConversionTime.js` | Recomputes `Student.conversionTime` where it drifted from `|closingDate - enquiryDate|`. Needed because `updateOne({$set})` bypasses `pre('validate')`. `--apply` to write. |
| `fixAdmissionClosedStatus.js` | `Commitment` rows with `admissionClosed: true` but `status !== 'achieved'` → sets `status: 'achieved'`. `--apply` to write. |
| `backfillAutoCloseAdmission.js` | `Commitment` rows with `leadStage: 'Admission'` + `status: 'achieved'` but `admissionClosed: false` → sets `admissionClosed: true` and `admissionClosedDate` (falling back `commitmentDate` → `weekStartDate` → `updatedAt` → `createdAt`). ⚠️ **`closedAmount` is deliberately NOT set — revenue stays under-counted for these rows until someone edits them.** `--dry-run` to preview. |
| `backfillCommitmentStudentLinks.js` | Populates the LUC `Student.commitmentId` ↔ `Commitment.studentId` pair in three tiers: (1) exact `studentName + consultantName` within ±30 days; (2) fuzzy token-containment ≥ threshold, same consultant, ±30 days, closest-by-date tiebreak; (3) leftovers, surfaced on the reconciliation page, not written. `--dry-run` to preview. |
| `roundSkillhubWholeAed.js` | Rounds Skillhub `courseFee`, `registrationFee`, `admissionFeePaid` and each EMI `amount`/`paidAmount` to whole AED. **LUC is deliberately untouched** (its amounts carry the intentional net/gross-VAT convention). |
| `normalizeInstituteSubjects.js` | Rewrites `subject` on `attendances`, `testrecords`, `timetableentries` onto the canonical list in `config/instituteSubjects.js`, and removes `CHRM` from teacher rosters. **Timetable rows whose subject is `CHRM` are deliberately preserved as history.** Unrecognised values are reported, never guessed at. `--apply` to write. |
| `excludeLegacyHourly.js` | Marks two named Institute counsellors `excludeFromHourly: true`. |
| `fixLegacyDataBugs.js` | Large multi-issue repair pass (16 KB). Read it before running. |
| `fixTeamLeadSelfConsultants.js`, `fixAnishTwin.js`, `restoreOrphanTeamLead.js`, `deactivateConsultants.js`, `resetBahrainPassword.js`, `reconcileYtdGaps.js`, `backfillEslamManoj.js`, `addAishwaryaTeam.js`, `addInstituteCounselors.js`, `cleanupLucStudents.js` | **One-off, person- or incident-specific.** Historical record only. Do not run without reading. |

### 12.3 Read-only audit / profiling (safe)

`auditStudents.js`, `auditLucStudentsDeep.js`, `profileAdmissionFees.js`, `profileSkillhubFees.js`,
`profileChatContext.js`, `traceStudentProvenance.js`, `verifyTenantSnapshot.js`,
`verifyAprilCommitments.js`, `verifyRevenueApril2026.js`, `verifyWeek17.js`,
`dumpZeroAdmissionFeeLuc.js`, `analyzeExcel.js`, `analyzeExcelData.js`.

`auditStudents.js` is the most useful — it counts missing enrollment numbers and duplicate
`enrollmentNumber` values (which "should be 0 — schema enforces unique+sparse", `:72`).

---

## 13. Seed and import scripts

### 13.1 `seedDatabase.js` — **DESTRUCTIVE**

`npm run seed` → `cd server && node scripts/seedDatabase.js`.

Starts with (`:34-38`):

```js
await User.deleteMany({});
await Consultant.deleteMany({});
await Commitment.deleteMany({});
```

Then creates: LUC admin, 9 LUC team leads, LUC consultants, 2 Skillhub branch logins
(`training@skillhub.com`, `institute@skillhub.com`), 4 Skillhub counsellors — and **writes the
plaintext credentials to `LOGIN_CREDENTIALS.md` and prints them to stdout** (`:226-236`).

**Do not run this against production.** Given [§1.2](#12-the-cluster-is-called-dev-and-it-is-production),
that means: do not run it at all without first pointing `MONGODB_URI` somewhere else.

### 13.2 Non-destructive seeds

| Script | Notes |
|---|---|
| `seedSkillhub.js` | Skillhub-only, **safe in production**. Does not touch LUC data, does not `deleteMany`. |
| `seedTiers.js` | Creates the three `Tier` documents. Run once. |
| `seedTeamEntriesFromExcel.js` | Loads `TeamMonthlyEntry` rows from the source workbook. |
| `fireTestAnnouncement.js` | Posts a test `Announcement` that auto-expires in 2 hours. |

### 13.3 Importers

| Script | Notes |
|---|---|
| `importStudents.js` | Excel → `Student`. Additive. |
| `clearAndImportStudents.js` | **Wipes students first.** The `admissionFeePaid = 0` bug that produced the 626 hidden rows ([§4.8](#48-626-luc-students-are-hidden-from-every-list-and-aggregate)) came from this family of scripts. |
| `importInstituteFromExcel.js` | Institute bulk import. Uses the raw driver and **deletes** `teachers`, `timetableentries`, `attendances` for `skillhub_institute` before inserting (`:237-239`). Shares the pure parser `server/services/institute/scheduleParser.js` with the in-app upload endpoint. |
| `ingestProgramDocs.js` | Builds `DocChunk` rows + embeddings from the program PDFs. `npm run ingest:docs` / `ingest:docs:force`. Costs OpenAI credits. |
| `generateHighlightedPdfs.py` | **Python**, run after ingest via `npm run highlight:docs`. Populates `DocChunk.highlightedPdfPath` / `snippetPath`. Requires `pip install -r server/requirements.txt`. |

### 13.4 Legacy, unused by `npm run seed`

`server/utils/seedUsers.js`, `seed2025.js`, `seedTeamBased2025.js`. Kept for history; do not run.

---

## 14. Backups

`server/services/dbSnapshot.js` — a nightly full-database snapshot to S3.

* Scheduled by `node-cron` at **00:30 Asia/Dubai** (`server/server.js:161-170`).
* **Skipped entirely** in `NODE_ENV=test` and whenever S3 is not configured (`AWS_*` / `S3_BUCKET`).
  When unconfigured it logs `[db-snapshot] S3 not configured — nightly backup disabled` and moves on —
  **there is no alert.** Verify this line is absent from the production logs.
* Enumerates every non-`system.*` collection via `listCollections()`, `find({}).toArray()`, gzips the
  JSON, and uploads to `db-snapshots/YYYY-MM-DD/<collection>.json.gz`, plus a `_manifest.json` with
  per-collection counts and byte sizes.
* Read-only on Mongo. **Loads each collection fully into memory** (`toArray()`) — fine at current
  scale (a few thousand docs), will need streaming if the data grows.
* Manual run: `cd server && node scripts/runDbSnapshot.js` — also the easiest way to get an
  authoritative list of real collection names.
* This is a *logical* backup only. Point-in-time recovery depends on the Atlas tier — see
  [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md).

---

## 15. What the older docs get wrong

[`docs/engineering/03-data-dictionary.md`](../engineering/03-data-dictionary.md) was drafted
2026-04-26 and is 207 commits stale. It remains useful for its **data-classification** columns
(Public / Internal / Confidential / Restricted), which this document does not duplicate. Everything
structural in it should be checked against the code.

**It documents 17 models. There are 27.** These **10** are missing entirely:

| Missing model | Feature it belongs to |
|---|---|
| `Announcement` | Dashboard broadcast banners |
| `Attendance` | Skillhub Institute |
| `InstituteEnrollment` | Skillhub Institute (class rosters) |
| `PaymentPlan` | LUC payment-plan approvals |
| `Teacher` | Skillhub Institute |
| `TeamMonthlyEntry` | Leadership / Executive Overview |
| `TestRecord` | Skillhub Institute (Test Tracker) |
| **`Tier`** | Tier Fight |
| `TierImage` | Tier Fight (AI posters) |
| `TimetableEntry` | Skillhub Institute |

> The handover brief listed 9 missing models. It omitted **`Tier`**. The real count is 10
> (17 + 10 = 27 ✓).

Other corrections:

| Stale claim | Reality |
|---|---|
| "There are 17 models in `server/models/`" (`:26`) | 27. |
| `Notification.type` enum listed without `student_birthday` | `student_birthday` was added for the birthday-reminder cron (`Notification.js:17`). |
| Soft-delete list omits `Commitment` nuance | `Commitment.isActive` exists but the *business* irreversibility rule is `admissionClosed`, enforced only in the controller. |
| No mention of the update-validator query-context trap | The single most important schema behaviour in the codebase ([§4.1](#41-conditional-required-silently-passes-on-update-the-big-one)). |
| No mention of the `outstandingAmount` virtual | Present since the Skillhub work ([§4.2](#42-outstandingamount-is-a-virtual--it-does-not-survive-lean-or-group)). |

And one correction to **`CLAUDE.md`** (the in-repo agent instructions), which is otherwise reliable:

> "Run `server/scripts/backfillCommitmentDate.js` once to populate the field on pre-existing rows
> (`commitmentDate = weekStartDate`)."

The script actually sets `commitmentDate = $ifNull($createdAt, $weekStartDate)` — `createdAt` first,
`weekStartDate` only as a fallback (`backfillCommitmentDate.js:44-46`).

### Things this document could not verify

* **Actual collection names in the live database.** Names marked ✔ in [§3](#3-model-index-all-27)
  are confirmed from raw-driver usage in scripts; the rest are derived from Mongoose's default
  pluralisation. Run `server/scripts/runDbSnapshot.js` to get the authoritative list. Specifically
  **UNVERIFIED**: `hourlyactivities`, `dailyadmissions`, `dailyreferences`, `instituteenrollments`,
  `teammonthlyentries`, `aiusages`, `chatconversations`, `docchunks`, `querycaches`, `docschatlogs`,
  `savedexporttemplates`, `weeklysummaries`, `counters`, `tierimages`, `paymentplans`,
  `announcements`.
* **Actual document counts per collection** (e.g. the "215 chunks" and "626 hidden LUC rows" figures
  are taken from `CLAUDE.md` / memory notes, not measured here). No production query was run.
* **Whether stale `counters` documents still exist** from the pre-`c5effc2` enrollment-number scheme.
  Check before reusing that key format.
* **Whether any orphaned indexes remain in Atlas** from schema fields that were removed (e.g. the
  duplicate `Commitment.leadStage` definition). Mongoose never drops indexes; a manual
  `db.<coll>.getIndexes()` review is warranted.
* **Whether `QueryCache`'s TTL index in production matches the current
  `DOCS_RAG_CACHE_TTL_SECONDS`.** If that env var was ever changed after first boot, the index is
  stale.

---

## 16. Related documents

* [00 — START HERE](00-START-HERE.md) — the handover index and reading order
* [01 — System Architecture](01-system-architecture.md) — how the pieces fit together
* [02 — Application Workflows](02-application-workflows.md) — feature-by-feature tour of what writes these collections
* [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) — Render, Atlas, S3
* [05 — Environment Setup](05-environment-setup.md) — getting a local server talking to the DB
* [06 — API Reference](06-api-reference.md) — the endpoints that read and write these models
* [07 — Roles & Permissions](07-roles-and-permissions.md) — the full role × dataset matrix behind `buildScopeFilter`
* [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) — Mongoose, OpenAI, Groq, AWS SDK
* [09 — Operations, Backup & Recovery](09-operations-backup-recovery.md) — snapshot verification and restore
* [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — the schema drift items in [§4.3](#43-derived-fields-drift-because-hooks-dont-run-on-update) are tracked there
* [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) — `MONGODB_URI` rotation, including the credential committed in `server/.env.example`
* [Engineering: Data Dictionary](../engineering/03-data-dictionary.md) — stale (2026-04-26), but retains useful data-classification levels
* [Engineering: Database & Migrations](../engineering/08-database-and-migrations.md) — stale
* [Legal: Records Retention Schedule](../legal/09-records-retention-schedule.md) — describes retention the code does not implement ([§11](#11-ttl-and-expiry-behaviour))
