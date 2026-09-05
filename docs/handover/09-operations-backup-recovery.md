# 09 — Operations, Backup & Recovery

This is the operations manual for the Sales Tracker (internally *Team Progress Tracker*). It covers
everything that has to keep happening after the code is written: the scheduled jobs the server runs
on its own, the nightly database backup to S3 (including a concrete, tested restore recipe — because
none existed before this document), MongoDB Atlas's own backups and how to verify them, the routine
maintenance calendar, a complete catalogue of the 48 one-off scripts in `server/scripts/` with an
honest re-run safety rating for each, what monitoring exists today (very little), and an
incident-response quick reference for the three things most likely to wake you up: the site is down,
the database is unreachable, or a deploy broke production. Everything here was verified against the
code in this repository. Where something can only be confirmed from a vendor dashboard you do not
have in front of you, it is marked **UNVERIFIED** rather than guessed at.

---

## 1. The operational picture in one table

| Concern | Reality today | Where it lives |
|---|---|---|
| Hosting | One Render web service, auto-deploys from `main` | Render dashboard only — there is **no `render.yaml` or Dockerfile** in the repo |
| Process model | **Single Node process.** Socket.IO has no Redis adapter and the crons have no leader election | `server/services/realtime.js:26`, `server/server.js:158-186` |
| Database | MongoDB Atlas, database `team_progress_tracker`, cluster host `dev.gdddmth.mongodb.net` | `server/config/db.js:5` reads `MONGODB_URI` |
| Backups (app-level) | Nightly full dump of every collection to S3 as gzipped JSON | `server/services/dbSnapshot.js` + cron at `server/server.js:162-166` |
| Backups (vendor) | Atlas snapshots — **existence and cadence UNVERIFIED** | Atlas dashboard |
| Restore | **No restore script, no restore tooling, never tested.** §4 of this document supplies one | — |
| Monitoring | `console.log` captured by Render + two health endpoints | §8 |
| Error tracking / APM / uptime alerting | **None** | §8 |
| CI | **None.** No `.github/` directory, no pipeline, no gate before `main` deploys | — |
| Migrations | Hand-run Node scripts in `server/scripts/`, no migration framework, no ledger of what ran | §7 |

### The single-instance constraint

Do not scale the Render service past one instance without changing code first. Two things break:

1. **Socket.IO** is created with no adapter (`server/services/realtime.js:26`), so a broadcast from
   instance A never reaches a client connected to instance B. Dashboards would silently stop
   live-updating for roughly half of users.
2. **The cron jobs** (`server/server.js:158-186`) are registered per-process with no lock. Two
   instances means two nightly snapshots (harmless — same S3 keys, last writer wins) and two
   birthday-notification runs (mostly harmless — the job is idempotent per day) but the pattern does
   not generalise safely to future jobs.

---

## 2. Scheduled work

Everything scheduled runs **inside the web process**. There is no separate worker, no Render Cron
Job, no external scheduler. If the web service is asleep, restarting, or crash-looping at the
scheduled minute, that run is simply skipped — `node-cron` does not catch up missed runs.

| Job | Schedule | Timezone | Entry point | Skipped when |
|---|---|---|---|---|
| **Nightly DB snapshot to S3** | `30 0 * * *` (00:30) | `Asia/Dubai` | `server/server.js:162` → `server/services/dbSnapshot.js:11` | `NODE_ENV=test`, **or S3 env vars not set** |
| **Student birthday reminders** | `0 8 * * *` (08:00) | `Asia/Dubai` | `server/server.js:177` → `server/services/birthdayNotifier.js:134` | `NODE_ENV=test` |
| **Commitment/Student drift check** | every 24 h, first run 30 s after boot | n/a (interval, not cron) | `server/server.js:151` → `server/services/driftMonitor.js:59` | `NODE_ENV=test` |
| **Docs RAG index load** | once, at boot | n/a | `server/server.js:135` → `docsRagService.loadChunks()` | never; failure is logged and `/api/docs-chat` returns 503 |

Notes that matter operationally:

- The **drift check** interval restarts from zero on every deploy. Because Render redeploys reset the
  process, a service that is deployed daily may run the drift check far more often than daily (once
  30 s after each boot). It is idempotent per admin per 24 h (`driftMonitor.js:35-42` looks for a
  matching notification created in the last day before creating a new one), so this is noise-free but
  worth knowing.
- The **birthday job** only serves `skillhub_institute` (`birthdayNotifier.js:16`). It posts in-app
  `Notification` rows — there is no email or SMS anywhere in this system.
- Nothing alerts you if a scheduled job fails. A failed snapshot prints
  `[db-snapshot] nightly run failed: <message>` to stdout (`server/server.js:164`) and that is the
  entire failure signal. See §8.

---

## 3. Backups

### 3.1 What the nightly snapshot actually does

`server/services/dbSnapshot.js` is ~50 lines and does exactly this, in order:

1. **Bails out silently if S3 is not configured** (`dbSnapshot.js:12-15`). It logs
   `[db-snapshot] S3 not configured (AWS_*/S3_BUCKET) — skipping` and returns `{ skipped: true }`.
   This is a **fail-open** design: no backup, no error, no alert.
2. Requires a live Mongo connection (`readyState === 1`), else throws (`dbSnapshot.js:17`).
3. Stamps the run with `new Date().toISOString().slice(0, 10)` — a **UTC** date — and builds the key
   prefix `db-snapshots/<YYYY-MM-DD>` (`dbSnapshot.js:19-21`).
4. Lists every collection in the database and skips only those whose name starts with `system.`
   (`dbSnapshot.js:22`, `:34`). It is driven by what is *in the database*, not by the model list —
   so an orphaned or hand-created collection is captured too.
5. For each collection: `find({}).toArray()` → `JSON.stringify` → `zlib.gzipSync` → upload to
   `db-snapshots/<date>/<collectionName>.json.gz` with content type `application/gzip`
   (`dbSnapshot.js:35-38`).
6. Uploads `db-snapshots/<date>/_manifest.json` last (`dbSnapshot.js:45`).
7. Logs one summary line (`dbSnapshot.js:47`):
   `[db-snapshot] 27 collections · 12345 docs · 4210KB gz -> s3://<bucket>/db-snapshots/2026-09-04/`

The manifest is the file to read first during any restore. Its shape, built at `dbSnapshot.js:24-44`:

```json
{
  "startedAt": "2026-09-04T20:30:00.123Z",
  "database": "team_progress_tracker",
  "bucket": "<bucket name from S3_BUCKET>",
  "prefix": "db-snapshots/2026-09-04",
  "collections": [
    { "name": "students",   "count": 987,  "bytes": 210344, "key": "db-snapshots/2026-09-04/students.json.gz" },
    { "name": "commitments","count": 5432, "bytes": 884210, "key": "db-snapshots/2026-09-04/commitments.json.gz" }
  ],
  "finishedAt": "2026-09-04T20:30:41.902Z",
  "totalDocs": 12345,
  "totalBytes": 4311040
}
```

### 3.2 The date on the folder is the *UTC* date, not the Dubai date

The cron fires at **00:30 Asia/Dubai**, which is **20:30 UTC on the previous day**. The folder name
comes from the UTC clock (`dbSnapshot.js:20`). So:

> `db-snapshots/2026-09-04/` was written at 00:30 Dubai time on **5 September** and contains the
> state of the database at the **end of 4 September, Dubai time**.

