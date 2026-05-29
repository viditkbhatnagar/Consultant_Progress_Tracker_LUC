/**
 * Soft-delete (isActive=false) a fixed list of consultants who have left /
 * gone inactive. The dashboards already render inactive consultants tagged and
 * sorted to the bottom of the Category tables, so this just flips the flag.
 *
 * Idempotent — re-running is harmless. Historical commitments/entries are
 * preserved (soft delete only).
 *
 * Run:  cd server && node scripts/deactivateConsultants.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Consultant = require('../models/Consultant');

// name + teamName to disambiguate (case-insensitive exact name match).
const TARGETS = [
    { name: 'Nimra', teamName: 'Team Tony' },
    { name: 'Neelu', teamName: 'Team Tony' },
];

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    for (const t of TARGETS) {
        const res = await Consultant.updateMany(
            {
                organization: 'luc',
                name: { $regex: '^' + t.name + '$', $options: 'i' },
                teamName: t.teamName,
            },
            { $set: { isActive: false } }
        );
        console.log(`${t.name} (${t.teamName}): matched ${res.matchedCount}, modified ${res.modifiedCount}`);
    }

    const after = await Consultant.find({
        organization: 'luc',
        name: { $regex: '^(nimra|neelu)$', $options: 'i' },
    }).select('name teamName isActive').lean();
    console.log('After:', JSON.stringify(after));

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
