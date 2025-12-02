require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Commitment = require('../models/Commitment');

// Generate random password
const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const seedDatabase = async () => {
    try {
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Consultant.deleteMany({});
        await Commitment.deleteMany({});
        console.log('✅ Database cleared');

        // Store passwords for logging
        const credentials = [];

        // Create Admin
        console.log('\n👤 Creating Admin...');
        const adminPassword = generatePassword();
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@learnerseducation.com',
            password: adminPassword,
            role: 'admin',
            isActive: true
        });
        credentials.push({ name: 'Admin', email: 'admin@learnerseducation.com', password: adminPassword, role: 'admin' });
        console.log('✅ Admin created');

        // Create Team Leads
        console.log('\n👥 Creating Team Leads...');
        const teamLeadsData = [
            { name: 'Arfath', email: 'arfath@learnerseducation.com', teamName: 'Team Arfath' },
            { name: 'Bahrain', email: 'bahrain@learnerseducation.com', teamName: 'Team Bahrain' },
            { name: 'Manoj', email: 'manoj@learnerseducation.com', teamName: 'Team Manoj' },
            { name: 'Jamshad', email: 'jamshad@learnerseducation.com', teamName: 'Team Jamshad' },
            { name: 'Anousha', email: 'anousha@learnerseducation.com', teamName: 'Team Anousha' },
            { name: 'Shakil', email: 'shakil@learnerseducation.com', teamName: 'Team Shakil' },
            { name: 'Shasin', email: 'shasin@learnerseducation.com', teamName: 'Team Shasin' },
            { name: 'Shaik', email: 'shaik@learnerseducation.com', teamName: 'Team Shaik' },
            { name: 'Tony', email: 'tony@learnerseducation.com', teamName: 'Team Tony' }
        ];

        const teamLeads = {};
        for (const tlData of teamLeadsData) {
            const password = generatePassword();
            const tl = await User.create({
                ...tlData,
                password,
                role: 'team_lead',
                isActive: true
            });
            teamLeads[tlData.name] = tl;
            credentials.push({ ...tlData, password, role: 'team_lead' });
            console.log(`✅ ${tlData.name} created`);
        }


        // Create Consultants for all teams
        console.log('\n🤝 Creating Consultants...');

        const teamConsultants = {
            'Tony': ['Elizabeth', 'Swetha', 'Nimra', 'Sulu', 'Neelu'],
            'Shaik': ['Syed Faizaan', 'Thanusree'],
            'Shasin': ['Linta', 'Dipin', 'Rahul', 'Munashe'],
            'Shakil': ['Nihala', 'Lijia', 'Neha'],
            'Anousha': ['Farineen', 'Arunima'],
            'Jamshad': ['Arfas', 'Kasanjali'],
            'Manoj': ['Shahal', 'Eslam'],
            'Bahrain': ['Chitra', 'Aghin'],
            'Arfath': ['Lilian', 'Aysha Riswin', 'Aishwarya']
        };

        for (const [teamLeadName, consultantNames] of Object.entries(teamConsultants)) {
            console.log(`\n  Creating consultants for Team ${teamLeadName}...`);
            for (const name of consultantNames) {
                await Consultant.create({
                    name,
                    email: `${name.toLowerCase().replace(/ /g, '.')}@learnerseducation.com`,
                    teamName: `Team ${teamLeadName}`,
                    teamLead: teamLeads[teamLeadName]._id,
                    isActive: true
                });
                console.log(`    ✅ ${name}`);
            }
        }

        console.log(`\n✅ Created ${Object.values(teamConsultants).flat().length} consultants across all teams`);

        // Print credentials
        console.log('\n\n═══════════════════════════════════════════════════════');
        console.log('📋 LOGIN CREDENTIALS');
        console.log('═══════════════════════════════════════════════════════\n');

        credentials.forEach(cred => {
            console.log(`${cred.role.toUpperCase()} - ${cred.name}`);
            console.log(`  Email: ${cred.email}`);
            console.log(`  Password: ${cred.password}`);
            if (cred.teamName) console.log(`  Team: ${cred.teamName}`);
            console.log();
        });

        console.log('═══════════════════════════════════════════════════════\n');

        // Return credentials for file update
        return credentials;

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    }
};

// Run the seed
connectDB().then(async () => {
    try {
        const credentials = await seedDatabase();

        // Write to credentials file
        const fs = require('fs');
        const path = require('path');

        let credContent = '# Team Progress Tracker - Login Credentials\n\n';
        credContent += '**Generated:** ' + new Date().toISOString() + '\n\n';
        credContent += '## Admin Account\n\n';

        const admin = credentials.find(c => c.role === 'admin');
        credContent += `- **Email:** ${admin.email}\n`;
        credContent += `- **Password:** ${admin.password}\n\n`;

        credContent += '## Team Lead Accounts\n\n';
        credentials.filter(c => c.role === 'team_lead').forEach(cred => {
            credContent += `### ${cred.name} (${cred.teamName})\n`;
            credContent += `- **Email:** ${cred.email}\n`;
            credContent += `- **Password:** ${cred.password}\n\n`;
        });

        const credPath = path.join(__dirname, '../../LOGIN_CREDENTIALS.md');
        fs.writeFileSync(credPath, credContent);
        console.log('✅ LOGIN_CREDENTIALS.md updated');

        console.log('\n🎉 Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
});