That is intuitive once stated, and deeply confusing at 3am if you have not been told. Cross-check
against `startedAt` in `_manifest.json`, which carries the full UTC timestamp.

A **manual** run (`node scripts/runDbSnapshot.js`) during the Dubai working day stamps *today's* UTC
date and therefore **overwrites** that day's keys — S3 `PutObject` replaces. There is one snapshot
per calendar date maximum. If you need to preserve a pre-change state before a risky migration, copy
the folder aside in S3 first, or dump to a different prefix by hand.

### 3.3 The format is lossy plain JSON — this is the single biggest restore trap

The dump is `JSON.stringify(docs)` on raw driver documents. That is **not** MongoDB Extended JSON.
BSON types are flattened by each type's own `toJSON`. Verified against the driver bundled in this
repo:

| BSON type | What lands in the `.json.gz` file | Restorable by naive import? |
|---|---|---|
| `ObjectId` | bare hex string — `"6a9bd32b27cd26fc54bcc810"` | **No** — becomes a `String` `_id`, every `ref` breaks |
| `Date` | ISO 8601 string — `"2026-01-02T03:04:05.000Z"` | **No** — date filters, `$year`/`$month` aggregations all fail |
| `Decimal128` | `{"$numberDecimal":"12.5"}` | Partially (this shape *is* Extended JSON) |
| `Long` | `{"high":0,"low":5,"unsigned":false}` | **No** |
| `Binary` | base64 string | **No** |

The application's schemas use `ObjectId` and `Date` heavily and (as far as the models show) none of
the other three, so the practical problem is ObjectIds and Dates — and both are fatal if ignored.

**If you `mongoimport --jsonArray` these files straight back into Mongo, the site will come up
looking fine and be quietly, comprehensively broken**: `populate()` returns null, `teamLead` filters
match nothing, every date-ranged KPI reads zero. §4.3 gives a restore script that fixes this.

Indexes are **not** in the dump either. They are recreated on the next app boot because Mongoose's
`autoIndex` default (`true`) is never disabled anywhere in this codebase — but see §4.5, because a
unique index (there are 14 of them across the models) will fail to build if the restored data
contains duplicates.

### 3.4 First thing to do: prove the backup is actually running

The nightly job is **conditional on four environment variables being present on the Render service**
(`server/services/s3.js:13-14`, `:19`):

| Variable | Required? | Default in code |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | yes | none — absence disables S3 entirely |
| `AWS_SECRET_ACCESS_KEY` | yes | none — absence disables S3 entirely |
| `S3_BUCKET` | yes | `''` — absence disables S3 entirely |
| `AWS_REGION` | no | `'me-central-1'` (UAE) |

**UNVERIFIED — needs confirmation.** Whether these are set on the production Render service cannot be
determined from the repository. The feature was merged on 2026-05-30 (`621f1e2 feat(ops): nightly
full-DB snapshot to S3 at 00:30 Asia/Dubai`) and the S3 bucket plus Render env vars were recorded at
the time as a *pending* follow-up task. **Treat "we have nightly backups" as an unproven claim until
you have checked.** Do this in your first hour:

1. **Read the boot log.** Render dashboard → service → Logs, filter for `db-snapshot`. Exactly one of
   these two lines appears at every boot (`server/server.js:167`, `:169`):
   - `[db-snapshot] nightly backup scheduled — 00:30 Asia/Dubai` → S3 is configured. Good.
   - `[db-snapshot] S3 not configured — nightly backup disabled` → **there are no application
     backups at all.** Fix this before anything else on your list.
2. **Look for a completed run.** Filter logs for `[db-snapshot]` over the last 48 h. A successful
   nightly run prints the `N collections · N docs · NKB gz -> s3://…` summary. If you see the
   "scheduled" line but never a summary line, the job is registered but failing or the process is not
   alive at 00:30 Dubai.
3. **Check the bucket.** With AWS credentials for the bucket:
   ```bash
   aws s3 ls s3://<S3_BUCKET>/db-snapshots/ --region <AWS_REGION>
   aws s3 cp s3://<S3_BUCKET>/db-snapshots/<latest-date>/_manifest.json - | head -40
   ```
   Confirm `totalDocs` is plausible and that all 27 collections are listed.
4. **A cheap indirect signal:** the Tier Fight poster history. Posters are stored in S3 under
   `tier-images/YYYY/MM/DD/` with an inline data-URL fallback used only when the S3 upload fails
   (`server/models/TierImage.js:12-15`, `server/controllers/tierController.js:225`). If posters in
   the UI download cleanly via signed URLs, S3 credentials are working.

### 3.5 Retention, cost and growth

- **No lifecycle policy is applied by the code.** Objects accumulate under `db-snapshots/` forever
  unless an S3 bucket lifecycle rule exists. **UNVERIFIED** — check the bucket's Management →
  Lifecycle rules in the AWS console. A sensible starting policy: transition to Infrequent Access at
  30 days, expire at 365 days. Do not expire aggressively before you have a *tested* Atlas restore
  path, because right now this is the only backup you can personally verify.
- **The same bucket holds two unrelated things**: `db-snapshots/` (backups) and `tier-images/`
  (generated posters). A lifecycle rule must be prefix-scoped or it will silently delete poster
  history too.
- **The snapshot loads each collection fully into process memory** (`.toArray()` at
  `dbSnapshot.js:35`). The file's own header comment flags this: it is sized for a few thousand
  documents, and a much larger database would need streaming. The largest single collection is
  `docchunks` — it stores two 1536-float embeddings per chunk (~5 MB of JSON at the current 215
  chunks) and dominates the uncompressed size. Watch Render memory around 00:30 Dubai as the
  `commitments` and `students` collections grow.
- `server/services/s3.js:71` exports a `listObjects()` helper whose comment says it is "used by the
  snapshot browser". **There is no snapshot browser.** Grep confirms `listObjects` has no callers
  anywhere in `server/` or `client/src/`. There is no admin UI for backups; S3 console or CLI is the
  only way to see them.

### 3.6 What is *not* backed up

| Asset | Backed up? | Recovery path |
|---|---|---|
| MongoDB data | Yes — nightly S3 dump (+ Atlas snapshots, unverified) | §4 |
| Application code | Yes — git, GitHub `main` | `git clone` |
| The 16 LUC program PDFs | Yes — committed in `client/public/program-docs/` | git |
| Highlighted PDFs + PNG snippets | No, and they do not need to be | regenerate: `npm run highlight:docs` |
| Docs RAG embeddings | Yes, inside the `docchunks` collection dump | restore, or re-run `npm run ingest:docs:force` (costs ~$0.02 in OpenAI embeddings) |
| Tier poster images in S3 | **No.** They live only in `tier-images/` in the same bucket | none — bucket loss loses poster history |
| Render environment variables (all secrets) | **No.** They exist only in the Render dashboard | See [11 — Credentials & Access](11-credentials-and-access-handover.md) |
| Render service configuration (build/start commands, region, health check path) | **No.** Dashboard-only, no `render.yaml` | manual reconstruction from [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) |

> The last two rows are a real single-point-of-failure. If the Render account is lost, nothing in
> this repository tells you how the service was configured. Consider committing a `render.yaml` (with
> secrets left as `sync: false`) as an early piece of work.

---

## 4. Recovery

### 4.1 Choose the right procedure

