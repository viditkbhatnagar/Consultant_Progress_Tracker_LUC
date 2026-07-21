/**
 * Normalise Skillhub Institute subject values onto the canonical list in
 * config/instituteSubjects.js, and retire CHRM from the teacher rosters.
 *
 * Subjects were free text for the whole life of the feature (the Excel import
 * wrote cells verbatim and the entry forms allowed arbitrary text), so the same
 * subject exists under several spellings: "Maths"/"Math",
 * "Accounting"/"Accountancy", "Business studies"/"Business Studies",
 * "biology"/"Biology". The pickers are now served from the canonical list, so
 * historical rows need to be rewritten to match or they'd stop matching a
 * filter selection.
 *
 * Deliberately NOT touched: timetable rows whose subject is CHRM. The branch
 * asked to keep those as history — CHRM is only removed from the pickers and
 * from teacher subject lists. Any value we don't recognise is left exactly as
 * it is and reported, never guessed at.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   cd server && node scripts/normalizeInstituteSubjects.js            # dry run
 *   cd server && node scripts/normalizeInstituteSubjects.js --apply    # write
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');
const { canonicalizeSubject, RETIRED_INSTITUTE_SUBJECTS } = require('../config/instituteSubjects');

const APPLY = process.argv.includes('--apply');
const INSTITUTE = ORG_SKILLHUB_INSTITUTE;
const SUBJECT_COLLECTIONS = ['attendances', 'testrecords', 'timetableentries'];

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(APPLY ? '=== APPLY MODE (writing) ===\n' : '=== DRY RUN (no writes) — pass --apply to write ===\n');

    // 1. Scalar `subject` fields.
    for (const name of SUBJECT_COLLECTIONS) {
        const col = db.collection(name);
        const values = await col.distinct('subject', { organization: INSTITUTE });
        console.log(`[${name}]`);
        for (const value of values) {
            if (value === null || value === undefined || value === '') continue;
            const canonical = canonicalizeSubject(value);
            if (canonical === null) {
                const n = await col.countDocuments({ organization: INSTITUTE, subject: value });
                const retired = RETIRED_INSTITUTE_SUBJECTS.includes(value);
                console.log(`   keep  "${value}" (${n}) — ${retired ? 'retired, kept as history' : 'unrecognised, left untouched'}`);
                continue;
            }
            if (canonical === value) continue; // already canonical
            const n = await col.countDocuments({ organization: INSTITUTE, subject: value });
            console.log(`   fix   "${value}" -> "${canonical}" (${n} row${n === 1 ? '' : 's'})`);
            if (APPLY && n) {
                await col.updateMany(
                    { organization: INSTITUTE, subject: value },
                    { $set: { subject: canonical } }
                );
            }
        }
    }

    // 2. teachers.subjects[] — canonicalise entries and drop retired subjects.
    console.log('\n[teachers.subjects]');
    const teachers = await db.collection('teachers')
        .find({ organization: INSTITUTE })
        .project({ name: 1, subjects: 1 })
        .toArray();
    for (const t of teachers) {
        const before = Array.isArray(t.subjects) ? t.subjects : [];
        const after = [];
        for (const s of before) {
            if (RETIRED_INSTITUTE_SUBJECTS.includes(s)) continue; // retire
            const canonical = canonicalizeSubject(s);
            const kept = canonical === null ? s : canonical; // unknown → keep as-is
            if (kept && !after.includes(kept)) after.push(kept);
        }
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        console.log(`   ${t.name}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
        if (APPLY) {
            await db.collection('teachers').updateOne({ _id: t._id }, { $set: { subjects: after } });
        }
    }

    console.log(APPLY ? '\nDone — changes written.' : '\nDone — dry run only, nothing written.');
    await mongoose.disconnect();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
