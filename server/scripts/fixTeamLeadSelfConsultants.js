/**
 * Fix team-lead "self-consultant" rows that are wrongly marked inactive.
 *
 * Each LUC team lead has a Consultant record under their own name (their
 * self-consultant row, where their personal sales land). getTeamDetail tags a
 * member "inactive" straight from that Consultant doc's isActive flag.
 *
 * Manoj's self-consultant predates the others (created 2026-01-27, isActive
 * false) while every other lead's was (re)created 2026-05-26 as active — so the
 * May batch left Manoj's stale inactive flag in place and he renders "inactive"
 * despite being an active, producing team lead.
 *
 * This flips any ACTIVE team lead's own self-consultant (name-matched) from
 * inactive -> active so it matches the rest. Idempotent; only rows that are
 * actually wrong are touched. The self-consultant is still excluded from the
 * Consultant Performance rankings by aggregate.js's lead.name === consultant
 * name rule, so this only affects the "inactive" tag in the team view.
 *
 * Run:  cd server && node scripts/fixTeamLeadSelfConsultants.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    const leads = await User.find({ role: 'team_lead', organization: 'luc', isActive: true })
        .select('name teamName')
        .lean();

    let fixed = 0;
    for (const lead of leads) {
        const self = await Consultant.findOne({
            teamLead: lead._id,
            name: { $regex: '^' + lead.name.trim() + '$', $options: 'i' },
        });
        if (!self) {
            console.log(`${lead.teamName}: no self-consultant doc — skipped`);
            continue;
        }
        if (self.isActive === false) {
            self.isActive = true;
            await self.save();
            fixed += 1;
            console.log(`${lead.teamName}: self-consultant "${self.name}" inactive -> ACTIVE (${self._id})`);
        } else {
            console.log(`${lead.teamName}: self-consultant "${self.name}" already active — no change`);
        }
    }

    console.log(`\nDone. Flipped ${fixed} self-consultant(s).`);
    await mongoose.disconnect();
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
