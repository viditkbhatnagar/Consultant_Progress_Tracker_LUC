const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Commitment = require('../models/Commitment');

// Enhanced seed script for full year 2025
const seedFullYear2025 = async () => {
    try {
        await connectDB();

        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Commitment.deleteMany({});

        console.log('👥 Creating users...');

        // Create Admin
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@learnerseducation.com',
            password: 'admin123',
            role: 'admin',
        });

        // Create Team Leads
        const teamLead1 = await User.create({
            name: 'Shagun Kumar',
            email: 'shagun.kumar@learnerseducation.com',
            password: 'teamlead123',
            role: 'team_lead',
            teamName: 'North Region Team',
        });

        const teamLead2 = await User.create({
            name: 'Priya Singh',
            email: 'priya.singh@learnerseducation.com',
            password: 'teamlead123',
            role: 'team_lead',
            teamName: 'South Region Team',
        });

        // Create Consultants for North Region
        const consultant1 = await User.create({
            name: 'Linta Joseph',
            email: 'linta.joseph@learnerseducation.com',
            password: 'consultant123',
            role: 'consultant',
            teamLead: teamLead1._id,
            teamName: 'North Region Team',
        });

        const consultant2 = await User.create({
            name: 'Rahul Verma',
            email: 'rahul.verma@learnerseducation.com',
            password: 'consultant123',
            role: 'consultant',
            teamLead: teamLead1._id,
            teamName: 'North Region Team',
        });

        const consultant3 = await User.create({
            name: 'Anjali Desai',
            email: 'anjali.desai@learnerseducation.com',
            password: 'consultant123',
            role: 'consultant',
            teamLead: teamLead1._id,
            teamName: 'North Region Team',
        });

        // Create Consultants for South Region
        const consultant4 = await User.create({
            name: 'Arjun Reddy',
            email: 'arjun.reddy@learnerseducation.com',
            password: 'consultant123',
            role: 'consultant',
            teamLead: teamLead2._id,
            teamName: 'South Region Team',
        });

        const consultant5 = await User.create({
            name: 'Kavya Nair',
            email: 'kavya.nair@learnerseducation.com',
            password: 'consultant123',
            role: 'consultant',
            teamLead: teamLead2._id,
            teamName: 'South Region Team',
        });

        console.log('📅 Creating commitments for 2025...');

        const consultants = [consultant1, consultant2, consultant3, consultant4, consultant5];
        const teamLeads = [teamLead1, teamLead1, teamLead1, teamLead2, teamLead2];
        const leadStages = ['Cold', 'Warm', 'Hot', 'Unresponsive', 'Meeting Scheduled', 'Admission'];
        const statuses = ['pending', 'in_progress', 'achieved', 'missed']; // Exact enum values from model

        const studentNames = [
            'Aarav Sharma', 'Vivaan Gupta', 'Aditya Kumar', 'Vihaan Singh', 'Arjun Patel',
            'Sai Reddy', 'Arnav Mehta', 'Dhruv Joshi', 'Krishna Rao', 'Advait Iyer',
            'Ishaan Nair', 'Kabir Verma', 'Reyansh Pandey', 'Atharv Malhotra', 'Kiaan Desai',
            'Ayaan Shah', 'Pranav Chopra', 'Aadhya Kapoor', 'Ananya Agarwal', 'Diya Saxena',
            'Sara Khan', 'Ira Bose', 'Pari Ghosh', 'Myra Jain', 'Navya Sharma',
        ];

        const commitmentTemplates = [
            'Follow up on MBA application',
            'Schedule campus visit',
            'Complete documentation for admission',
            'Discuss course options and fees',
            'Arrange parent-student meeting',
            'Submit scholarship application',
            'Finalize course selection',
            'Complete entrance exam registration',
            'Review financial aid options',
            'Book counseling session',
        ];

        let commitmentCount = 0;
        const allCommitments = [];

        // Generate commitments for weeks 1-52 of 2025
        for (let week = 1; week <= 52; week++) {
            // Get week dates
            const weekStartDate = getWeekStartDate(2025, week);
            const weekEndDate = getWeekEndDate(2025, week);

            // Each consultant gets 1-3 commitments per week randomly
            for (let i = 0; i < consultants.length; i++) {
                const consultant = consultants[i];
                const teamLead = teamLeads[i];
                const commitmentsThisWeek = Math.floor(Math.random() * 3) + 1; // 1-3 commitments

                for (let j = 0; j < commitmentsThisWeek; j++) {
                    const studentName = studentNames[Math.floor(Math.random() * studentNames.length)];
                    const commitmentText = commitmentTemplates[Math.floor(Math.random() * commitmentTemplates.length)];
                    const leadStage = leadStages[Math.floor(Math.random() * leadStages.length)];
                    const status = statuses[Math.floor(Math.random() * statuses.length)];
                    const achievementPercentage = status === 'achieved' ? 100 : (status === 'missed' ? 0 : Math.floor(Math.random() * 100));
                    const meetingsDone = Math.floor(Math.random() * 4);
                    const admissionClosed = status === 'achieved' && Math.random() > 0.7;

                    const commitment = {
                        consultant: consultant._id,
                        consultantName: consultant.name,
                        teamLead: teamLead._id,
                        teamName: teamLead.teamName,
                        studentName: studentName,
                        commitmentMade: `${commitmentText} - ${studentName}`,
                        weekNumber: week,
                        year: 2025,
                        weekStartDate: weekStartDate,
                        weekEndDate: weekEndDate,
                        commitmentAchieved: status === 'achieved' ? commitmentText : '',
                        achievementPercentage: achievementPercentage,
                        meetingsDone: meetingsDone,
                        leadStage: leadStage,
                        status: status,
                        admissionClosed: admissionClosed,
                        closedDate: admissionClosed ? weekEndDate : null,
                        closedAmount: admissionClosed ? Math.floor(Math.random() * 100000) + 50000 : null,
                        conversionProbability: Math.floor(Math.random() * 100),
                        createdBy: consultant._id,
                        lastUpdatedBy: consultant._id,
                    };

                    allCommitments.push(commitment);
                    commitmentCount++;
                }
            }
        }

        // Bulk insert all commitments
        await Commitment.insertMany(allCommitments);

        console.log('✅ Seeding completed successfully!');
        console.log(`📊 Created ${commitmentCount} commitments for ${consultants.length} consultants across 52 weeks of 2025`);
        console.log('\n📋 LOGIN CREDENTIALS:\n');
        console.log('='.repeat(80));
        console.log('\n🔐 ADMIN:');
        console.log(`   Email: admin@learnerseducation.com`);
        console.log(`   Password: admin123`);
        console.log('\n👔 TEAM LEADS:');
        console.log(`   1. Shagun Kumar (North Region Team)`);
        console.log(`      Email: shagun.kumar@learnerseducation.com`);
        console.log(`      Password: teamlead123`);
        console.log(`   2. Priya Singh (South Region Team)`);
        console.log(`      Email: priya.singh@learnerseducation.com`);
        console.log(`      Password: teamlead123`);
        console.log('\n👨‍💼 CONSULTANTS (North Region):');
        console.log(`   1. Linta Joseph`);
        console.log(`      Email: linta.joseph@learnerseducation.com`);
        console.log(`      Password: consultant123`);
        console.log(`   2. Rahul Verma`);
        console.log(`      Email: rahul.verma@learnerseducation.com`);
        console.log(`      Password: consultant123`);
        console.log(`   3. Anjali Desai`);
        console.log(`      Email: anjali.desai@learnerseducation.com`);
        console.log(`      Password: consultant123`);
        console.log('\n👨‍💼 CONSULTANTS (South Region):');
        console.log(`   4. Arjun Reddy`);
        console.log(`      Email: arjun.reddy@learnerseducation.com`);
        console.log(`      Password: consultant123`);
        console.log(`   5. Kavya Nair`);
        console.log(`      Email: kavya.nair@learnerseducation.com`);
        console.log(`      Password: consultant123`);
        console.log('\n' + '='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

// Helper function to get week start date (Monday)
function getWeekStartDate(year, weekNumber) {
    const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

// Helper function to get week end date (Sunday)
function getWeekEndDate(year, weekNumber) {
    const startDate = getWeekStartDate(year, weekNumber);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return endDate;
}

seedFullYear2025();
