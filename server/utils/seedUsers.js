const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Commitment = require('../models/Commitment');

// Load env vars
dotenv.config();

const connectDB = require('../config/db');

const seedDatabase = async () => {
    try {
        await connectDB();

        // Clear existing data
        await User.deleteMany({});
        await Commitment.deleteMany({});

        console.log('🗑️  Cleared existing data...');

        // Create Admin
        const admin = await User.create({
            name: 'Bhanu Prakash',
            email: 'bhanu@learnerseducation.com',
            password: 'Admin@123',
            role: 'admin',
            phone: '+91-9876543210',
            isActive: true,
        });

        console.log('✅ Admin created');

        // Create Team Leads
        const teamLead1 = await User.create({
            name: 'Shasin Kumar',
            email: 'shasin@learnerseducation.com',
            password: 'TeamLead@123',
            role: 'team_lead',
            teamName: 'North Region Team',
            phone: '+91-9876543211',
            isActive: true,
        });

        const teamLead2 = await User.create({
            name: 'Priya Sharma',
            email: 'priya@learnerseducation.com',
            password: 'TeamLead@123',
            role: 'team_lead',
            teamName: 'South Region Team',
            phone: '+91-9876543212',
            isActive: true,
        });

        console.log('✅ Team Leads created');

        // Create Consultants for Team 1
        const consultant1 = await User.create({
            name: 'Linta Joseph',
            email: 'linta@learnerseducation.com',
            password: 'Consultant@123',
            role: 'consultant',
            teamName: 'North Region Team',
            teamLead: teamLead1._id,
            phone: '+91-9876543213',
            isActive: true,
        });

        const consultant2 = await User.create({
            name: 'Rahul Verma',
            email: 'rahul@learnerseducation.com',
            password: 'Consultant@123',
            role: 'consultant',
            teamName: 'North Region Team',
            teamLead: teamLead1._id,
            phone: '+91-9876543214',
            isActive: true,
        });

        const consultant3 = await User.create({
            name: 'Anjali Desai',
            email: 'anjali@learnerseducation.com',
            password: 'Consultant@123',
            role: 'consultant',
            teamName: 'North Region Team',
            teamLead: teamLead1._id,
            phone: '+91-9876543215',
            isActive: true,
        });

        // Create Consultants for Team 2
        const consultant4 = await User.create({
            name: 'Vikram Singh',
            email: 'vikram@learnerseducation.com',
            password: 'Consultant@123',
            role: 'consultant',
            teamName: 'South Region Team',
            teamLead: teamLead2._id,
            phone: '+91-9876543216',
            isActive: true,
        });

        const consultant5 = await User.create({
            name: 'Meera Patel',
            email: 'meera@learnerseducation.com',
            password: 'Consultant@123',
            role: 'consultant',
            teamName: 'South Region Team',
            teamLead: teamLead2._id,
            phone: '+91-9876543217',
            isActive: true,
        });

        console.log('✅ Consultants created');

        // Current week information (November 2025, Week 48)
        const weekNumber = 48;
        const year = 2025;

        // Week 48, 2025 runs from November 24-30
        const weekStartDate = new Date('2025-11-24');
        const weekEndDate = new Date('2025-11-30');

        // Sample commitments for current week (Week 48, November 2025)
        const commitments = [
            // Linta's commitments
            {
                consultant: consultant1._id,
                consultantName: consultant1.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                dayCommitted: 'Monday',
                studentName: 'Arjun Mehta',
                commitmentMade: 'Follow up for MBA admission at IIM Bangalore, discuss scholarship options',
                leadStage: 'Hot',
                conversionProbability: 85,
                followUpDate: new Date('2025-11-29'),
                followUpNotes: 'Student very interested, has good CAT score',
                meetingsDone: 2,
                achievementPercentage: 75,
                status: 'in_progress',
            },
            {
                consultant: consultant1._id,
                consultantName: consultant1.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Tuesday',
                studentName: 'Sneha Reddy',
                commitmentMade: 'Schedule college visit for B.Tech Computer Science program',
                leadStage: 'Warm',
                conversionProbability: 65,
                followUpDate: new Date('2025-11-30'),
                followUpNotes: 'Parents want to visit campus first',
                meetingsDone: 1,
                achievementPercentage: 50,
                status: 'in_progress',
            },
            {
                consultant: consultant1._id,
                consultantName: consultant1.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Wednesday',
                studentName: 'Karthik Iyer',
                commitmentMade: 'Complete application for MS in Data Science at abroad university',
                leadStage: 'Offer Sent',
                conversionProbability: 90,
                followUpDate: new Date('2025-12-01'),
                followUpNotes: 'Offer received, waiting for financial aid confirmation',
                meetingsDone: 3,
                achievementPercentage: 90,
                status: 'achieved',
                admissionClosed: true,
                closedDate: new Date('2025-11-27'),
            },

            // Rahul's commitments
            {
                consultant: consultant2._id,
                consultantName: consultant2.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Monday',
                studentName: 'Divya Nair',
                commitmentMade: 'Counseling for BBA program selection and entrance preparation',
                leadStage: 'Cold',
                conversionProbability: 40,
                followUpDate: new Date('2025-12-02'),
                followUpNotes: 'Student needs more information about career prospects',
                meetingsDone: 1,
                achievementPercentage: 30,
                status: 'pending',
            },
            {
                consultant: consultant2._id,
                consultantName: consultant2.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Thursday',
                studentName: 'Rohan Kapoor',
                commitmentMade: 'Application review for GMAT coaching and MBA abroad admission',
                leadStage: 'Meeting Scheduled',
                conversionProbability: 70,
                followUpDate: new Date('2025-11-29'),
                followUpNotes: 'Meeting scheduled for Friday',
                meetingsDone: 1,
                achievementPercentage: 60,
                status: 'in_progress',
            },

            // Anjali's commitments
            {
                consultant: consultant3._id,
                consultantName: consultant3.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Monday',
                studentName: 'Pooja Agarwal',
                commitmentMade: 'Finalize admission for BCom Honours program',
                leadStage: 'Admission',
                conversionProbability: 95,
                followUpDate: new Date('2025-11-28'),
                followUpNotes: 'Admission confirmed, collecting documents',
                meetingsDone: 4,
                achievementPercentage: 100,
                status: 'achieved',
                admissionClosed: true,
                closedDate: new Date('2025-11-26'),
            },
            {
                consultant: consultant3._id,
                consultantName: consultant3.name,
                teamLead: teamLead1._id,
                teamName: 'North Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Wednesday',
                studentName: 'Amit Shah',
                commitmentMade: 'Career counseling for engineering specialization choice',
                leadStage: 'Warm',
                conversionProbability: 60,
                followUpDate: new Date('2025-11-30'),
                followUpNotes: 'Interested in AI/ML specialization',
                meetingsDone: 2,
                achievementPercentage: 55,
                status: 'in_progress',
            },

            // Vikram's commitments
            {
                consultant: consultant4._id,
                consultantName: consultant4.name,
                teamLead: teamLead2._id,
                teamName: 'South Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Tuesday',
                studentName: 'Lakshmi Menon',
                commitmentMade: 'Discuss scholarship opportunities for MSc Psychology program',
                leadStage: 'Hot',
                conversionProbability: 80,
                followUpDate: new Date('2025-11-29'),
                followUpNotes: 'Eligible for merit scholarship',
                meetingsDone: 2,
                achievementPercentage: 70,
                status: 'in_progress',
            },
            {
                consultant: consultant4._id,
                consultantName: consultant4.name,
                teamLead: teamLead2._id,
                teamName: 'South Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Friday',
                studentName: 'Suresh Kumar',
                commitmentMade: 'Complete entrance exam registration for CA foundation course',
                leadStage: 'Awaiting Confirmation',
                conversionProbability: 75,
                followUpDate: new Date('2025-12-01'),
                followUpNotes: 'Registration link sent, awaiting payment confirmation',
                meetingsDone: 1,
                achievementPercentage: 65,
                status: 'in_progress',
            },

            // Meera's commitments
            {
                consultant: consultant5._id,
                consultantName: consultant5.name,
                teamLead: teamLead2._id,
                teamName: 'South Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Monday',
                studentName: 'Preethi Rao',
                commitmentMade: 'Application for Design program at NIFT with portfolio review',
                leadStage: 'CIF',
                conversionProbability: 88,
                followUpDate: new Date('2025-11-28'),
                followUpNotes: 'Portfolio submitted, awaiting interview call',
                meetingsDone: 3,
                achievementPercentage: 85,
                status: 'achieved',
                admissionClosed: true,
                closedDate: new Date('2025-11-27'),
            },
            {
                consultant: consultant5._id,
                consultantName: consultant5.name,
                teamLead: teamLead2._id,
                teamName: 'South Region Team',
                weekNumber,
                year,
                weekStartDate,
                weekEndDate,
                year,
                dayCommitted: 'Thursday',
                studentName: 'Nikhil Gupta',
                commitmentMade: 'Counseling for study abroad options in UK universities',
                leadStage: 'Warm',
                conversionProbability: 55,
                followUpDate: new Date('2025-12-03'),
                followUpNotes: 'Researching university options and visa requirements',
                meetingsDone: 1,
                achievementPercentage: 40,
                status: 'pending',
            },
        ];

        await Commitment.insertMany(commitments);

        console.log('✅ Commitments created for Week 48, November 2025');

        console.log('\n========================================');
        console.log('🎉 Database seeded successfully!');
        console.log('========================================\n');

        console.log('📝 LOGIN CREDENTIALS:\n');
        console.log('👤 ADMIN:');
        console.log('   Email: bhanu@learnerseducation.com');
        console.log('   Password: Admin@123\n');

        console.log('👥 TEAM LEADS:');
        console.log('   1. Shasin Kumar (North Region Team)');
        console.log('      Email: shasin@learnerseducation.com');
        console.log('      Password: TeamLead@123\n');
        console.log('   2. Priya Sharma (South Region Team)');
        console.log('      Email: priya@learnerseducation.com');
        console.log('      Password: TeamLead@123\n');

        console.log('💼 CONSULTANTS:');
        console.log('   North Region Team:');
        console.log('   1. Linta Joseph');
        console.log('      Email: linta@learnerseducation.com');
        console.log('      Password: Consultant@123');
        console.log('   2. Rahul Verma');
        console.log('      Email: rahul@learnerseducation.com');
        console.log('      Password: Consultant@123');
        console.log('   3. Anjali Desai');
        console.log('      Email: anjali@learnerseducation.com');
        console.log('      Password: Consultant@123\n');

        console.log('   South Region Team:');
        console.log('   4. Vikram Singh');
        console.log('      Email: vikram@learnerseducation.com');
        console.log('      Password: Consultant@123');
        console.log('   5. Meera Patel');
        console.log('      Email: meera@learnerseducation.com');
        console.log('      Password: Consultant@123\n');

        console.log('📊 DATA SUMMARY:');
        console.log(`   - Week: 48, Year: 2025 (Current Week)`);
        console.log(`   - Total Users: 8 (1 Admin, 2 Team Leads, 5 Consultants)`);
        console.log(`   - Total Commitments: ${commitments.length}`);
        console.log(`   - Teams: North Region Team (3 consultants), South Region Team (2 consultants)`);
        console.log('========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
