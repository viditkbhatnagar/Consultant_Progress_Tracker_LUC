// Comprehensive legacy-data cleanup for LUC Students. Auto-fixable
// issues are grouped into safety tiers; business decisions surface as a
// report.
//
//   node scripts/fixLegacyDataBugs.js               (dry-run everything)
//   node scripts/fixLegacyDataBugs.js --apply-safe  (Tier 1 only)
//   node scripts/fixLegacyDataBugs.js --apply-all   (Tier 1 + Tier 2)
//
// Tier 1 (--apply-safe):
//   (1) Normalize consultantName casing against the Consultant collection
//       (case-insensitive match → canonical casing).
//   (2) Backfill LUC studentStatus='active' where it's undefined AND
//       closingDate has been recorded.
//   (3) Delete EXACT duplicates — same studentName, teamName,
//       consultantName, closingDate, admissionFeePaid, courseFee.
//       Keeps the oldest _id. Safe because every field matches.
//
// Tier 2 (--apply-all):
//   (4) Delete FUTURE-DATED duplicate records that match an earlier
//       record by studentName + teamName + consultantName. Keeps the
//       earlier (non-future) row.
//
// Report-only (never auto-fixed — need human decisions):
//   - Rows with courseFee = 0
//   - Rows with admissionFeePaid > courseFee (overpaid)
//   - Orphaned teamLead ObjectId references
//   - Duplicate names where dates differ > 14 days (possible re-enrollments)
//   - Consultant names on Student that don't match any Consultant even
//     after case-insensitive lookup

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const Consultant = require('../models/Consultant');
const User = require('../models/User');

const args = new Set(process.argv.slice(2));
const APPLY_SAFE = args.has('--apply-safe') || args.has('--apply-all');
const APPLY_ALL = args.has('--apply-all');

