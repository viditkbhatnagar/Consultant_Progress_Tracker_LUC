// Restores the deleted "Team Bahrain" User so existing Student records
// that still carry its ObjectId in `teamLead` resolve correctly in the
// admin edit dialog. The user is re-created with:
//   - the SAME _id as the orphan references (so no student needs to be
//     re-linked)
//   - isActive: false (they're a former team lead, not currently active)
//   - a non-functional password (bcrypt of a random string — account
//     can't log in since isActive blocks auth middleware regardless)
//
//   node scripts/restoreOrphanTeamLead.js            (dry-run)
//   node scripts/restoreOrphanTeamLead.js --apply

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const connectDB = require('../config/db');
const User = require('../models/User');
const Student = require('../models/Student');

const APPLY = process.argv.includes('--apply');
const ORPHAN_ID = '692f1a87ba54d56ac2659609';

(async () => {
    await connectDB();
    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

    const existing = await User.findById(ORPHAN_ID);
    if (existing) {
        console.log(`User ${ORPHAN_ID} already exists:`);
        console.log(`  name=${existing.name} role=${existing.role} team=${existing.teamName} active=${existing.isActive}`);
        await mongoose.connection.close();
        process.exit(0);
    }

    // Confirm the orphan is actually referenced by the expected records.
    const refs = await Student.find({ teamLead: ORPHAN_ID })
        .select('studentName teamName consultantName')
        .lean();
    console.log(`Orphan ObjectId is referenced by ${refs.length} student(s):`);
    for (const s of refs) {
        console.log(`  • ${s.studentName} | team=${s.teamName} | consultant=${s.consultantName}`);
    }

    // Infer teamName from the students. They all say "Team Bahrain".
    const teamName = refs[0]?.teamName || 'Team Bahrain';
    const name = teamName.replace(/^Team\s+/i, '');

    console.log(`\nWill create:`);
    console.log(`  _id: ${ORPHAN_ID}`);
    console.log(`  name: ${name}`);
    console.log(`  email: ${name.toLowerCase()}-former@learnerseducation.com`);
    console.log(`  role: team_lead`);
    console.log(`  organization: luc`);
    console.log(`  teamName: ${teamName}`);
    console.log(`  isActive: false`);

    if (!APPLY) {
        console.log(`\nRun with --apply to restore.`);
        await mongoose.connection.close();
        process.exit(0);
    }

    const user = new User({
        _id: new mongoose.Types.ObjectId(ORPHAN_ID),
        name,
        email: `${name.toLowerCase()}-former@learnerseducation.com`,
        // Random secret — not used, account can't log in (isActive=false
        // blocks protect() middleware), but the field is required by schema.
        password: crypto.randomBytes(16).toString('hex'),
        role: 'team_lead',
        organization: 'luc',
        teamName,
        isActive: false,
    });
    await user.save();
    console.log(`\n✔ Restored. ${refs.length} student(s) now resolve their teamLead reference.`);

    await mongoose.connection.close();
    process.exit(0);
})();
