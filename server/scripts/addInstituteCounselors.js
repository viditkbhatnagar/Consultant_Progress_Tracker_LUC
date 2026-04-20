require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// Idempotent: adds Ameen & Zakeer to Skillhub Institute if missing.
// Does NOT touch the institute@skillhub.com login or its password.
// Usage: node scripts/addInstituteCounselors.js

const NEW_COUNSELORS = ['Ameen', 'Zakeer'];
const BRANCH_EMAIL = 'institute@skillhub.com';
const TEAM_NAME = 'Skillhub Institute';

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const branchUser = await User.findOne({ email: BRANCH_EMAIL });
    if (!branchUser) {
        throw new Error(`Branch login ${BRANCH_EMAIL} not found — run seedSkillhub.js first.`);
    }

    for (const name of NEW_COUNSELORS) {
        const existing = await Consultant.findOne({
            name,
            organization: ORG_SKILLHUB_INSTITUTE,
        });
        if (existing) {
            console.log(`↻ ${name} already exists — skipping`);
            continue;
        }
        await Consultant.create({
            name,
            email: `${name.toLowerCase()}@skillhub.com`,
            teamName: TEAM_NAME,
            teamLead: branchUser._id,
            organization: ORG_SKILLHUB_INSTITUTE,
            isActive: true,
        });
        console.log(`✨ Created counselor ${name}`);
    }

    process.exit(0);
};

run().catch((err) => {
    console.error('Add counselors failed:', err);
    process.exit(1);
});
