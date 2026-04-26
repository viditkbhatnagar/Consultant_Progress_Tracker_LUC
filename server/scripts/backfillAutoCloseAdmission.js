/**
 * Idempotent backfill: any Commitment whose leadStage='Admission' and
 * status='achieved' should also have admissionClosed=true. Pre-existing
 * rows that hit those two values (across multiple form dialogs that didn't
 * always auto-flip) currently render as just "achieved" and don't count
 * toward the Closed KPI even though the lead reached Admission.
 *
 * For each matched row we set:
 *   - admissionClosed = true
 *   - admissionClosedDate = commitmentDate (best signal we have for when
 *     the admission was reached; falls back to weekStartDate, then
 *     updatedAt, then createdAt).
 *
 * NOTE: closedAmount is NOT set. Revenue stays under-counted for these
 * rows until someone enters the amount via edit.
 *
 * Safe to run multiple times — only touches rows that need it. Pass
 * `--dry-run` to print the count without writing.
 *
 * Usage:
 *   cd server && node scripts/backfillAutoCloseAdmission.js --dry-run
 *   cd server && node scripts/backfillAutoCloseAdmission.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Commitment = require('../models/Commitment');

const dryRun = process.argv.includes('--dry-run');

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const filter = {
        leadStage: 'Admission',
        status: 'achieved',
        $or: [
            { admissionClosed: { $ne: true } },
            { admissionClosed: { $exists: false } },
        ],
    };

    const total = await Commitment.countDocuments(filter);
    console.log(`Rows needing auto-close: ${total}`);

    if (total === 0) {
        await mongoose.disconnect();
        console.log('Nothing to do.');
        return;
    }

    if (dryRun) {
        const sample = await Commitment.find(filter)
            .limit(10)
            .select('consultantName teamName commitmentDate weekStartDate status leadStage admissionClosed')
            .lean();
        console.log('Sample rows (first 10):');
        sample.forEach((s) => {
            console.log(
                `  ${s.consultantName || '(no name)'} | team=${s.teamName} | date=${s.commitmentDate || s.weekStartDate}`
            );
        });
        await mongoose.disconnect();
        console.log('Dry run only — no writes performed.');
        return;
    }

    // Pipeline update so admissionClosedDate can reference existing fields.
    // Prefer commitmentDate, then weekStartDate, then updatedAt, then createdAt.
    const result = await Commitment.collection.updateMany(filter, [
        {
            $set: {
                admissionClosed: true,
                admissionClosedDate: {
                    $ifNull: [
                        '$commitmentDate',
                        { $ifNull: ['$weekStartDate', { $ifNull: ['$updatedAt', '$createdAt'] }] },
                    ],
                },
            },
        },
    ]);

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