| Situation | Use | Why |
|---|---|---|
| Whole database lost / corrupted, Atlas backups exist and work | **A — Atlas restore** (§4.2) | Type-faithful, includes indexes, point-in-time if enabled |
| Whole database lost, Atlas backups missing or unusable | **B — S3 snapshot restore** (§4.3) | Loses up to 24 h; needs the type-revival script |
| One collection wiped by a bad script | **C — Single-collection restore** (§4.4) | Surgical; the rest of the DB keeps serving |
| A handful of documents deleted | **C**, filtered to those `_id`s | Same |
| Bad deploy, data intact | Do **not** restore. Roll back the deploy — §9.3 | Restoring is strictly more dangerous than redeploying |

**Before any restore, always:** snapshot the current (broken) state first, so you can go back and so
forensics is still possible. `node server/scripts/runDbSnapshot.js` writes today's folder — but note
§3.2, it will overwrite today's nightly if one already ran. Copy the existing folder aside in S3
first if that matters.

### 4.2 Procedure A — restore from MongoDB Atlas (preferred)

**UNVERIFIED — needs confirmation:** whether Atlas backups are enabled on this cluster, at what
cadence and retention, and whether continuous/point-in-time recovery is on. This depends on the
cluster tier (shared/M0 tiers have no snapshots at all). Confirm in Atlas → Cluster → Backup **before
you need it**.

1. Atlas → the cluster → **Backup** → choose the snapshot (or PITR timestamp) immediately preceding
   the incident.
2. **Restore to a NEW cluster, not over the existing one.** Keep the damaged cluster for forensics
   and as a fallback if the snapshot turns out to be worse.
3. Verify on the new cluster before cutting over — run the count checks in §4.5.
4. Render dashboard → service → Environment → change `MONGODB_URI` to the new cluster's connection
   string, keeping the database name `team_progress_tracker`.
5. Saving an env var triggers a restart. Watch the log for
   `MongoDB Connected: <host>` (`server/config/db.js:7`) and
   `Server running in production mode on port …`.
6. Run the post-restore checklist (§4.5).
7. Tell the team exactly how much data was lost — "everything entered after 4 September 20:30 UTC is
   gone, please re-enter". Be specific; people will re-enter it.

### 4.3 Procedure B — restore from an S3 snapshot

**This procedure has never been executed against production. It is written from the code, and the
type-revival step below was verified by a round-trip test against an in-memory MongoDB (dump a
`Student` with `ObjectId` refs and nested EMI dates exactly the way `dbSnapshot.js` does, wipe,
restore, confirm `findById` matches, `teamLead` is an `ObjectId`, nested `emis[].dueDate` /
`emis[].paidOn` are `Date`s, and a `$year: '$closingDate'` aggregation groups correctly). Treat the
whole procedure as untested until you rehearse it — see §6, "quarterly".**

#### Step 1 — Fetch and inspect the snapshot

```bash
export SNAP=2026-09-04
aws s3 cp "s3://$S3_BUCKET/db-snapshots/$SNAP/_manifest.json" - | jq '.totalDocs, .collections[] | .name, .count'
mkdir -p /tmp/restore && aws s3 sync "s3://$S3_BUCKET/db-snapshots/$SNAP/" /tmp/restore/
gunzip -k /tmp/restore/*.json.gz
```

Sanity-check the counts in the manifest against what you expect. A snapshot whose `students` count is
zero is a snapshot of an already-broken database.

#### Step 2 — Restore into an EMPTY database, never over live data

Create a fresh database name (e.g. `team_progress_tracker_restore_20260904`) on the same cluster or a
scratch cluster. You will point the app at it only after verification.

#### Step 3 — Write the restore script

This file does not exist in the repository. Create it at `server/scripts/restoreDbSnapshot.js`. It
walks each Mongoose schema for `ObjectId` and `Date` paths (including paths inside document arrays
such as `Student.emis[]`) and revives only those, leaving every other field byte-identical — which
matters, because legacy documents carry fields that are no longer declared in the schemas and a
schema-strict cast would silently drop them.