const hr = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`);
const fmt = (d) =>
    d ? new Date(d).toISOString().slice(0, 10).split('-').reverse().join('/') : '—';
const money = (n) => `AED ${(n || 0).toLocaleString()}`;

(async () => {
    await connectDB();
    console.log(
        `Mode: ${APPLY_ALL ? '*** APPLY ALL ***' : APPLY_SAFE ? '*** APPLY SAFE ***' : 'DRY-RUN'}`
    );

    const now = new Date();
    const stats = {
        casingNormalized: 0,
        statusBackfilled: 0,
        exactDupesDeleted: 0,
        futureDupesDeleted: 0,
    };

    // ──────────────────────────────────────────────────────────────────
    // TIER 1.1 — Normalize consultantName casing
    // ──────────────────────────────────────────────────────────────────
    hr('TIER 1.1 — Normalize consultantName casing');
    const consultants = await Consultant.find({})
        .select('name teamName')
        .lean();
    // Case-insensitive lookup → canonical. If multiple consultants share
    // a case-insensitive name, we pick the active one to be safe.
    const canonByLower = new Map();
    for (const c of consultants) {
        const key = (c.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!canonByLower.has(key)) canonByLower.set(key, c.name);
    }

    const lucStudents = await Student.find({ organization: 'luc' })
        .select('studentName consultantName teamName closingDate admissionFeePaid courseFee studentStatus enquiryDate createdAt teamLead')
        .lean();

    const casingChanges = [];
    for (const s of lucStudents) {
        const raw = (s.consultantName || '').trim();
        const canon = canonByLower.get(raw.toLowerCase());
        if (canon && canon !== raw) {
            casingChanges.push({ id: s._id, from: raw, to: canon, student: s.studentName });
        }
    }
    console.log(`Proposed: ${casingChanges.length} consultantName normalizations`);
    const byFromTo = {};
    for (const c of casingChanges) {
        const key = `${c.from} → ${c.to}`;
        byFromTo[key] = (byFromTo[key] || 0) + 1;
    }
    for (const [k, n] of Object.entries(byFromTo).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${n}× ${k}`);
    }
    if (APPLY_SAFE && casingChanges.length) {
        const ops = casingChanges.map((c) => ({
            updateOne: { filter: { _id: c.id }, update: { $set: { consultantName: c.to } } },
        }));
        const r = await Student.bulkWrite(ops, { ordered: false });
        stats.casingNormalized = r.modifiedCount;
        console.log(`✔ Normalized ${r.modifiedCount} rows.`);
    }

    // Consultants on Student with NO match in Consultant (even case-insensitive)
    hr('REPORT — consultantName values with no Consultant match');
    const activeTLNames = new Set(
        (await User.find({ role: 'team_lead' }).select('name').lean()).map((u) =>
            (u.name || '').trim().toLowerCase()
        )
    );
    const usedNames = new Set(lucStudents.map((s) => (s.consultantName || '').trim()));
    const unmatched = [];
    for (const n of usedNames) {
        if (!n) continue;
        const lower = n.toLowerCase();
        if (canonByLower.has(lower)) continue;
        if (activeTLNames.has(lower)) continue; // using a TL name is allowed
        unmatched.push(n);
    }
    console.log(`${unmatched.length} distinct consultantName values unmatched after casing fix:`);
    for (const n of unmatched.sort()) console.log(`  '${n}'`);
    console.log(`(these stay as-is — manual review, could be former/inactive consultants)`);

    // ──────────────────────────────────────────────────────────────────
    // TIER 1.2 — Backfill LUC studentStatus where undefined
    // ──────────────────────────────────────────────────────────────────
    hr('TIER 1.2 — Backfill LUC studentStatus = "active" where undefined');
    const toBackfill = lucStudents.filter(
        (s) => !s.studentStatus && s.closingDate
    );
    console.log(`Proposed: ${toBackfill.length} rows will be set to studentStatus='active'`);
    if (APPLY_SAFE && toBackfill.length) {
        const r = await Student.updateMany(
            {
                _id: { $in: toBackfill.map((s) => s._id) },
            },
            { $set: { studentStatus: 'active' } }
        );
        stats.statusBackfilled = r.modifiedCount;
        console.log(`✔ Backfilled ${r.modifiedCount} rows to status='active'.`);
    }

    // ──────────────────────────────────────────────────────────────────
    // TIER 1.3 — Delete EXACT duplicates
    // ──────────────────────────────────────────────────────────────────
    hr('TIER 1.3 — Delete EXACT duplicates (same everything)');
    // An exact dup = same studentName + teamName + consultantName (case
    // insensitive, uses canonical name if normalized) + closingDate +
    // admissionFeePaid + courseFee. Keep lowest _id.
    //
    // We re-fetch after potential casing changes when --apply-safe is on,
    // so the dup detection sees the normalized names.
    const currentLuc = APPLY_SAFE
        ? await Student.find({ organization: 'luc' })
              .select('studentName consultantName teamName closingDate admissionFeePaid courseFee _id createdAt')
              .lean()
        : lucStudents;

    const exactDupKey = (s) =>
        [
            (s.studentName || '').trim().toLowerCase(),
            (s.teamName || '').trim().toLowerCase(),
            (s.consultantName || '').trim().toLowerCase(),
            s.closingDate ? new Date(s.closingDate).toISOString().slice(0, 10) : '',
            Math.round(s.admissionFeePaid || 0),
            Math.round(s.courseFee || 0),
        ].join('|');

    const byExactKey = new Map();
    for (const s of currentLuc) {
        const k = exactDupKey(s);
        if (!byExactKey.has(k)) byExactKey.set(k, []);
        byExactKey.get(k).push(s);
    }
    const exactDupGroups = [...byExactKey.values()].filter((arr) => arr.length > 1);
    const exactDupDeletes = [];
    for (const group of exactDupGroups) {
        // Keep the oldest record (by _id, which embeds timestamp).
        const sorted = [...group].sort((a, b) => String(a._id).localeCompare(String(b._id)));
        const [keep, ...drops] = sorted;
        for (const d of drops) exactDupDeletes.push({ keep, drop: d });
    }
    console.log(`Proposed: delete ${exactDupDeletes.length} exact-duplicate row(s) across ${exactDupGroups.length} group(s)`);
    for (const pair of exactDupDeletes.slice(0, 15)) {
        console.log(
            `  drop: ${pair.drop.studentName} | ${pair.drop.teamName}/${pair.drop.consultantName} | close=${fmt(pair.drop.closingDate)} | paid=${money(pair.drop.admissionFeePaid)}`
        );
    }
    if (exactDupDeletes.length > 15) console.log(`  …and ${exactDupDeletes.length - 15} more`);
    if (APPLY_SAFE && exactDupDeletes.length) {
        const r = await Student.deleteMany({ _id: { $in: exactDupDeletes.map((p) => p.drop._id) } });
        stats.exactDupesDeleted = r.deletedCount;
        console.log(`✔ Deleted ${r.deletedCount} exact duplicates.`);
    }

    // ──────────────────────────────────────────────────────────────────
    // TIER 2 — Delete future-dated duplicates
    // ──────────────────────────────────────────────────────────────────
    hr('TIER 2 — Delete FUTURE-DATED duplicates of earlier records');
    const afterDelete = APPLY_SAFE
        ? await Student.find({ organization: 'luc' })
              .select('studentName consultantName teamName closingDate admissionFeePaid courseFee _id createdAt')
              .lean()
        : currentLuc;

    // Group by name+team+consultant (case-insensitive). Inside a group,
    // if one record is future-dated and another is past/today, the
    // future one is almost certainly a duplicate re-entry.
    const groupKey = (s) =>
        [
            (s.studentName || '').trim().toLowerCase(),
            (s.teamName || '').trim().toLowerCase(),
            (s.consultantName || '').trim().toLowerCase(),
        ].join('|');
    const byTriple = new Map();
    for (const s of afterDelete) {
        const k = groupKey(s);
        if (!byTriple.has(k)) byTriple.set(k, []);
        byTriple.get(k).push(s);
    }
    const futureDupes = [];
    for (const group of byTriple.values()) {
        if (group.length < 2) continue;
        const future = group.filter((s) => s.closingDate && new Date(s.closingDate) > now);
        const past = group.filter((s) => s.closingDate && new Date(s.closingDate) <= now);
        if (future.length && past.length) {
            for (const f of future) futureDupes.push({ drop: f, keepCount: past.length });
        }
    }
    console.log(`Proposed: delete ${futureDupes.length} future-dated duplicate row(s)`);
    for (const pair of futureDupes) {
        console.log(
            `  drop: ${pair.drop.studentName} | ${pair.drop.teamName}/${pair.drop.consultantName} | close=${fmt(pair.drop.closingDate)} (keeping ${pair.keepCount} earlier record${pair.keepCount > 1 ? 's' : ''})`
        );
    }
    if (APPLY_ALL && futureDupes.length) {
        const r = await Student.deleteMany({ _id: { $in: futureDupes.map((p) => p.drop._id) } });
        stats.futureDupesDeleted = r.deletedCount;
        console.log(`✔ Deleted ${r.deletedCount} future-dated duplicates.`);
    }

    // ──────────────────────────────────────────────────────────────────
    // REPORT-ONLY buckets
    // ──────────────────────────────────────────────────────────────────
    hr('REPORT — rows needing human decision (NOT auto-fixed)');

    // Zero courseFee
    const zeroFee = lucStudents.filter((s) => !s.courseFee || s.courseFee === 0);
    console.log(`\nZero courseFee on LUC: ${zeroFee.length}`);
    for (const s of zeroFee)
        console.log(
            `  • ${s.studentName} [${s.teamName}/${s.consultantName}] close=${fmt(s.closingDate)} paid=${money(s.admissionFeePaid)}`
        );

    // Overpaid
    const overpaid = lucStudents.filter(
        (s) => (s.admissionFeePaid || 0) > (s.courseFee || 0) && (s.admissionFeePaid || 0) > 0
    );
    console.log(`\nOverpaid (admissionFeePaid > courseFee): ${overpaid.length}`);
    for (const s of overpaid)
        console.log(
            `  • ${s.studentName} [${s.teamName}] course=${money(s.courseFee)} paid=${money(s.admissionFeePaid)} delta=+${money((s.admissionFeePaid || 0) - (s.courseFee || 0))}`
        );

    // Orphan teamLead ObjectIds
    const userIds = new Set(
        (await User.find({}).select('_id').lean()).map((u) => String(u._id))
    );
    const studentTLs = [...new Set(lucStudents.map((s) => String(s.teamLead)).filter(Boolean))];
    const orphanTLs = studentTLs.filter((id) => !userIds.has(id));
    console.log(`\nOrphan teamLead ObjectIds (Student points to non-existent User): ${orphanTLs.length}`);
    for (const id of orphanTLs) {
        const rows = lucStudents.filter((s) => String(s.teamLead) === id);
        console.log(`  • teamLead=${id} → ${rows.length} student(s): ${rows.map((r) => r.studentName).slice(0, 5).join(', ')}`);
    }

    // Remaining name-variation duplicates (dates differ > 14 days —
    // possible re-enrollments, not auto-merged).
    const nameDupGroups = [];
    for (const group of byTriple.values()) {
        if (group.length < 2) continue;
        const dates = group.map((s) => (s.closingDate ? new Date(s.closingDate).getTime() : 0));
        const spreadDays = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
        if (spreadDays > 14) nameDupGroups.push(group);
    }
    console.log(`\nName-dup groups with dates >14 days apart (possible re-enrollments — review): ${nameDupGroups.length}`);
    for (const g of nameDupGroups.slice(0, 10)) {
        console.log(`  ▸ "${g[0].studentName}" — ${g.length} records:`);
        for (const s of g)
            console.log(`      close=${fmt(s.closingDate)} paid=${money(s.admissionFeePaid)}`);
    }

    // ──────────────────────────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────────────────────────
    hr('SUMMARY');
    if (APPLY_SAFE || APPLY_ALL) {
        console.log('Applied:');
        console.log(`  casing normalizations: ${stats.casingNormalized}`);
        console.log(`  status backfilled:     ${stats.statusBackfilled}`);
        console.log(`  exact dupes deleted:   ${stats.exactDupesDeleted}`);
        console.log(`  future dupes deleted:  ${stats.futureDupesDeleted}`);
    } else {
        console.log('Proposed (run with --apply-safe or --apply-all to commit):');
        console.log(`  casing normalizations: ${casingChanges.length}`);
        console.log(`  status backfilled:     ${toBackfill.length}`);
        console.log(`  exact dupes deleted:   ${exactDupDeletes.length}`);
        console.log(`  future dupes deleted:  ${futureDupes.length}  (Tier 2, --apply-all)`);
    }

    await mongoose.connection.close();
    process.exit(0);
})();
