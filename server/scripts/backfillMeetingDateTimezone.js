// One-shot backfill for Meeting rows whose meetingDate was timezone-shifted
// on save. The form used to send the DatePicker's local-midnight Date via
// JSON.stringify -> toISOString(), which converted the user's local midnight
// (UAE = UTC+4) into the previous UTC day at 20:00. The going-forward fix
// (form + filter pin everything to UTC midnight) was merged separately;
// this script cleans up the legacy rows so they line up with the new save
// path.
//
// Approach mirrors server/scripts/backfillStudentDateTimezone.js: shift each
// stored timestamp by +4h (UAE local) to recover the user's intended
// calendar day, then write back UTC midnight of that day. Idempotent —
// rows already at UTC midnight are skipped.
//
// Usage:
//   cd server && node scripts/backfillMeetingDateTimezone.js            # dry run
//   cd server && node scripts/backfillMeetingDateTimezone.js --commit   # apply

require('dotenv').config();
const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
require('../models/User');
require('../models/Consultant');

const apply = process.argv.includes('--commit');
const UAE_OFFSET_MS = 4 * 60 * 60 * 1000;

// Convert a stored Date to UTC midnight of the user's intended UAE-local
// day. For rows already at UTC midnight this returns an equivalent Date.
function toUserIntendedUtcMidnight(stored) {
    if (!stored) return null;
    const d = new Date(stored);
    if (Number.isNaN(d.getTime())) return null;
    const uaeLocal = new Date(d.getTime() + UAE_OFFSET_MS);
    return new Date(
        Date.UTC(
            uaeLocal.getUTCFullYear(),
            uaeLocal.getUTCMonth(),
            uaeLocal.getUTCDate()
        )
    );
}

function isAlreadyUtcMidnight(d) {
    return (
        d &&
        d.getUTCHours() === 0 &&
        d.getUTCMinutes() === 0 &&
        d.getUTCSeconds() === 0 &&
        d.getUTCMilliseconds() === 0
    );
}

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(
        apply ? '*** APPLY MODE ***' : '(dry run — pass --commit to apply)'
    );

    const rows = await Meeting.find({})
        .select('studentName meetingDate organization')
        .lean();
    console.log(`Scanning ${rows.length} meetings…\n`);

    let candidates = 0;
    let writes = 0;
    const sample = [];

    for (const r of rows) {
        if (!r.meetingDate) continue;
        const existing = new Date(r.meetingDate);
        if (isAlreadyUtcMidnight(existing)) continue;

        const next = toUserIntendedUtcMidnight(r.meetingDate);
        if (!next) continue;
        candidates++;

        if (sample.length < 5) {
            sample.push({
                _id: r._id,
                name: r.studentName,
                org: r.organization,
                before: existing.toISOString().slice(0, 19),
                after: next.toISOString().slice(0, 19),
            });
        }

        if (apply) {
            await Meeting.updateOne(
                { _id: r._id },
                { $set: { meetingDate: next } }
            );
            writes++;
            if (writes % 50 === 0) {
                console.log(`  …wrote ${writes}/${candidates}+`);
            }
        }
    }

    console.log('\nSample (first 5):');
    for (const s of sample) {
        console.log(`  ${s.name} [${s.org || 'n/a'}]`);
        console.log(`    meetingDate: ${s.before} -> ${s.after}`);
    }

    console.log(`\nCandidates with shifted meetingDate: ${candidates}`);
    if (apply) {
        console.log(`Wrote: ${writes}`);
    } else {
        console.log('(no writes — re-run with --commit to apply)');
    }
    await mongoose.disconnect();
})();
