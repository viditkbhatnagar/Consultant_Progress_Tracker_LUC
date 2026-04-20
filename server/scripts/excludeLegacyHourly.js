require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Consultant = require('../models/Consultant');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// Idempotent: marks Ameen & Zakeer (Skillhub Institute, historical-only
// counselors) as excluded from the Hourly Tracker grid. They remain
// assignable in the student-form counselor dropdown so old records can
// still be entered against their names.
// Usage: node scripts/excludeLegacyHourly.js

const LEGACY_NAMES = ['Ameen', 'Zakeer'];

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    for (const name of LEGACY_NAMES) {
        const result = await Consultant.updateMany(
            { name, organization: ORG_SKILLHUB_INSTITUTE },
            { $set: { excludeFromHourly: true } }
        );
        console.log(`[${name}] matched=${result.matchedCount} modified=${result.modifiedCount}`);
    }

    process.exit(0);
};

run().catch((err) => {
    console.error('Exclude legacy hourly failed:', err);
    process.exit(1);
});
