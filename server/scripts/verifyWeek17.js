// Reconcile "Current Week" KPI (57) with chatbot's 70 for LUC.
// Week 17 of 2026 = Mon Apr 20 → Sun Apr 26, per the dashboard header.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Commitment = require('../models/Commitment');

(async () => {
    await connectDB();

    // ISO Monday–Sunday in UTC vs IST
    const startUTC = new Date('2026-04-20T00:00:00.000Z');
    const endUTC = new Date('2026-04-26T23:59:59.999Z');
    // IST boundaries — Monday 00:00 IST = Sunday 18:30 UTC
    const startIST = new Date('2026-04-19T18:30:00.000Z');
    const endIST = new Date('2026-04-26T18:29:59.999Z');

    const runs = [
        ['commitmentDate in [Apr 20 00:00 UTC, Apr 26 23:59 UTC]', { commitmentDate: { $gte: startUTC, $lte: endUTC } }],
        ['commitmentDate in [Apr 19 18:30 UTC, Apr 26 18:29 UTC] (IST-aligned)', { commitmentDate: { $gte: startIST, $lte: endIST } }],
        ['weekStartDate == Apr 20 UTC', { weekStartDate: new Date('2026-04-20T00:00:00.000Z') }],
        ['weekNumber==17 && year==2026', { weekNumber: 17, year: 2026 }],
        ['week overlap (weekStartDate<=end && weekEndDate>=start) UTC', {
            weekStartDate: { $lte: endUTC },
            weekEndDate: { $gte: startUTC },
        }],
    ];

    for (const [label, filter] of runs) {
        const total = await Commitment.countDocuments({ organization: 'luc', ...filter });
        const achieved = await Commitment.countDocuments({
            organization: 'luc',
            ...filter,
            $or: [{ status: 'achieved' }, { admissionClosed: true }],
        });
        console.log(`LUC | ${label}`);
        console.log(`    total=${total}, achieved=${achieved}`);
    }

    // Also inspect weekStartDate distinct values around Apr 2026 to understand
    // how the rows cluster.
    const weekCounts = await Commitment.aggregate([
        {
            $match: {
                organization: 'luc',
                weekStartDate: { $gte: new Date('2026-04-01'), $lte: new Date('2026-05-01') },
            },
        },
        { $group: { _id: '$weekStartDate', n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);
    console.log('\nLUC commitments by weekStartDate (April 2026):');
    for (const r of weekCounts) {
        console.log(`  ${r._id.toISOString()} → ${r.n}`);
    }

    await mongoose.connection.close();
    process.exit(0);
})();
