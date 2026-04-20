require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const {
    ORG_SKILLHUB_TRAINING,
    ORG_SKILLHUB_INSTITUTE,
} = require('../config/organizations');

// Non-destructive: only creates Skillhub users and counselors.
// Does NOT touch any LUC data. Safe to run in production.
// Usage: node scripts/seedSkillhub.js

const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&*';
    let pw = '';
    for (let i = 0; i < 12; i++) {
        pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pw;
};

const BRANCHES = [
    {
        email: 'training@skillhub.com',
        name: 'Skillhub Training',
        teamName: 'Skillhub Training',
        organization: ORG_SKILLHUB_TRAINING,
        counselors: ['Shiju', 'Divyanji'],
    },
    {
        email: 'institute@skillhub.com',
        name: 'Skillhub Institute',
        teamName: 'Skillhub Institute',
        organization: ORG_SKILLHUB_INSTITUTE,
        counselors: ['Umme', 'Ayisha', 'Ameen', 'Zakeer'],
    },
];

const run = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const generated = [];

    for (const branch of BRANCHES) {
        let branchUser = await User.findOne({ email: branch.email });
        let password = null;

        if (branchUser) {
            // Reset password so we can surface it in LOGIN_CREDENTIALS.md
            password = generatePassword();
            branchUser.password = password;
            branchUser.organization = branch.organization;
            branchUser.role = 'skillhub';
            branchUser.teamName = branch.teamName;
            branchUser.name = branch.name;
            branchUser.isActive = true;
            await branchUser.save();
            console.log(`🔁 Reset password for existing login ${branch.email}`);
        } else {
            password = generatePassword();
            branchUser = await User.create({
                email: branch.email,
                password,
                name: branch.name,
                role: 'skillhub',
                organization: branch.organization,
                teamName: branch.teamName,
                isActive: true,
            });
            console.log(`✨ Created new login ${branch.email}`);
        }

        generated.push({
            name: branch.name,
            email: branch.email,
            password,
            organization: branch.organization,
        });

        for (const counselorName of branch.counselors) {
            const existing = await Consultant.findOne({
                name: counselorName,
                organization: branch.organization,
            });
            if (existing) {
                existing.teamLead = branchUser._id;
                existing.teamName = branch.teamName;
                existing.isActive = true;
                await existing.save();
                console.log(`   ↻ Updated counselor ${counselorName}`);
            } else {
                await Consultant.create({
                    name: counselorName,
                    email: `${counselorName.toLowerCase()}@skillhub.com`,
                    teamName: branch.teamName,
                    teamLead: branchUser._id,
                    organization: branch.organization,
                    isActive: true,
                });
                console.log(`   ✨ Created counselor ${counselorName}`);
            }
        }
    }

    // Append Skillhub section to LOGIN_CREDENTIALS.md (or replace if section exists)
    const credPath = path.join(__dirname, '../../LOGIN_CREDENTIALS.md');
    let existing = '';
    try {
        existing = fs.readFileSync(credPath, 'utf8');
    } catch {
        existing = '# Team Progress Tracker - Login Credentials\n\n';
    }

    // Strip any previous Skillhub section
    const marker = '\n## Skillhub — Branch Logins\n';
    const cutIdx = existing.indexOf(marker);
    if (cutIdx !== -1) existing = existing.slice(0, cutIdx);

    let skillhubBlock = marker + `\n_Regenerated: ${new Date().toISOString()}_\n\n`;
    for (const cred of generated) {
        skillhubBlock += `### ${cred.name}\n`;
        skillhubBlock += `- **Email:** ${cred.email}\n`;
        skillhubBlock += `- **Password:** ${cred.password}\n`;
        skillhubBlock += `- **Organization:** ${cred.organization}\n\n`;
    }

    fs.writeFileSync(credPath, existing + skillhubBlock);
    console.log('\n✅ LOGIN_CREDENTIALS.md updated with Skillhub section');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📋 SKILLHUB CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════\n');
    generated.forEach((c) => {
        console.log(`${c.name}`);
        console.log(`  Email:    ${c.email}`);
        console.log(`  Password: ${c.password}`);
        console.log(`  Org:      ${c.organization}\n`);
    });

    process.exit(0);
};

run().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