```js
/**
 * Restore a db-snapshots/<date>/ dump produced by services/dbSnapshot.js.
 *
 * The dump is plain JSON, NOT Extended JSON: ObjectIds are hex strings and
 * Dates are ISO strings. This script revives those two types using the
 * Mongoose schemas as the type map, and leaves every other field untouched
 * (so undeclared legacy fields survive).
 *
 *   node scripts/restoreDbSnapshot.js --dir /tmp/restore --uri "<target-uri>"
 *   node scripts/restoreDbSnapshot.js --dir /tmp/restore --uri "<uri>" --apply
 *
 * Without --apply it reports what it would insert and writes nothing.
 * REFUSES to run against a non-empty collection unless --drop is passed.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const DIR = arg('--dir');
const URI = arg('--uri', process.env.MONGODB_URI);
const APPLY = process.argv.includes('--apply');
const DROP = process.argv.includes('--drop');

// Load every model so mongoose.models is populated and we get its schema.
const MODEL_DIR = path.join(__dirname, '..', 'models');
for (const f of fs.readdirSync(MODEL_DIR).filter((x) => x.endsWith('.js'))) require(path.join(MODEL_DIR, f));

// collectionName -> Model
const byCollection = {};
for (const name of Object.keys(mongoose.models)) {
    const M = mongoose.models[name];
    byCollection[M.collection.collectionName] = M;
}

// Collect dotted paths whose schema type is ObjectId / Date, recursing into
// sub-schemas (document arrays and single nested docs).
function typedPaths(schema, prefix = '') {
    const out = { oid: [], date: [] };
    for (const [p, t] of Object.entries(schema.paths)) {
        const full = prefix ? `${prefix}.${p}` : p;
        if (t.instance === 'ObjectId') out.oid.push(full);
        else if (t.instance === 'Date') out.date.push(full);
        if (t.schema) {
            const child = typedPaths(t.schema, full);
            out.oid.push(...child.oid);
            out.date.push(...child.date);
        }
    }
    return out;
}

// Walk a dotted path, descending into arrays as it goes, and map the leaf.
function setPath(doc, parts, fn) {
    if (doc == null) return;
    if (Array.isArray(doc)) { for (const el of doc) setPath(el, parts, fn); return; }
    const [head, ...rest] = parts;
    if (!rest.length) { if (doc[head] != null) doc[head] = fn(doc[head]); return; }
    setPath(doc[head], rest, fn);
}

const isHex24 = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

function revive(doc, tp) {
    for (const p of tp.oid) setPath(doc, p.split('.'), (v) => (isHex24(v) ? new mongoose.Types.ObjectId(v) : v));
    for (const p of tp.date) setPath(doc, p.split('.'), (v) => (typeof v === 'string' ? new Date(v) : v));
    return doc;
}

(async () => {
    if (!DIR || !URI) { console.error('Usage: --dir <snapshot dir> --uri <target mongodb uri> [--apply] [--drop]'); process.exit(1); }
    await mongoose.connect(URI);
    console.log(`Target: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
    console.log(`Mode  : ${APPLY ? '*** APPLY (will write) ***' : 'DRY-RUN'}`);

    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json.gz') && f !== '_manifest.json');
    let grand = 0;

    for (const file of files.sort()) {
        const collName = file.replace(/\.json\.gz$/, '');
        const buf = zlib.gunzipSync(fs.readFileSync(path.join(DIR, file)));
        const docs = JSON.parse(buf.toString());
        const Model = byCollection[collName];

        if (!Model) {
            console.warn(`  ! ${collName}: no Mongoose model — inserting with _id revival only`);
        }
        const tp = Model ? typedPaths(Model.schema) : { oid: ['_id'], date: [] };
        const revived = docs.map((d) => revive(d, tp));

        const coll = mongoose.connection.db.collection(collName);
        const existing = await coll.countDocuments({});
        if (existing > 0 && !DROP) {
            console.error(`  x ${collName}: target has ${existing} docs — refusing. Pass --drop to replace.`);
            continue;
        }

        console.log(`  ${collName.padEnd(24)} ${String(docs.length).padStart(6)} docs  (oid paths ${tp.oid.length}, date paths ${tp.date.length})`);
        grand += docs.length;

        if (!APPLY) continue;
        if (existing > 0 && DROP) await coll.deleteMany({});
        if (revived.length) await coll.insertMany(revived, { ordered: false });
    }

    console.log(`\n${APPLY ? 'Inserted' : 'Would insert'} ${grand} documents across ${files.length} collections.`);
    await mongoose.disconnect();
})().catch((e) => { console.error('RESTORE FAILED:', e); process.exit(1); });
```

Two deliberate design points, because a restore script that surprises you is worse than none:

- It **refuses to write into a non-empty collection** unless you pass `--drop`. There is no way to
  half-restore over live data by accident.
- It uses the **raw driver** `insertMany`, not `Model.insertMany`. Mongoose model inserts run schema
  validation and pre-save hooks, and older documents will legitimately fail today's validators
  (`Student.sno`, `courseDuration` enums and so on — the models have tightened over time). A restore
  must reproduce what was there, not what today's schema wishes had been there.

#### Step 4 — Dry run, then apply

```bash
cd server
node scripts/restoreDbSnapshot.js --dir /tmp/restore --uri "<restore-db-uri>"
node scripts/restoreDbSnapshot.js --dir /tmp/restore --uri "<restore-db-uri>" --apply
```

Compare the printed per-collection counts against `_manifest.json`. They must match exactly.

#### Step 5 — Cut over

Point `MONGODB_URI` on Render at the restored database and restart, exactly as in §4.2 steps 4–6.
Then run §4.5.

### 4.4 Procedure C — restore a single collection or a few documents

Same script, but pull only the one file:

```bash
aws s3 cp "s3://$S3_BUCKET/db-snapshots/$SNAP/students.json.gz" /tmp/one/
```

For a **whole collection** into a scratch database, run the script with `--dir /tmp/one` against a
restore database, then move the documents across with `mongoexport`/`mongoimport` **in Extended JSON
mode** (`mongoexport` emits proper `$oid`/`$date` wrappers, so this hop is type-safe — unlike the
snapshot format itself):

```bash
mongoexport --uri "<restore-uri>" --collection students --out students.ejson
mongoimport --uri "<live-uri>"    --collection students --file students.ejson
```

For **a few documents**, restore to the scratch database, then copy only the needed `_id`s across
with a short script or `mongoexport --query '{"_id":{"$oid":"..."}}'`. Never re-import a whole
collection over live data to recover three rows — you will roll back everyone else's work since the
snapshot.

Record what you did and why. There is no audit log collection in this system, so the incident write-up
is the only record that will exist.

### 4.5 Post-restore verification checklist

Run all of these. The dangerous failure mode of Procedure B is a restore that *looks* successful.

```bash
# 1. Liveness
curl -s https://<host>/api/health          # {"success":true,"message":"Server is running"}
curl -s https://<host>/api/docs-chat/health | jq   # ok:true, chunksLoaded > 0
```

```js
// 2. In mongosh against the restored DB — types must be right, not just counts.
db.students.countDocuments({})
db.students.findOne()._id instanceof ObjectId          // must be true
db.students.findOne().createdAt instanceof Date        // must be true
db.students.countDocuments({ closingDate: { $type: "string" } })   // MUST be 0
db.commitments.countDocuments({ teamLead: { $type: "string" } })   // MUST be 0
db.users.countDocuments({ role: "admin", isActive: true })         // at least 1
```

```js
// 3. Aggregation-shaped check — proves Dates are real Dates end to end.
db.students.aggregate([{ $group: { _id: { $year: "$closingDate" }, n: { $sum: 1 } } }])
```

Then in the running application:

- Log in as an **admin** and confirm the LUC dashboard KPIs are non-zero and match expectations.
- Switch the admin org toggle to **Skillhub** and confirm both branch views render.
- Log in as one **team_lead** and confirm they see only their own team.
- Open **Student Database** — check `teamLead` and `consultant` names resolve (a blank name column
  means `populate()` is failing, which means ObjectIds did not revive).
- Open **Export Center → Students → Preview** and run one pivot. Pivots exercise `$group` over dates
  and refs, so a green pivot is a strong end-to-end signal.
- Confirm indexes built: `db.students.getIndexes()` should show the `enrollmentNumber` unique index.
  Mongoose builds indexes at boot (`autoIndex` is never disabled in this codebase), but a **unique
  index will fail to build if the restored data contains duplicates** — Mongoose logs the failure and
  carries on. Search the boot logs for `index build failed` / `E11000` before declaring victory.
  There are 14 unique indexes across the models; the ones most likely to bite are `User.email`,
  `Student.enrollmentNumber`, `SavedExportTemplate (user,name)`, and the compound uniques on
  `TestRecord`, `HourlyActivity`, `DailyAdmission`, `DailyReference`, `TeamMonthlyEntry`.

---

## 5. MongoDB Atlas backups — verify, then rely

The application-level S3 dump is a safety net, not a backup strategy. Atlas snapshots are better in
every way (type-faithful, indexed, point-in-time capable) — *if* they are enabled.

Do this once, in your first week, and write the answers into this document:

| Question | Where to look | Answer |
|---|---|---|
| What cluster tier is it? | Atlas → Cluster overview | **UNVERIFIED** — M0/shared tiers have **no** snapshot backups |
| Are snapshots enabled? | Atlas → Cluster → Backup | **UNVERIFIED** |
| Snapshot frequency and retention? | Atlas → Backup → Policy | **UNVERIFIED** |
| Is continuous / point-in-time recovery on? | Atlas → Backup → Policy | **UNVERIFIED** |
| Is cross-region snapshot copy on? | Atlas → Backup → Policy | **UNVERIFIED** |
| Which region is the cluster in? | Atlas → Cluster overview | **UNVERIFIED.** The older `docs/engineering/04-deployment-runbook.md:15-19` claims Atlas Ireland `eu-west-1` and Render Singapore `ap-southeast-1`, but that document is 207 commits stale and the code's S3 default region is `me-central-1` (UAE). Do not trust the old doc; read the dashboards. |

Two related notes:

- **Region latency is a real operational concern here.** `DEPLOYMENT.md:432-443` records that a
  Render↔Atlas region mismatch pushes boot time to ~25 s (the Docs RAG index ships ~5 MB of
  embeddings over the wire at every boot) versus under 2 s when colocated. Slow boots widen every
  deploy's unavailability window.
- The cluster host is literally named `dev` (`dev.gdddmth.mongodb.net`, visible in
  `server/.env.example`). **It is production.** There is no separate development database. Every
  local `node scripts/…` run in this repo hits live data unless you deliberately point
  `MONGODB_URI` somewhere else. This is the most dangerous thing about the system.

---

## 6. Routine maintenance calendar

Nothing below is automated. It happens because someone puts it in a calendar.

### Daily (2 minutes)

| Task | How |
|---|---|
| Confirm last night's snapshot ran | Render logs, filter `[db-snapshot]` — look for the `N collections · N docs` summary line |
| Scan for unhandled errors | Render logs, filter `Error:` — the `unhandledRejection` handler at `server/server.js:190-194` logs the message then **kills the process**, so a repeated `Error:` line followed by a restart is a crash loop |
| Site is up | Load the app, or `curl https://<host>/api/health` |

