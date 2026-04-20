/**
 * Idempotent backfill: every Commitment document must have a `commitmentDate`.
 * For rows that predate the field, we use `createdAt` (when the row was
 * inserted) as the best available proxy for the day the user actually
 * committed — better than `weekStartDate`, which would force every legacy row
 * onto Monday. Safe to run multiple times — only touches rows where
 * `commitmentDate` is missing.
 *
 * Usage:  cd server && node scripts/backfillCommitmentDate.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Commitment = require('../models/Commitment');

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const filter = {
        $or: [
            { commitmentDate: { $exists: false } },
            { commitmentDate: null },
        ],
    };

    const total = await Commitment.countDocuments(filter);
    console.log(`Rows needing backfill: ${total}`);

    if (total === 0) {
        await mongoose.disconnect();
        console.log('Nothing to do.');
        return;
    }

    // Use aggregation pipeline update so we can reference another field
    // as the value for commitmentDate. Prefer createdAt (when the row was
    // logged) and fall back to weekStartDate only if createdAt is absent.
    // Mongoose 9 requires the raw collection for pipeline updates.
    const result = await Commitment.collection.updateMany(filter, [
        { $set: { commitmentDate: { $ifNull: ['$createdAt', '$weekStartDate'] } } },
    ]);

    console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
