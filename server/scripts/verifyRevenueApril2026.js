// Cross-check what date fields are actually populated on LUC closed
// commitments so we can pick the right attribution date for revenue.
//
// Run: cd server && node scripts/verifyRevenueApril2026.js

require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Commitment = require('../models/Commitment');
const Student = require('../models/Student');

(async () => {
    await connectDB();

    console.log('\n=== LUC closed commitments: which dates are set? ===');
    const lucClosed = await Commitment.find({
        admissionClosed: true,
        organization: 'luc',
    })
        .select('consultantName closedDate closedAmount commitmentDate weekStartDate updatedAt createdAt')
        .lean();

    let withClosedDate = 0;
    let withCommitmentDate = 0;
    let withWeekStartDate = 0;
    let withUpdatedAt = 0;
    let sumClosedAmount = 0;
    let withAmount = 0;
    for (const c of lucClosed) {
        if (c.closedDate) withClosedDate++;
        if (c.commitmentDate) withCommitmentDate++;
        if (c.weekStartDate) withWeekStartDate++;
        if (c.updatedAt) withUpdatedAt++;
        if (c.closedAmount && c.closedAmount > 0) {
            withAmount++;
            sumClosedAmount += c.closedAmount;
        }
    }
    console.log(`Total LUC closed: ${lucClosed.length}`);
    console.log(`  closedDate set:     ${withClosedDate}`);
    console.log(`  commitmentDate set: ${withCommitmentDate}`);
    console.log(`  weekStartDate set:  ${withWeekStartDate}`);
    console.log(`  updatedAt set:      ${withUpdatedAt}`);
    console.log(`  closedAmount > 0:   ${withAmount}  (sum = ${sumClosedAmount})`);

    console.log('\nFirst 5 closed commitments (sample date values):');
    for (const c of lucClosed.slice(0, 5)) {
        console.log(
            `  • ${c.consultantName} | closedDate=${c.closedDate || 'NULL'} | commitmentDate=${c.commitmentDate || 'NULL'} | updatedAt=${c.updatedAt || 'NULL'} | amount=${c.closedAmount || 0}`
        );
    }

    console.log('\n=== How many LUC closed landed in April 2026 using updatedAt? ===');
    const aprilStart = new Date('2026-04-01T00:00:00.000Z');
    const aprilEnd = new Date('2026-04-20T23:59:59.999Z');
    const inAprilByUpdated = lucClosed.filter(
        (c) => c.updatedAt && new Date(c.updatedAt) >= aprilStart && new Date(c.updatedAt) <= aprilEnd
    );
    const inAprilByCommit = lucClosed.filter(
        (c) =>
            c.commitmentDate &&
            new Date(c.commitmentDate) >= aprilStart &&
            new Date(c.commitmentDate) <= aprilEnd
    );
    console.log(`  by updatedAt ∈ Apr 1–20: ${inAprilByUpdated.length}, revenue = ${inAprilByUpdated.reduce((s, c) => s + (c.closedAmount || 0), 0)}`);
    console.log(`  by commitmentDate ∈ Apr 1–20: ${inAprilByCommit.length}, revenue = ${inAprilByCommit.reduce((s, c) => s + (c.closedAmount || 0), 0)}`);

    console.log('\n=== Latest 10 LUC closed commitments by updatedAt ===');
    const recent = [...lucClosed]
        .filter((c) => c.updatedAt)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 10);
    for (const c of recent) {
        console.log(
            `  • updatedAt=${new Date(c.updatedAt).toISOString()} | ${c.consultantName} | amount=${c.closedAmount || 0}`
        );
    }

    await mongoose.connection.close();
    process.exit(0);
})();