### Weekly

| Task | How |
|---|---|
| Review AI spend | Admin dashboard → AI Usage tab, backed by `GET /api/ai/usage` (`server/routes/ai.js:25`, admin-only) and the `AIUsage` collection. Both OpenAI and Groq are billed per token; there is no spend cap in code |
| Review Docs RAG quality | `GET /api/docs-chat/stats` (`server/routes/docsChat.js:121`, admin-only) or the `/admin/docs-rag` page. `tier: 3` rows are refusals — a cluster of them means a corpus gap, not a bug |
| Check reconciliation drift | The drift monitor drops an admin notification when LUC closed commitments >7 days old still lack a linked Student (`server/services/driftMonitor.js:12-32`). Clear them on the Reconciliation page |
| Skim Atlas metrics | Connections, slow queries, disk. Atlas Performance Advisor will propose indexes |

### Monthly

| Task | How |
|---|---|
| Dependency audit | `cd server && npm audit` and `cd client && npm audit`. Fix high/critical; be conservative on the client — CRA 5 (`react-scripts 5.0.1`) reports transitive dev-only advisories that are noisy and mostly not exploitable in a build tool |
| Dependency updates | `npm outdated` in both. **Never bulk-`npm update`.** Update one package per commit and redeploy — there is no CI and no staging, so every upgrade is tested in production by definition |
| Data-quality audit | `node server/scripts/auditStudents.js` and `node server/scripts/auditLucStudentsDeep.js` — both read-only. They surface duplicates, impossible dates and fee anomalies |
| S3 growth and cost | `aws s3 ls --summarize --human-readable --recursive s3://<bucket>/db-snapshots/`. Decide on a lifecycle policy (§3.5) |
| Review inactive users | Users are soft-deleted (`isActive: false`). Confirm departed staff are deactivated — see [07 — Roles & Permissions](07-roles-and-permissions.md) |

### Quarterly

| Task | How |
|---|---|
| **Restore drill** | Take the latest S3 snapshot, restore it into a scratch database using §4.3, run the §4.5 checklist. Then do the same for an Atlas snapshot. **This has never been done.** Until it has, the recovery plan is a hypothesis |
| Rotate secrets | See [11 — Credentials & Access](11-credentials-and-access-handover.md) |
| Review Render service config | Build/start commands, region, instance count (must stay 1 — §1), health check path |
| Full test run | `cd server && npx jest` (**not** `npm test` — see §10) and `cd client && npm test` |

### Pinned-dependency warnings

- `react-data-grid` is pinned at exactly `7.0.0-beta.59` (no caret) in `client/package.json:26`.
  Beta releases move fast and have broken CRA setups before. Bump deliberately, and re-run the Export
  Center preview tests.
- `react-scripts` is `5.0.1`. Create React App is unmaintained. Migrating to Vite is a known future
  piece of work — see [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md).
- `xlsx` is `^0.18.5` on both server and client and has known advisories. It is used only for
  trusted, internally-produced workbooks (imports and exports), which limits exposure — but any
  future feature that accepts user-uploaded spreadsheets needs to revisit this.

---

## 7. The `server/scripts/` catalogue

48 scripts. They are a mix of live operational tools, forward migrations, and one-off historical
fixes that will never be needed again but were never deleted. There is **no migration framework and
no record of what has already been run** — the only ledger is git history and the data itself. Every
idempotent script is designed to be safe to re-run precisely because of that.

**Universal rules before running anything here:**

1. Every script reads `MONGODB_URI` from `server/.env`. That points at **production**. There is no
   dev database (§5).
2. Run from the `server/` directory: `cd server && node scripts/<name>.js`.
3. If the script offers a dry-run flag, **always run the dry run first** and read the output.
4. Take a snapshot first for anything that writes: `node scripts/runDbSnapshot.js` (mind §3.2's
   overwrite behaviour).

### 7.1 Safe — read-only, no database writes

Run these freely. They print reports and exit.

| Script | What it does |
|---|---|
| `analyzeExcel.js` | Dumps headers + 3 sample rows of `LUC_STUDENT_DATA BASE _2025.xlsx`. Note `*.xlsx` is gitignored, so the file may not exist in a fresh clone |
| `analyzeExcelData.js` | Per-column value/uniqueness profile of the same workbook |
| `auditStudents.js` | Student data-quality audit: totals by org × status, required-field coverage, orphan refs |
| `auditLucStudentsDeep.js` | Deep dive on LUC dates and fees — the report behind the "dates in the future / fees look wrong" investigations |
| `profileAdmissionFees.js` | Distribution of LUC `admissionFeePaid`; the evidence for the net-vs-gross VAT convention |
| `profileSkillhubFees.js` | Same for Skillhub `admissionFeePaid` / `registrationFee` |
| `profileChatContext.js` | Dumps distinct values and ranges across 8 collections, used to write the chatbot system prompt |
| `traceStudentProvenance.js` | Compares `closingDate` against `createdAt` to prove which rows were bulk-imported vs entered live |
| `verifyAprilCommitments.js` | One-off reconciliation of an April 2026 KPI discrepancy |
| `verifyRevenueApril2026.js` | One-off: which date fields are actually populated on closed LUC commitments |
| `verifyWeek17.js` | One-off: UTC-vs-IST week-boundary reconciliation |
| `verifyTenantSnapshot.js` | Live smoke test of `services/tenantSnapshot` — prints cold/warm build times |
| `dumpZeroAdmissionFeeLuc.js` | Writes matching rows to a timestamped JSON file under `server/dumps/`. Reads the DB, writes only to local disk |
| `runDbSnapshot.js` | Manual trigger of the nightly S3 snapshot. Read-only on Mongo; **writes to S3 and overwrites today's snapshot folder** (§3.2) |

### 7.2 Idempotent — safe to re-run, converge to the same state

