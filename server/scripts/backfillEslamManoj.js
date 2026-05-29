/**
 * One-off, idempotent backfill: Eslam's Jan–Mar 2026 entries under Team Manoj.
 *
 * Background: Eslam was on Team Manoj Jan–Mar 2026, then moved to Team Shakil
 * from April. The DB only had his Apr/May entries (Shakil), so his YTD showed
 * 155% instead of the workbook's 103.1%, and Team Manoj's Jan–Mar totals were
 * short his contribution. TeamMonthlyEntry carries its own per-month teamLead,
 * and getExecutiveOverview/getConsultantPerformance already attribute each
 * month to the right team — so this is a data gap, not a logic bug.
 *
 * This script upserts the three missing months (keyed by consultant+year+month,
 * so re-running is safe). Values are taken verbatim from "Team Manoj" in
 * DASHBOARD_changes (2).xlsx.
 *
 * Run:  cd server && node scripts/backfillEslamManoj.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

const YEAR = 2026;

// Jan/Feb/Mar — Team Manoj. Monthly target 65,000 each; achieved + program
// admissions per the workbook (cols: SSM BBA, KNIGHTS MBA, OTHM Ext L5).
const MONTHS = [
    { month: 1, monthlyTarget: 65000, achievedRevenue: 71000, buckets: { ssm_bba: 1, knights_mba: 2 } },
    { month: 2, monthlyTarget: 65000, achievedRevenue: 25000, buckets: { ssm_bba: 1 } },
    { month: 3, monthlyTarget: 65000, achievedRevenue: 37000, buckets: { knights_mba: 1, othm_ext_l5: 1 } },
];

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    const eslam = await Consultant.findOne({
        organization: 'luc',
        isActive: true,
        name: { $regex: '^eslam$', $options: 'i' },
    }).select('_id name').lean();
    if (!eslam) throw new Error('Active consultant "Eslam" not found');

    const manoj = await User.findOne({
        role: 'team_lead',
        organization: 'luc',
        teamName: { $regex: 'manoj', $options: 'i' },
    }).select('_id name teamName').lean();
    if (!manoj) throw new Error('Team Manoj lead not found');

    console.log(`Eslam consultant: ${eslam._id} | Team Manoj lead: ${manoj._id} (${manoj.teamName})`);

    for (const m of MONTHS) {
        const set = {
            teamLead: manoj._id,
            consultantName: eslam.name,
            organization: 'luc',
            monthlyTarget: m.monthlyTarget,
            achievedRevenue: m.achievedRevenue,
            ...m.buckets,
        };
        const res = await TeamMonthlyEntry.updateOne(
            { consultant: eslam._id, year: YEAR, month: m.month },
            { $set: set, $setOnInsert: { consultant: eslam._id, year: YEAR, month: m.month } },
            { upsert: true }
        );
        const action = res.upsertedCount ? 'inserted' : 'updated';
        console.log(`  ${YEAR}-${String(m.month).padStart(2, '0')} (Manoj): ${action} — target ${m.monthlyTarget}, achieved ${m.achievedRevenue}`);
    }

    // Verify Eslam's full-year YTD after the backfill.
    const entries = await TeamMonthlyEntry.find({ organization: 'luc', year: YEAR, consultant: eslam._id })
        .select('month monthlyTarget achievedRevenue').lean();
    const tgt = entries.reduce((s, e) => s + (e.monthlyTarget || 0), 0);
    const ach = entries.reduce((s, e) => s + (e.achievedRevenue || 0), 0);
    console.log(`\nEslam ${YEAR}: ${entries.length} months | YTD target ${tgt} / achieved ${ach} = ${tgt ? (ach / tgt * 100).toFixed(1) : 0}% (expected 103.1%)`);

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
