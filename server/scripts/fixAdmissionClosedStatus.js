/**
 * Migration Script: Fix admissionClosed commitments with inconsistent status
 *
 * Problem: Some commitments have admissionClosed=true but status is still 'pending'
 * (or other non-achieved statuses). This script fixes them to status='achieved'.
 *
 * Usage:
 *   DRY RUN (default - no changes):  node scripts/fixAdmissionClosedStatus.js
 *   APPLY CHANGES:                   node scripts/fixAdmissionClosedStatus.js --apply
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Commitment = require('../models/Commitment');

const run = async () => {
    const applyChanges = process.argv.includes('--apply');

    console.log('='.repeat(60));
    console.log(applyChanges ? '  APPLY MODE - Changes WILL be saved' : '  DRY RUN - No changes will be made');
    console.log('='.repeat(60));
    console.log();

    await connectDB();

    // Find all inconsistent records: admissionClosed=true but status !== 'achieved'
    const inconsistent = await Commitment.find({
        admissionClosed: true,
        status: { $ne: 'achieved' },
    }).select('_id studentName consultantName status admissionClosed achievementPercentage leadStage weekStartDate');

    console.log(`Found ${inconsistent.length} inconsistent record(s):\n`);

    if (inconsistent.length === 0) {
        console.log('Nothing to fix. All admissionClosed commitments already have status=achieved.');
        await mongoose.connection.close();
        return;
    }

    // Log each record before changing
    inconsistent.forEach((c, i) => {
        console.log(`  ${i + 1}. ID: ${c._id}`);
        console.log(`     Student: ${c.studentName || '(none)'}`);
        console.log(`     Consultant: ${c.consultantName}`);
        console.log(`     Current status: "${c.status}" → will become "achieved"`);
        console.log(`     Current achievementPercentage: ${c.achievementPercentage ?? 'null'} → will become 100`);
        console.log(`     Lead Stage: ${c.leadStage || '(none)'}`);
        console.log(`     Week: ${c.weekStartDate ? c.weekStartDate.toISOString().slice(0, 10) : '(none)'}`);
        console.log();
    });

    if (!applyChanges) {
        console.log('---');
        console.log('This was a DRY RUN. To apply these changes, run:');
        console.log('  node scripts/fixAdmissionClosedStatus.js --apply');
        await mongoose.connection.close();
        return;
    }

    // Apply the fix
    const result = await Commitment.updateMany(
        {
            admissionClosed: true,
            status: { $ne: 'achieved' },
        },
        {
            $set: {
                status: 'achieved',
                achievementPercentage: 100,
            },
        }
    );

    console.log(`Updated ${result.modifiedCount} record(s) successfully.`);

    await mongoose.connection.close();
    console.log('\nDone. Database connection closed.');
};

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