| Script | What it does | Flags |
|---|---|---|
| `migrateOrganization.js` | Backfills `organization: 'luc'` on any doc missing it across 7 collections. Skips a collection entirely when the missing count is 0 | none |
| `backfillCommitmentDate.js` | Sets `commitmentDate = createdAt` on Commitments missing the required field. Only touches missing rows | none |
| `backfillAutoCloseAdmission.js` | Sets `admissionClosed: true` + `admissionClosedDate` where `leadStage='Admission'` and `status='achieved'`. Does **not** set `closedAmount` — revenue stays under-counted for those rows until someone edits them | `--dry-run` |
| `backfillCommitmentStudentLinks.js` | Three-tier exact/fuzzy matcher linking Commitment ↔ Student for LUC. Tier 3 leftovers are surfaced on the Reconciliation page rather than guessed | `--dry-run` |
| `backfillStudentDateTimezone.js` | Repairs LUC `enquiryDate`/`closingDate` shifted by the old local-midnight→UTC bug; renormalises to UTC midnight and recomputes `month`. Rows already at UTC midnight are skipped | dry by default, `--commit` to write |
| `backfillMeetingDateTimezone.js` | Same repair for `Meeting.meetingDate` | dry by default, `--commit` |
| `recomputeStaleConversionTime.js` | Recomputes cached `Student.conversionTime` where it disagrees with `closingDate - enquiryDate`. Needed because `updateOne($set)` bypasses the pre-validate hook | dry by default, `--apply` |
| `renamePaymentPlanApproved.js` | `PaymentPlan.status` `'Submitted'` → `'Approved and Submitted'`. A second run matches nothing | none |
| `roundSkillhubWholeAed.js` | Rounds Skillhub money fields (incl. each EMI) to whole AED. Deliberately leaves LUC alone — LUC's fee amounts carry the intentional net/gross-VAT convention | none |
| `normalizeInstituteSubjects.js` | Maps historical free-text Institute subjects onto the canonical list; leaves unrecognised values untouched and reports them. Deliberately preserves CHRM timetable history | dry by default, `--apply` |
| `deactivateConsultants.js` | Soft-deletes a hard-coded list of departed consultants (`isActive: false`). Historical data preserved | none |
| `excludeLegacyHourly.js` | Sets `excludeFromHourly: true` on Ameen & Zakeer (Institute) so they drop out of the Hourly grid but stay assignable on student forms | none |
| `addInstituteCounselors.js` | Adds Ameen & Zakeer as Institute consultants if absent. Does not touch the `institute@skillhub.com` login | none |
| `fixTeamLeadSelfConsultants.js` | Flips an active team lead's own self-consultant row from inactive → active. Only touches rows that are actually wrong | none |
| `fixAnishTwin.js` | Resolves the duplicate "Anish" in Team Shaik. Only deletes a record with **zero** entries and only when a data-bearing one is kept | none |
| `fixAdmissionClosedStatus.js` | Sets `status='achieved'` on Commitments where `admissionClosed=true` but status was not achieved | **dry-run by default**, `--apply` |
| `restoreOrphanTeamLead.js` | Recreates the deleted "Team Bahrain" User with the same hard-coded `_id` so existing `teamLead` references resolve. Created inactive with a random password | dry by default, `--apply` |
| `reconcileYtdGaps.js` | Reactivates the Bahrain lead and upserts a missing consultant's two months, to make dashboard YTD match the reference workbook | none |
| `backfillEslamManoj.js` | Upserts three missing 2026 months for one consultant under his previous team. Keyed on consultant+year+month | none |
| `addAishwaryaTeam.js` | Creates a placeholder inactive-in-practice team lead + self-consultant + one past-month entry so a departed team still appears in the YTD rollup | none |
| `seedTiers.js` | Upserts the three competition tiers with consultant membership. Admin can edit membership in the UI afterwards | none |
| `seedSkillhub.js` | **Non-destructive.** Creates only Skillhub logins and counselors; never touches LUC data. **Resets the two branch passwords** and rewrites `LOGIN_CREDENTIALS.md` | none |
| `createManager.js` | Creates or updates the manager account. **Contains a hard-coded plaintext password in the source** (`scripts/createManager.js:6`) — change it before running, and see [11 — Credentials](11-credentials-and-access-handover.md) | none |
| `ingestProgramDocs.js` | Docs RAG ingestion. Idempotent by `contentHash` — unchanged chunks are skipped, so re-runs cost almost nothing in embeddings | `--dry-run` (no DB, no OpenAI); **`--force` deletes all LUC `DocChunk`s first** |
| `generateHighlightedPdfs.py` | Regenerates the pre-highlighted single-page PDFs from `DocChunk` rows. Overwrites output files; ~20 s for the full corpus. Requires `pip install -r server/requirements.txt` | `--limit N` |
| `seedTeamEntriesFromExcel.js` | Upserts `TeamMonthlyEntry` per (consultant, year, month) from the leadership workbook. Never deletes — **unless** `WIPE_YEAR=1`, which deletes every entry for the target year first | env: `YEAR`, `EXCEL_PATH`, `DRY_RUN=1`, **`WIPE_YEAR=1` (destructive)** |
| `fireTestAnnouncement.js` | Creates a test announcement banner (auto-expires in 2 h). `--clear` deletes all test announcements. Visible to every LUC user on refresh | `--clear` |
| `resetBahrainPassword.js` | Resets one specific user's password to the value passed as `argv[2]`. Idempotent in the sense that re-running just sets it again | password as first argument (min 8 chars) |

### 7.3 Destructive — read this row twice before running

| Script | What it destroys | Notes |
|---|---|---|
| `seedDatabase.js` (= `npm run seed`) | **`deleteMany({})` on `users`, `consultants` AND `commitments`** (`scripts/seedDatabase.js:35-37`) | Recreates LUC admin + 9 team leads + consultants + 2 Skillhub branch logins + 4 counselors, generates random passwords, and **overwrites `LOGIN_CREDENTIALS.md` at the repo root with plaintext passwords** (`:224-226`). Combined with "the cluster named dev is production", running this to "try things out" destroys the business. Treat `npm run seed` as a live-fire command |
| `clearAndImportStudents.js` | **`Student.deleteMany({})`** — every student, both orgs (`:102`) | Then re-imports from an Excel workbook. Only appropriate on an empty database |
| `importStudents.js` | Nothing directly — but it is **NOT idempotent** | Calls `Student.create(...)` per row with no upsert (`:264`). Running it twice duplicates every student. This is the most plausible origin of the known duplicate-student data-quality issue |
| `importInstituteFromExcel.js` | `deleteMany({organization:'skillhub_institute'})` on `teachers`, `timetableentries`, `attendances` (`:237-239`) | Then inserts fresh. Was written as a one-time import for a then-new feature. `--dry-run` parses and reports without writing — always use it first. For ongoing schedule changes use the in-app **Timetable → Upload Schedule** flow instead, which replaces only the teachers present in the file |
| `fixLegacyDataBugs.js` | Deletes duplicate Student rows | Tiered: no flag = dry run; `--apply-safe` = Tier 1 (casing normalisation, status backfill, delete **exact** duplicates keeping the oldest `_id`); `--apply-all` also deletes future-dated duplicates. Zero-fee rows, overpaid rows and orphan refs are reported only, never auto-fixed |
| `cleanupLucStudents.js` | Auto-fixes a year-2926 date typo | Dry-run by default; `--apply` writes. Everything else (future dates, duplicate pairs, zero fees, overpayments) is report-only |
| `ingestProgramDocs.js --force` | `DocChunk.deleteMany({organization:'luc'})` (`:762`) | Then re-embeds the whole corpus (~$0.02, 2–3 min). Also reachable from the admin UI at `/admin/docs-rag` → "Force re-ingest", and from `POST /api/docs-chat/admin/reingest?force=true` |
| `seedTeamEntriesFromExcel.js` with `WIPE_YEAR=1` | Every `TeamMonthlyEntry` for the target year | Without `WIPE_YEAR` it is a safe upsert |

### 7.4 Scripts you will almost certainly never need again

`addAishwaryaTeam.js`, `backfillEslamManoj.js`, `reconcileYtdGaps.js`, `fixAnishTwin.js`,
`fixTeamLeadSelfConsultants.js`, `restoreOrphanTeamLead.js`, `deactivateConsultants.js`,
`resetBahrainPassword.js`, `verifyAprilCommitments.js`, `verifyRevenueApril2026.js`,
`verifyWeek17.js`, `analyzeExcel.js`, `analyzeExcelData.js`.

These encode specific named people, teams and dates from 2026 incidents. They are kept for
provenance — each one's header comment explains a real data decision, and that context is worth more
than the code. Do not delete them without reading the headers; do not run them without understanding
that they hard-code individuals.

---

