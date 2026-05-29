/**
 * Idempotent YTD reconciliation against DASHBOARD_changes (2).xlsx.
 *
 * Two gaps that kept the dashboard YTD from matching the workbook:
 *
 *  1. Team Bahrain — its entries (Chitra 210k/140,799 + Aghin 60k/0 =
 *     270,000/140,799, matching the workbook) were already in the DB, but the
 *     Bahrain team-lead user was isActive=false, so getExecutiveOverview
 *     (active leads only) dropped the whole team. Fix: reactivate the lead.
 *
 *  2. Team Shakil — member "Aisha" (Jan 80k/40k, Feb 80k/24k; YTD 160k/64k)
 *     was missing entirely. Create her (inactive — she's not in the active
 *     rankings) and upsert her two months under the Shakil lead.
 *
 * Re-runnable safely (findOne + upsert).
 *
 * Run:  cd server && node scripts/reconcileYtdGaps.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

const YEAR = 2026;

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    // 1) Reactivate the Bahrain team lead so the team rolls up.
    const bahrain = await User.findOne({ role: 'team_lead', organization: 'luc', teamName: { $regex: 'bahrain', $options: 'i' } });
    if (!bahrain) throw new Error('Bahrain team lead not found');
    const wasActive = bahrain.isActive;
    bahrain.isActive = true;
    await bahrain.save();
    console.log(`Bahrain lead "${bahrain.name}": isActive ${wasActive} -> true`);

    // 2) Team Shakil — restore member "Aisha".
    const shakil = await User.findOne({ role: 'team_lead', organization: 'luc', teamName: { $regex: 'shakil', $options: 'i' } }).lean();
    if (!shakil) throw new Error('Shakil team lead not found');

    let aisha = await Consultant.findOne({ organization: 'luc', name: { $regex: '^aisha$', $options: 'i' }, teamName: 'Team Shakil' });
    if (!aisha) {
        aisha = await Consultant.create({
            organization: 'luc',
            name: 'Aisha',
            teamName: 'Team Shakil',
            teamLead: shakil._id,
            isActive: false, // not in the active rankings; her data still rolls into the team total
        });
        console.log(`Created consultant Aisha (Team Shakil, inactive): ${aisha._id}`);
    } else {
        console.log(`Consultant Aisha already exists: ${aisha._id}`);
    }

    const aishaMonths = [
        { month: 1, monthlyTarget: 80000, achievedRevenue: 40000, buckets: { dba: 1 } },
        { month: 2, monthlyTarget: 80000, achievedRevenue: 24000, buckets: { knights_mba: 1 } },
    ];
    for (const m of aishaMonths) {
        await TeamMonthlyEntry.updateOne(
            { consultant: aisha._id, year: YEAR, month: m.month },
            {
                $set: {
                    teamLead: shakil._id,
                    consultantName: aisha.name,
                    organization: 'luc',
                    monthlyTarget: m.monthlyTarget,
                    achievedRevenue: m.achievedRevenue,
                    ...m.buckets,
                },
                $setOnInsert: { consultant: aisha._id, year: YEAR, month: m.month },
            },
            { upsert: true }
        );
        console.log(`  Aisha ${YEAR}-${String(m.month).padStart(2, '0')} (Shakil): target ${m.monthlyTarget}, achieved ${m.achievedRevenue}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
