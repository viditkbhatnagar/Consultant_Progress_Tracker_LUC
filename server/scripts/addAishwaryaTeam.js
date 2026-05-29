/**
 * Add "Aishwarya" (a team that left — named without the "Team " prefix to
 * match the sheet) to DASHBOARD_changes (2).xlsx.
 *
 * The workbook ranks Aishwarya #10 in the YTD team ranking (100,000 target /
 * 0 achieved) — a solo team-lead-level entity that was active one month early
 * this year then left (paired with Bahrain by the user: "na Bahrain hai na
 * Aishwarya hai, par is saal woh the, isliye YTD mein hain").
 *
 * Final YTD target after this runs = 9 teams (15,350,000) + Aishwarya (100,000)
 * + Bhanu admin overlay (400,000) = 15,850,000, matching the agreed total.
 *
 * Modelled exactly like Bahrain:
 *  - an ACTIVE team-lead User so the team surfaces in the YTD team rollup
 *    (getExecutiveOverview iterates active team leads),
 *  - a self-consultant carrying the entry's required `consultant` ref; because
 *    its name matches the lead's, aggregate.js (~line 496) drops it from the
 *    Consultant Performance rankings — so she shows as a TEAM only, like the
 *    workbook,
 *  - a single entry in a PAST month (January) so she lands in YTD (100k) and is
 *    0/0 in the current-month MTD, exactly like Bahrain.
 *
 * The placeholder User login is never used (random password). Idempotent
 * (findOne + upsert). Run:  cd server && node scripts/addAishwaryaTeam.js
 */
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

const YEAR = 2026;
const MONTH = 1; // January — past month, so she counts in YTD but 0 in current MTD

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    let lead = await User.findOne({ role: 'team_lead', organization: 'luc', name: { $regex: '^aishwarya$', $options: 'i' } });
    if (!lead) {
        lead = await User.create({
            name: 'Aishwarya',
            email: 'aishwarya@learnerseducation.com',
            password: crypto.randomBytes(24).toString('hex'), // placeholder; not used to log in
            role: 'team_lead',
            organization: 'luc',
            teamName: 'Aishwarya',
            isActive: true,
        });
        console.log(`Created team-lead Aishwarya (active): ${lead._id}`);
    } else {
        if (!lead.isActive) { lead.isActive = true; await lead.save(); }
        console.log(`Team-lead Aishwarya already exists: ${lead._id} (isActive=${lead.isActive})`);
    }

    let cons = await Consultant.findOne({ organization: 'luc', name: { $regex: '^aishwarya$', $options: 'i' }, teamName: 'Aishwarya' });
    if (!cons) {
        cons = await Consultant.create({
            organization: 'luc',
            name: 'Aishwarya',
            teamName: 'Aishwarya',
            teamLead: lead._id,
            isActive: false, // self-consultant; excluded from consultant rankings by name match
        });
        console.log(`Created self-consultant Aishwarya: ${cons._id}`);
    } else {
        console.log(`Self-consultant Aishwarya already exists: ${cons._id}`);
    }

    await TeamMonthlyEntry.updateOne(
        { consultant: cons._id, year: YEAR, month: MONTH },
        {
            $set: {
                teamLead: lead._id,
                consultantName: cons.name,
                organization: 'luc',
                monthlyTarget: 100000,
                achievedRevenue: 0,
            },
            $setOnInsert: { consultant: cons._id, year: YEAR, month: MONTH },
        },
        { upsert: true }
    );
    console.log(`  Aishwarya ${YEAR}-${String(MONTH).padStart(2, '0')} (Aishwarya): target 100000, achieved 0`);

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