## 8. Monitoring — what exists, and the honest gaps

### What exists

| Surface | Mechanism | Where |
|---|---|---|
| Liveness | `GET /api/health` → `{ success: true, message: "Server is running" }`. **Public, no auth** | `server/server.js:99-104` |
| Docs RAG readiness | `GET /api/docs-chat/health` → 200 when `chunksLoaded > 0` and the index loaded, else **503**. Public, no auth. Also reports `groqConfigured`, `openaiConfigured`, `lastIngestAt`, `uptime` | `server/routes/docsChat.js:61-76` |
| Application logs | Unstructured `console.log` / `console.error`, captured by Render's log stream | throughout |
| Database metrics | MongoDB Atlas dashboard (connections, slow queries, disk, Performance Advisor) | Atlas |
| AI cost | `AIUsage` collection + admin-only `GET /api/ai/usage` | `server/routes/ai.js:25` |
| Docs RAG analytics | Admin-only `GET /api/docs-chat/stats` — chunk counts, cache hit rate, top queries, refusals in the last 24 h | `server/routes/docsChat.js:121` |
| Data drift | Daily in-app notification to admins when closed commitments lack a linked Student | `server/services/driftMonitor.js` |

Useful log strings to filter on in Render:

| String | Meaning |
|---|---|
| `Server running in production mode on port` | Successful boot |
| `MongoDB Connected:` | Database reachable |
| `Docs RAG: loaded N chunks` | Index built |
| `Docs RAG: failed to load chunks` | `/api/docs-chat` will 503 until re-ingest |
| `[db-snapshot] nightly backup scheduled` | S3 configured — backups armed |
| `[db-snapshot] S3 not configured` | **No application backups** |
| `[db-snapshot] nightly run failed:` | Backup failed last night |
| `[birthdays] posted N notification(s)` | Birthday job ran |
| `Error:` (bare, at top level) | An unhandled promise rejection — **the process is about to exit** |

### What is missing — stated plainly

- **No error tracking.** No Sentry, no Rollbar, nothing. A 500 in production leaves a stack trace in
  a log stream nobody is watching and no other trace. The error handler
  (`server/middleware/errorHandler.js:6`) does `console.log(err)` and returns a generic message.
- **No APM.** No request tracing, no slow-query surfacing, no latency percentiles.
- **No uptime monitoring or alerting.** If the site goes down at 2am on a Friday, you find out when a
  user tells you. `/api/health` is public precisely so an external monitor can poll it — nothing
  polls it today (**UNVERIFIED** whether a Render health-check path is configured on the service;
  check the dashboard).
- **No log aggregation or retention.** Render's log buffer is all there is; it is finite and lost on
  service deletion.
- **No structured logging.** Log lines cannot be parsed, filtered by severity, or correlated by
  request.
- **Logs are not PII-safe.** `errorHandler.js:6` prints the whole Mongoose error object, which can
  include document fragments and query filters containing student names, phone numbers and emails.
  Scrub before piping logs anywhere external.
- **No audit log.** Nothing records who changed or deleted what. `Commitment` tracks `createdBy` /
  `lastUpdatedBy`, but there is no general audit collection. After an incident, "who did this?" is
  usually unanswerable.
- **No alert on backup failure**, which is the gap most likely to matter, because it is silent by
  design (§3.1 step 1).

### The cheapest high-value fixes, in order

1. **An external uptime check on `/api/health`** — five minutes of setup, alerts on 3 consecutive
   failures. Highest value per minute spent of anything in this document.
2. **A second uptime check on `/api/docs-chat/health`** with a longer grace period (it 503s
   legitimately for ~25 s during a cold boot on a remote Atlas region — see §5).
3. **Alert on backup silence.** A daily external check that today's `db-snapshots/<date>/_manifest.json`
   exists in S3. Without this, backups can be dead for months undetected.
4. **Sentry on the Express error handler**, with PII scrubbing.

---

## 9. Incident response quick reference

Common to every incident: **write down what you did, with timestamps.** There is no audit log, so
your notes are the only record.

### 9.1 "The site is down"

```
1. curl -s -o /dev/null -w "%{http_code}\n" https://<host>/api/health
```

| Result | Meaning | Next step |
|---|---|---|
| `200` | Backend is fine | The problem is the frontend or one user's network. Hard-refresh; check the browser console; check whether it is one user or all |
| `502` / `503` / timeout | Process down or restarting | Go to step 2 |
| Connection refused / DNS failure | Render service or DNS problem | Render dashboard → is the service "Live"? Check Render's status page |

```
2. Render dashboard → service → Logs. Scroll to the last boot attempt.
```

| What you see | Diagnosis | Fix |
|---|---|---|
| Repeating `Error: <message>` then a restart | An unhandled promise rejection is killing the process (`server/server.js:190-194` calls `process.exit(1)`) — Render restarts, it happens again: **crash loop** | Identify the rejecting code from the message. If it followed a deploy, roll back (§9.3). This handler is aggressive by design; the message is your only clue |
| `Error: <mongo message>` then exit, no HTTP server line | `connectDB` failed at boot and called `process.exit(1)` (`server/config/db.js:8-10`) | Go to §9.2 |
| Out-of-memory / SIGKILL | Memory exhaustion. Most likely around 00:30 Dubai, when the snapshot loads whole collections into memory (§3.5) | Restart to restore service; then either raise the Render instance size or rewrite `dbSnapshot.js` to stream |
| Build failed, never started | Deploy problem, previous version is still serving or nothing is | Read the build log; roll back (§9.3) |
| Nothing recent at all | Service suspended (billing?) or scaled to zero | Render dashboard → service status and account billing |

```
3. Restore service fastest: Render → Manual Deploy → "Deploy latest commit"
   (restarts the process), or roll back per §9.3 if a deploy caused it.
```

### 9.2 "The database is unreachable"

Symptom: boot logs show a Mongo connection error and the process exits, or requests hang then 500.

Work through in order:

| # | Check | How |
|---|---|---|
| 1 | Is Atlas itself up? | MongoDB Atlas status page; Atlas dashboard cluster state |
| 2 | Is the cluster paused? | Atlas auto-pauses idle shared-tier clusters. Resume it |
| 3 | IP access list | Atlas → Network Access. Render's outbound IPs are not static unless you have paid for static egress. If the list is not `0.0.0.0/0`, a Render infrastructure change can silently block you |
| 4 | Database user still valid? | Atlas → Database Access. A rotated or deleted user causes auth failure. Note: `MONGODB_URI` embeds the username and password |
| 5 | `MONGODB_URI` correct on Render? | Render → Environment. Confirm the value is present, has not been truncated, and ends with the right database name (`team_progress_tracker`) |
| 6 | Connection storm | Atlas → Metrics → Connections. A crash loop opens a connection per boot attempt and can exhaust the tier's limit, which then keeps you down after the original cause is fixed. Stop the loop (roll back / suspend the service), let connections drain, then restart |

There is **no retry and no degradation**: `server/config/db.js:8-10` catches the connection error,
logs it and calls `process.exit(1)`. A database outage is always a total outage.

### 9.3 "A deploy broke production" → roll back

Render auto-deploys `main`. There is no CI gate, no staging environment, and no approval step — a
push to `main` is a production deploy.

**Roll back first; diagnose afterwards.** Do not debug forward on a broken production.

