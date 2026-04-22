// Cross-check total commitments for April 2026 by organization to
// reconcile the dashboard KPI (LUC only = 241) with the chatbot's 246.
//
// Run: cd server && node scripts/verifyAprilCommitments.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Commitment = require('../models/Commitment');

(async () => {
    await connectDB();

    const START = new Date('2026-04-01T00:00:00.000Z');
    const END = new Date('2026-04-30T23:59:59.999Z');

    // Admin dashboard's "Current Month" view filters by commitmentDate in
    // the current month AND organization='luc'. Reproduce that.
    const byOrgAgg = await Commitment.aggregate([
        { $match: { commitmentDate: { $gte: START, $lte: END } } },
        {
            $group: {
                _id: '$organization',
                total: { $sum: 1 },
                achieved: {
                    $sum: {
                        $cond: [
                            { $or: [{ $eq: ['$status', 'achieved'] }, { $eq: ['$admissionClosed', true] }] },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    console.log('\n=== Commitments with commitmentDate in Apr 2026 (by organization) ===');
    let grand = 0;
    for (const r of byOrgAgg) {
        console.log(`  ${r._id || '(null)'}: total=${r.total}, achieved=${r.achieved}`);
        grand += r.total;
    }
    console.log(`  ---`);
    console.log(`  GRAND TOTAL: ${grand}`);

    // Also check weekStartDate-based — the dashboard might be using that.
    const byWeekStart = await Commitment.aggregate([
        { $match: { weekStartDate: { $gte: START, $lte: END } } },
        { $group: { _id: '$organization', total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    console.log('\n=== Commitments with weekStartDate in Apr 2026 (by organization) ===');
    let grand2 = 0;
    for (const r of byWeekStart) {
        console.log(`  ${r._id || '(null)'}: ${r.total}`);
        grand2 += r.total;
    }
    console.log(`  GRAND TOTAL: ${grand2}`);

    // Dashboard service uses /commitments/date-range which probably filters
    // on weekStartDate/weekEndDate overlap. Check that interpretation too.
    const byWeekOverlap = await Commitment.aggregate([
        {
            $match: {
                weekStartDate: { $lte: END },
                weekEndDate: { $gte: START },
            },
        },
        { $group: { _id: '$organization', total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    console.log('\n=== Commitments whose week overlaps Apr 2026 (by organization) ===');
    let grand3 = 0;
    for (const r of byWeekOverlap) {
        console.log(`  ${r._id || '(null)'}: ${r.total}`);
        grand3 += r.total;
    }
    console.log(`  GRAND TOTAL: ${grand3}`);

    await mongoose.connection.close();
    process.exit(0);
})();
