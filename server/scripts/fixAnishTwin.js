/**
 * Fix the duplicate "Anish" in Team Shaik.
 *
 * Two Anish consultant records exist:
 *   - one ACTIVE with no entries (a stray duplicate — the "top" row), and
 *   - one INACTIVE that holds all the real monthly entries.
 *
 * Per request: activate the real (data-bearing) one and remove the empty
 * active duplicate.
 *
 * Safe + idempotent: only activates a record that has entries, and only
 * deletes a record that has ZERO entries AND only when a data-bearing Anish
 * is being kept — so no real data can ever be lost.
 *
 * Run:  cd server && node scripts/fixAnishTwin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Consultant = require('../models/Consultant');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

const TEAM = 'Team Shaik';

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    const anish = await Consultant.find({
        organization: 'luc',
        name: { $regex: '^anish$', $options: 'i' },
        teamName: TEAM,
    }).lean();

    const annotated = [];
    for (const a of anish) {
        const entryCount = await TeamMonthlyEntry.countDocuments({ consultant: a._id });
        annotated.push({ id: a._id, isActive: a.isActive, entryCount });
    }
    console.log('Anish records:', annotated.map((a) => `${a.id} active=${a.isActive} entries=${a.entryCount}`).join('  |  '));

    const withData = annotated.filter((a) => a.entryCount > 0);
    const empty = annotated.filter((a) => a.entryCount === 0);

    // 1) Activate the data-bearing Anish.
    for (const a of withData) {
        if (!a.isActive) {
            await Consultant.updateOne({ _id: a.id }, { $set: { isActive: true } });
            console.log(`Activated Anish ${a.id} (${a.entryCount} entries)`);
        } else {
            console.log(`Anish ${a.id} already active (${a.entryCount} entries)`);
        }
    }

    // 2) Remove the empty duplicate(s) — only if a data record is being kept.
    if (withData.length > 0) {
        for (const a of empty) {
            await Consultant.deleteOne({ _id: a.id });
            console.log(`Removed empty duplicate Anish ${a.id}`);
        }
    } else {
        console.log('SAFETY: no data-bearing Anish found — deleting nothing.');
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
