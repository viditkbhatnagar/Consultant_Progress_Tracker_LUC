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

        // Create Consultants for Team Shasin
        console.log('\n🤝 Creating Consultants for Team Shasin...');
        const shasinConsultants = ['OPTIN', 'ORNV', 'MOHAMMED', 'JAKIM', 'MUNMUN', 'JAMAL'];
        const consultantDocs = {};

        for (const name of shasinConsultants) {
            const consultant = await Consultant.create({
                name,
                email: `${name.toLowerCase()}@learnerseducation.com`,
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                isActive: true
            });
            consultantDocs[name] = consultant;
            console.log(`✅ ${name} created`);
        }

        // Helper function to get date for specific week and day
        const getDateForWeek = (weekStart, dayOffset = 0) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + dayOffset);
            return date;
        };

        // Helper to get week start and end dates
        const getWeekDates = (weekStart) => {
            const start = new Date(weekStart);
            const end = new Date(weekStart);
            end.setDate(end.getDate() + 6); // Week ends on Sunday
            return { start, end };
        };

        // Populate Team Shasin Commitments
        console.log('\n📊 Populating Team Shasin Commitments (Nov 2025)...');

        // Week 1: Nov 3-7, 2025 (Week 45)
        const week1Start = new Date('2025-11-03');
        const week1Dates = getWeekDates(week1Start);
        const week1Commitments = [
            {
                consultantName: 'OPTIN',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 45,
                year: 2025,
                weekStartDate: week1Dates.start,
                weekEndDate: week1Dates.end,
                commitmentMade: 'Students prolonged decisions',
                leadStage: 'Hot',
                conversionProbability: 50,
                admissionClosed: false,
                tlComment: 'Cross verified - she accepted that committed to pay on the 17th',
                status: 'pending'
            },
            {
                consultantName: 'ORNV',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 45,
                year: 2025,
                weekStartDate: week1Dates.start,
                weekEndDate: week1Dates.end,
                commitmentMade: 'Committed payment meeting was done, but WAS not open to resources that the payment was committed',
                leadStage: 'Unresponsive',
                conversionProbability: 75,
                admissionClosed: false,
                tlComment: 'Unapproachable Lead',
                status: 'pending'
            },
            {
                consultantName: 'MOHAMMED',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 45,
                year: 2025,
                weekStartDate: week1Dates.start,
                weekEndDate: week1Dates.end,
                commitmentMade: 'Availability mismatch',
                leadStage: 'Cold',
                conversionProbability: 75,
                admissionClosed: false,
                tlComment: 'Unwanted but scheduled',
                status: 'pending'
            }
        ];

        // Week 2: Nov 10-14, 2025 (Week 46)
        const week2Start = new Date('2025-11-10');
        const week2Dates = getWeekDates(week2Start);
        const week2Commitments = [
            {
                consultantName: 'JAKIM',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Did into follow',
                leadStage: 'Admission',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'Poach follow up done',
                status: 'pending'
            },
            {
                consultantName: 'MUNMUN',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Did not follow up done works call',
                leadStage: 'Admission',
                conversionProbability: 70,
                admissionClosed: false,
                tlComment: 'scheduled follow up today',
                status: 'pending'
            },
            {
                consultantName: 'ORNV',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'ADMISSION',
                leadStage: 'Admission',
                conversionProbability: 100,
                admissionClosed: true,
                achievementPercentage: 100,
                tlComment: 'scheduled follow up today',
                status: 'achieved'
            },
            {
                consultantName: 'ORNV',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Not of interest - user will be blocked by DPIN FLOW',
                leadStage: 'Meeting Scheduled',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'admission',
                status: 'pending'
            },
            {
                consultantName: 'MOHAMMED',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Needs More Time',
                leadStage: 'Warm',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'scheduled follow up today',
                status: 'pending'
            },
            {
                consultantName: 'MOHAMMED',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Warm follow up',
                leadStage: 'Warm',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'on point- is scheduled',
                status: 'pending'
            },
            {
                consultantName: 'JAMAL',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 46,
                year: 2025,
                weekStartDate: week2Dates.start,
                weekEndDate: week2Dates.end,
                commitmentMade: 'Postponed to the week',
                leadStage: 'Warm',
                conversionProbability: 50,
                admissionClosed: false,
                tlComment: 'meeting scheduled for today',
                status: 'pending'
            }
        ];

        // Week 3: Nov 17-21, 2025 (Week 47)
        const week3Start = new Date('2025-11-17');
        const week3Dates = getWeekDates(week3Start);
        const week3Commitments = [
            {
                consultantName: 'JAKIM',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 47,
                year: 2025,
                weekStartDate: week3Dates.start,
                weekEndDate: week3Dates.end,
                commitmentMade: 'Meeting Monday',
                leadStage: 'Admission',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'NEXT YEAR',
                status: 'pending'
            },
            {
                consultantName: 'JAKIM',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 47,
                year: 2025,
                weekStartDate: week3Dates.start,
                weekEndDate: week3Dates.end,
                commitmentMade: 'Meeting Tuesday',
                leadStage: 'Cold',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'Spoke confirmed but four decider is up late',
                status: 'pending'
            },
            {
                consultantName: 'ORNV',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 47,
                year: 2025,
                weekStartDate: week3Dates.start,
                weekEndDate: week3Dates.end,
                commitmentMade: 'Results not found complete yet',
                leadStage: 'Cold',
                conversionProbability: 0,
                admissionClosed: false,
                tlComment: 'NEXT YEAR',
                status: 'pending'
            },
            {
                consultantName: 'ORNV',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 47,
                year: 2025,
                weekStartDate: week3Dates.start,
                weekEndDate: week3Dates.end,
                commitmentMade: 'Meeting Monday call',
                leadStage: 'Cold',
                conversionProbability: 80,
                admissionClosed: false,
                tlComment: 'Strongly cross verified and reminded not the payment',
                status: 'pending'
            },
            {
                consultantName: 'MOHAMMED',
                teamName: 'Team Shasin',
                teamLead: teamLeads['Shasin']._id,
                weekNumber: 47,
                year: 2025,
                weekStartDate: week3Dates.start,
                weekEndDate: week3Dates.end,
                commitmentMade: 'Figured out the form',
                leadStage: 'Cold',
                conversionProbability: 80,
                admissionClosed: false,
                tlComment: 'Saturday cross verified and told me the data and information that was asked and she was open to use about the amount and the decision but final wasn\'t made',
                status: 'pending'
            }
        ];


        // Insert all commitments
        const allCommitments = [...week1Commitments, ...week2Commitments, ...week3Commitments];

        for (const commitmentData of allCommitments) {
            await Commitment.create(commitmentData);
        }

        console.log(`✅ Created ${allCommitments.length} commitments for Team Shasin`);


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
