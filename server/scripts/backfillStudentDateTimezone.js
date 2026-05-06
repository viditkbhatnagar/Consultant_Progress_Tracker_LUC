// One-shot backfill for LUC students whose enquiryDate / closingDate were
// timezone-shifted on save. The form used to send the picker's Date via
// JSON.stringify -> toISOString(), which converted the user's local
// midnight (UAE = UTC+4) into the previous UTC day at 20:00. The pre-
// validate hook then computed `month` via getMonth() on the server (UTC),
// labelling the row with the wrong month. This script normalizes each
// affected row to UTC midnight of the user's intended local date and
// recomputes `month`.
//
// LUC users are in UAE so we shift by +4h to recover the user's intended
// calendar date, then write back UTC midnight of that date. Idempotent —
// safe to re-run; rows already at UTC midnight are skipped.
//
// Usage:
//   cd server && node scripts/backfillStudentDateTimezone.js            # dry run
//   cd server && node scripts/backfillStudentDateTimezone.js --commit   # apply

require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/Student');
require('../models/User');

const apply = process.argv.includes('--commit');
const UAE_OFFSET_MS = 4 * 60 * 60 * 1000;
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Convert a stored Date to UTC midnight of the user's intended local day.
// Assumes UAE local (UTC+4). For rows already at UTC midnight this is a
// no-op (returns an equivalent Date).
function toUserIntendedUtcMidnight(stored) {
    if (!stored) return null;
    const d = new Date(stored);
    if (Number.isNaN(d.getTime())) return null;
    const uaeLocal = new Date(d.getTime() + UAE_OFFSET_MS);
    return new Date(Date.UTC(
        uaeLocal.getUTCFullYear(),
        uaeLocal.getUTCMonth(),
        uaeLocal.getUTCDate(),
    ));
}

function isAlreadyUtcMidnight(d) {
    return d
        && d.getUTCHours() === 0
        && d.getUTCMinutes() === 0
        && d.getUTCSeconds() === 0
        && d.getUTCMilliseconds() === 0;
}

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(apply ? '*** APPLY MODE ***' : '(dry run — pass --commit to apply)');

    const rows = await Student.find({ organization: 'luc' })
        .select('studentName closingDate enquiryDate month')
        .lean();
    console.log(`Scanning ${rows.length} LUC students…\n`);

    let candidates = 0;
    let writes = 0;
    const sample = [];

    for (const r of rows) {
        const updates = {};
        if (r.closingDate && !isAlreadyUtcMidnight(new Date(r.closingDate))) {
            updates.closingDate = toUserIntendedUtcMidnight(r.closingDate);
        }
        if (r.enquiryDate && !isAlreadyUtcMidnight(new Date(r.enquiryDate))) {
            updates.enquiryDate = toUserIntendedUtcMidnight(r.enquiryDate);
        }
        if (Object.keys(updates).length === 0) continue;
        candidates++;

        // Recompute month from the NEW closingDate (or existing one if not changed).
        const sourceClosingDate = updates.closingDate || r.closingDate;
        if (sourceClosingDate) {
            const newMonth = MONTHS[new Date(sourceClosingDate).getUTCMonth()];
            if (newMonth !== r.month) updates.month = newMonth;
        }

        if (sample.length < 5) {
            sample.push({
                _id: r._id,
                name: r.studentName,
                before: {
                    closing: r.closingDate?.toISOString?.()?.slice(0, 19) || null,
                    enquiry: r.enquiryDate?.toISOString?.()?.slice(0, 19) || null,
                    month: r.month,
                },
                after: {
                    closing: (updates.closingDate || r.closingDate)?.toISOString?.()?.slice(0, 19) || null,
                    enquiry: (updates.enquiryDate || r.enquiryDate)?.toISOString?.()?.slice(0, 19) || null,
                    month: updates.month || r.month,
                },
            });
        }

        if (apply) {
            await Student.updateOne({ _id: r._id }, { $set: updates });
            writes++;
            if (writes % 50 === 0) console.log(`  …wrote ${writes}/${candidates}+`);
        }
    }

    console.log('\nSample (first 5):');
    for (const s of sample) {
        console.log(`  ${s.name}`);
        console.log(`    closing: ${s.before.closing} -> ${s.after.closing}`);
        console.log(`    enquiry: ${s.before.enquiry} -> ${s.after.enquiry}`);
        console.log(`    month  : ${s.before.month} -> ${s.after.month}`);
    }

    console.log(`\nCandidates with shifted dates: ${candidates}`);
    if (apply) {
        console.log(`Wrote: ${writes}`);
    } else {
        console.log('(no writes — re-run with --commit to apply)');
    }
    await mongoose.disconnect();
})();
