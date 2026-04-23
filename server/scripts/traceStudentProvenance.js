// Proves whether 2024/early-2025 student records were entered live or
// imported in bulk. The giveaway: if `closingDate` is 2024-xx but the
// document's `createdAt` (Mongo timestamp of when the row was first
// written) is Dec 2025 or later, it MUST have been imported.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

(async () => {
    await connectDB();

    // 1) Distribution of createdAt by month — tells us when rows were
    // actually written into this DB.
    const byCreated = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
                n: { $sum: 1 },
            },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    console.log('LUC students by createdAt month (when the row was actually saved to the DB):');
    for (const r of byCreated) {
        console.log(`  ${r._id.y}-${String(r._id.m).padStart(2, '0')}: ${r.n}`);
    }

    // 2) Closing-date before first-saved: proves import
    const all = await Student.find({ organization: 'luc' })
        .select('studentName closingDate enquiryDate createdAt source')
        .lean();
    let importedCount = 0;
    let byImportYear = {};
    for (const s of all) {
        if (s.closingDate && s.createdAt && new Date(s.closingDate) < new Date(s.createdAt)) {
            importedCount++;
            const year = new Date(s.closingDate).getUTCFullYear();
            byImportYear[year] = (byImportYear[year] || 0) + 1;
        }
    }
    console.log(`\nRows where closingDate < createdAt (must have been imported):`);
    console.log(`  Total: ${importedCount} / ${all.length}`);
    console.log(`  By closingDate year:`);
    for (const [y, n] of Object.entries(byImportYear).sort()) {
        console.log(`    ${y}: ${n}`);
    }

    // 3) Earliest enquiryDate found — was the "first enquiry" genuinely
    // that old, or is this an import artifact?
    const earliest = await Student.find({ organization: 'luc', enquiryDate: { $ne: null } })
        .sort('enquiryDate')
        .limit(5)
        .select('studentName enquiryDate closingDate createdAt')
        .lean();
    console.log(`\nEarliest 5 enquiryDates on record:`);
    for (const s of earliest) {
        console.log(
            `  ${s.studentName}: enq=${fmt(s.enquiryDate)} close=${fmt(s.closingDate)} savedToDB=${fmt(s.createdAt)}`
        );
    }

    // 4) Source breakdown — "Old Crm" is the smoking gun for imports.
    const bySource = await Student.aggregate([
        { $match: { organization: 'luc' } },
        { $group: { _id: '$source', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`\nLUC students by source (note "Old Crm" = literal bulk import):`);
    for (const r of bySource) console.log(`  ${r._id}: ${r.n}`);

    await mongoose.connection.close();
    process.exit(0);
})();
