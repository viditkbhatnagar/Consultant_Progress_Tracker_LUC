/**
 * Idempotent rename: PaymentPlan.status 'Submitted' → 'Approved and Submitted'.
 * Run once after the status-label rename ships, to update any rows created
 * with the old value. Safe to run multiple times (only touches 'Submitted'
 * rows; a second run matches nothing).
 *
 * Usage:  cd server && node scripts/renamePaymentPlanApproved.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const PaymentPlan = require('../models/PaymentPlan');

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    // updateMany does not run enum validators, so matching the (now-removed)
    // 'Submitted' value and setting the new value is safe.
    const res = await PaymentPlan.updateMany(
        { status: 'Submitted' },
        { $set: { status: 'Approved and Submitted' } }
    );
    console.log(
        `Updated ${res.modifiedCount} payment plan(s): 'Submitted' → 'Approved and Submitted'.`
    );

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