```
1. Render dashboard → the web service → "Deploys" tab.
2. Find the last deploy that was healthy (note its commit SHA).
3. "Redeploy" / "Rollback to this deploy". Takes roughly 3 minutes.
4. Verify:
      curl -s https://<host>/api/health
      curl -s https://<host>/api/docs-chat/health | jq .ok
   Then log in as an admin and load one dashboard.
5. Only now, work out what broke — on a branch, locally.
```

**Before you roll back, ask one question: did the bad deploy include a data migration?**

- Rolling back *code* is free. Rolling back past a script that **wrote to the database** is not — the
  old code will be reading migrated data.
- Most scripts in `server/scripts/` are forward-compatible and idempotent (§7.2): `migrateOrganization.js`,
  `backfillCommitmentDate.js` and the other backfills only *add* field values that older code
  ignores. Rolling back over those is safe.
- The dangerous ones are the deletions (§7.3). If a deploy included a delete-shaped script, a code
  rollback does **not** bring the rows back — that needs §4.4.
- Nothing records which scripts have been run. `git log -- server/scripts/` plus the deploy timeline
  is your only reconstruction.

Fixing forward is only correct when the fix is a one-line, obviously-safe change and you have already
confirmed rollback would be worse (e.g. the deploy carried an irreversible migration).

### 9.4 Other incidents

| Symptom | Likely cause | Action |
|---|---|---|
| Chat drawer returns 503 on docs questions | Docs RAG index failed to load at boot | `curl /api/docs-chat/health`. If `chunksLoaded: 0`, log in as admin → `/admin/docs-rag` → **Force re-ingest** (~2–3 min). Tracker-mode chat (`/api/chat/stream`) is unaffected — this is LUC-docs only |
| AI cost spike | Runaway loop, abuse, or a genuine usage surge | Check `GET /api/ai/usage` for the top user. To stop spend immediately, blank `OPENAI_API_KEY` and `GROQ_API_KEY` in Render and restart — AI features fail gracefully, the rest of the app is unaffected. There is **no spend cap in code** |
| Tier posters stop appearing / won't download | S3 credentials expired or bucket policy changed | The same credentials back the nightly backup — **check `[db-snapshot]` logs immediately**; a broken poster is a warning that backups are broken too |
| Nightly snapshot log line missing | Job failed, or process was not alive at 00:30 Dubai | Run it manually: `cd server && node scripts/runDbSnapshot.js`. Read the error. Then fix the root cause — a missed night is a 24 h hole in the only backup you can verify |
| Data "disappeared" for one user | Almost always a scoping issue, not data loss | `buildScopeFilter` in `server/middleware/auth.js` scopes by organisation and, for `team_lead` / `skillhub`, by ownership. Check the user's `organization` and `teamLead` before reaching for a restore |
| Someone ran `npm run seed` against production | Users, consultants and commitments are gone | This is a full restore. Go to §4 immediately. Do **not** let the service keep writing — the longer it runs, the more the restore has to be reconciled with new writes |

---

## 10. Operational traps worth knowing before you touch anything

1. **The Atlas cluster host is named `dev` and it is production.** There is no separate development
   database. Every script run from your laptop is a production operation.
2. **`npm run seed` wipes users, consultants and commitments.** See §7.3.
3. **`server/.env.example` (committed to the repository) contains what appears to be a live Atlas
   username and password in plaintext.** Do not copy the value anywhere; treat those credentials as
   compromised and rotate them as part of the handover. Then replace the example file's value with a
   placeholder. See [11 — Credentials & Access](11-credentials-and-access-handover.md).
4. **`LOGIN_CREDENTIALS.md` at the repository root holds plaintext user passwords**, rewritten by
   `seedDatabase.js:224-226` and appended to by `seedSkillhub.js:131`. It is tracked by git. Rotate
   and remove.
5. **`npm test` in `server/` does not run all tests.** The script filters to
   `tests/(exports|meetings|institute|commitments)` (`server/package.json:8`), silently skipping
   `tests/execOverview` and `tests/hourly`. Use `npx jest` for the full suite — and expect it to be
   less green than `npm test`.
6. **Keep the Render service at one instance** (§1).
7. **`JWT_REFRESH_EXPIRE` is documented in `server/.env.example` and in the older engineering docs but
   is never read by any code.** There is no refresh-token flow. Only `JWT_SECRET` and `JWT_EXPIRE`
   matter.
8. **CSP is disabled.** `helmet()` is mounted globally but with `contentSecurityPolicy: false`
   (`server/server.js:18-23`), deferred because of CRA's inline styles and dynamic chunks.
   `crossOriginResourcePolicy` is loosened to `same-site` so the auth-gated PDFs and image snippets
   keep working. Re-enabling CSP is pending work, not an oversight.
9. **CORS is fully open**: `app.use(cors())` with no origin restriction (`server/server.js:26`).
10. **`server/.env` missing locally makes the server bind to port 5000, not 5001** (`server/server.js:119`
    defaults `PORT` to 5000), and the client is configured for 5001. The symptom is "the API is
    unreachable" with no error in either process.

---

## Related documents

**In this handover pack** (`docs/handover/`):

- [00 — Start Here](00-START-HERE.md) — orientation and reading order
- [01 — System Architecture](01-system-architecture.md)
- [02 — Application Workflows](02-application-workflows.md)
- [03 — Database Schema](03-database-schema.md) — the 27 models, indexes and conventions referenced throughout §4
- [04 — Deployment & Infrastructure](04-deployment-and-infrastructure.md) — Render service configuration and the deploy path this document rolls back
- [05 — Environment Setup](05-environment-setup.md) — the full environment-variable inventory
- [06 — API Reference](06-api-reference.md) — including the health and admin endpoints used above
- [07 — Roles & Permissions](07-roles-and-permissions.md) — scoping, which explains most "missing data" reports
- [08 — Dependencies & Integrations](08-dependencies-and-integrations.md) — S3, OpenAI, Groq, Atlas
- [10 — Known Issues & Roadmap](10-known-issues-and-roadmap.md) — the prioritised first-30-days list
- [11 — Credentials & Access Handover](11-credentials-and-access-handover.md) — secret inventory and rotation runbook

**Older documentation set** (`docs/`) — last updated 2026-04-26 and 207 commits stale. Useful for
intent, unreliable for fact; where it conflicts with this document, the code was checked and this
document wins:

- [`docs/security/10-backup-and-disaster-recovery.md`](../security/10-backup-and-disaster-recovery.md)
  — RPO/RTO targets and drill cadence are still worth adopting, but it **predates the S3 nightly
  snapshot entirely** (that shipped 2026-05-30) and its region claims are unverified.
- [`docs/engineering/07-monitoring-and-alerting-runbook.md`](../engineering/07-monitoring-and-alerting-runbook.md)
  — its "current state" section is still accurate: no APM, no error tracking, no structured logging.
- [`docs/engineering/04-deployment-runbook.md`](../engineering/04-deployment-runbook.md) — the deploy
  and rollback steps hold up; the hosting-region table is unverified.
- [`docs/engineering/08-database-and-migrations.md`](../engineering/08-database-and-migrations.md) —
  predates most of the scripts catalogued in §7.
- [`docs/security/07-incident-response-plan.md`](../security/07-incident-response-plan.md) —
  severity definitions and notification templates; §9 here is the technical complement to it.
- `DEPLOYMENT.md` (repo root) — the Heroku/DigitalOcean/PM2 sections are obsolete (the app runs on
  Render), but §"Docs RAG Feature — Render Deploy Cutover" is current and contains the Atlas-region
  boot-time caveat quoted in §5.
