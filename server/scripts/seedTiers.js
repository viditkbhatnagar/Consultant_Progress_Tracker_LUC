/**
 * Seed the three competition tiers with consultant refs.
 * Idempotent (upsert by tier). Admin can edit membership later in the UI.
 *
 * Run:  cd server && node scripts/seedTiers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Consultant = require('../models/Consultant');
const Tier = require('../models/Tier');

const TIER_NAMES = {
    1: ['faizan', 'elizabeth', 'sweta', 'nihala', 'arfas', 'arunima'],
    2: ['sulu', 'tanushree', 'linta', 'dipin', 'rahul', 'lija', 'eslam', 'farheen'],
    3: ['nesiya', 'anish', 'nigel', 'harsha', 'abith', 'nivya', 'kashish', 'vikil', 'liliyan', 'ansawara'],
};

// Spelling variants -> exact consultant name (validated against the DB).
const OVERRIDE = {
    faizan: 'Syed Faizaan',
    sweta: 'Swetha Reddy',
    tanushree: 'Thanusree',
    lija: 'Lijia',
    liliyan: 'Lilian',
    ansawara: 'Anaswara PK',
    kashish: 'Kashish seth',
};

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

function resolve(all, want) {
    const target = OVERRIDE[want] ? norm(OVERRIDE[want]) : norm(want);
    let cands = all.filter((c) => norm(c.name) === target);
    if (!cands.length) {
        cands = all.filter((c) => {
            const cn = norm(c.name);
            return cn.startsWith(target) || target.startsWith(cn) || cn.includes(target);
        });
    }
    if (!cands.length) return null;
    // Prefer active records (e.g. the de-duped Anish).
    cands.sort((a, b) => (b.isActive !== false) - (a.isActive !== false));
    return cands[0];
}

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    const all = await Consultant.find({ organization: 'luc' }).select('name isActive teamName').lean();

    for (const [tier, names] of Object.entries(TIER_NAMES)) {
        const ids = [];
        const resolved = [];
        for (const n of names) {
            const c = resolve(all, n);
            if (!c) { console.log(`  Tier ${tier}: "${n}" -> UNRESOLVED`); continue; }
            ids.push(c._id);
            resolved.push(c.name);
        }
        await Tier.updateOne(
            { organization: 'luc', tier: Number(tier) },
            { $set: { members: ids, label: `Tier ${tier}` }, $setOnInsert: { organization: 'luc', tier: Number(tier) } },
            { upsert: true }
        );
        console.log(`Tier ${tier}: ${resolved.length} members -> ${resolved.join(', ')}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
