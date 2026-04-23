// Fixes the cached `conversionTime` field on Student rows where it's
// out of sync with the actual |closingDate - enquiryDate| (in days).
// Needed because `updateOne({ $set: {...} })` bypasses the Mongoose
// pre('validate') hook that normally recomputes this.
//
//   node scripts/recomputeStaleConversionTime.js           (dry-run)
//   node scripts/recomputeStaleConversionTime.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

const APPLY = process.argv.includes('--apply');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

(async () => {
    await connectDB();
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

    const all = await Student.find({
        enquiryDate: { $ne: null },
        closingDate: { $ne: null },
    })
        .select('studentName enquiryDate closingDate conversionTime')
        .lean();

    const stale = [];
    for (const s of all) {
        const expected = Math.ceil(
            Math.abs(new Date(s.closingDate) - new Date(s.enquiryDate)) / MS_PER_DAY
        );
        if ((s.conversionTime || 0) !== expected) {
            stale.push({ id: s._id, name: s.studentName, stored: s.conversionTime, expected });
        }
    }

    console.log(`Found ${stale.length} stale conversionTime row(s).`);
    // Print the worst 20 (largest drift) so the log is useful
    stale
        .map((r) => ({ ...r, drift: Math.abs((r.stored || 0) - r.expected) }))
        .sort((a, b) => b.drift - a.drift)
        .slice(0, 20)
        .forEach((r) => {
            console.log(`  • ${r.name}: stored=${r.stored} → expected=${r.expected} (drift ${r.drift})`);
        });

    if (APPLY && stale.length) {
        const ops = stale.map((r) => ({
            updateOne: { filter: { _id: r.id }, update: { $set: { conversionTime: r.expected } } },
        }));
        const result = await Student.bulkWrite(ops, { ordered: false });
        console.log(`\n✔ Updated ${result.modifiedCount} row(s).`);
    } else if (!APPLY) {
        console.log('\nRun with --apply to commit.');
    }

    await mongoose.connection.close();
    process.exit(0);
})();
