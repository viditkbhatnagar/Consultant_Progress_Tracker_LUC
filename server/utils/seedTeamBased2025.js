require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Commitment = require('../models/Commitment');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

const seedDatabase = async () => {
    try {
        console.log('MongoDB Connected:', mongoose.connection.host);

        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Commitment.deleteMany({});

        console.log('👥 Creating users...');

        // Create Admin
        const admin = await User.create({
            email: 'admin@learnerseducation.com',
            password: 'admin123',
            name: 'Admin',
            role: 'admin',
        });

        // Create Team Leads (9 teams)
        const teamTony = await User.create({
            email: 'tony@learnerseducation.com',
            password: 'teamlead123',
            name: 'Tony',
            role: 'team_lead',
            teamName: 'Team Tony',
        });

        const teamShaik = await User.create({
            email: 'shaik@learnerseducation.com',
            password: 'teamlead123',
            name: 'Shaik',
            role: 'team_lead',
            teamName: 'Team Shaik',
        });

        const teamShasin = await User.create({
            email: 'shasin@learnerseducation.com',
            password: 'teamlead123',
            name: 'Shasin',
            role: 'team_lead',
            teamName: 'Team Shasin',
        });

        const teamShakil = await User.create({
            email: 'shakil@learnerseducation.com',
            password: 'teamlead123',
            name: 'Shakil',
            role: 'team_lead',
            teamName: 'Team Shakil',
        });

        const teamAnousha = await User.create({
            email: 'anousha@learnerseducation.com',
            password: 'teamlead123',
            name: 'Anousha',
            role: 'team_lead',
            teamName: 'Team Anousha',
        });

        const teamJamshad = await User.create({
            email: 'jamshad@learnerseducation.com',
            password: 'teamlead123',
            name: 'Jamshad',
            role: 'team_lead',
            teamName: 'Team Jamshad',
        });

        const teamManoj = await User.create({
            email: 'manoj@learnerseducation.com',
            password: 'teamlead123',
            name: 'Manoj',
            role: 'team_lead',
            teamName: 'Team Manoj',
        });

        const teamBahrain = await User.create({
            email: 'bahrain@learnerseducation.com',
            password: 'teamlead123',
            name: 'Bahrain',
            role: 'team_lead',
            teamName: 'Team Bahrain',
        });

        const teamArfath = await User.create({
            email: 'arfath@learnerseducation.com',
            password: 'teamlead123',
            name: 'Arfath',
            role: 'team_lead',
            teamName: 'Team Arfath',
        });

        console.log('📅 Creating commitments for 2025...');

        // Define team structures with consultants as data
        const teams = [
            {
                teamLead: teamTony,
                teamName: 'Team Tony',
                consultants: ['Tony', 'Elizabeth', 'Swetha', 'Nimra', 'Sulu', 'Neelu'],
            },
            {
                teamLead: teamShaik,
                teamName: 'Team Shaik',
                consultants: ['Shaik', 'Syed Faizaan', 'Thanusree'],
            },
            {
                teamLead: teamShasin,
                teamName: 'Team Shasin',
                consultants: ['Shasin', 'Linta', 'Dipin', 'Rahul', 'Munashe'],
            },
            {
                teamLead: teamShakil,
                teamName: 'Team Shakil',
                consultants: ['Shakil', 'Niwala', 'Lijia', 'Neha'],
            },
            {
                teamLead: teamAnousha,
                teamName: 'Team Anousha',
                consultants: ['Anousha', 'Farheen', 'Arunima'],
            },
            {
                teamLead: teamJamshad,
                teamName: 'Team Jamshad',
                consultants: ['Jamshad', 'Arfas', 'Rasanjali'],
            },
            {
                teamLead: teamManoj,
                teamName: 'Team Manoj',
                consultants: ['Manoj', 'Shibil', 'Eslam'],
            },
            {
                teamLead: teamBahrain,
                teamName: 'Team Bahrain',
                consultants: ['Bahrain', 'Aghin'],
            },
            {
                teamLead: teamArfath,
                teamName: 'Team Arfath',
                consultants: ['Arfath', 'Lilian', 'Aishwarya'],
            },
        ];

        const leadStages = ['Cold', 'Warm', 'Hot', 'Unresponsive', 'Meeting Scheduled', 'Admission'];
        const statuses = ['pending', 'in_progress', 'achieved', 'missed'];

        const studentNames = [
            'Aarav Sharma', 'Vivaan Gupta', 'Aditya Kumar', 'Vihaan Singh', 'Arjun Patel',
            'Sai Reddy', 'Reyansh Mehta', 'Ayaan Khan', 'Krishna Iyer', 'Ishaan Joshi',
            'Ananya Verma', 'Diya Agarwal', 'Aadhya Nair', 'Saanvi Desai', 'Kavya Pillai',
            'Isha Rao', 'Myra Shah', 'Anika Menon', 'Navya Bhat', 'Riya Kulkarni',
        ];

        const commitmentTemplates = [
            'Submit scholarship application',
            'Complete university shortlisting',
            'Finalize SOP draft',
            'Arrange parent-student meeting',
            'Follow up on documentation',
            'Schedule visa counseling',
            'Complete application form',
            'Submit financial documents',
            'Coordinate with university admissions',
            'Prepare for interview',
        ];

        const commitments = [];
        let commitmentCount = 0;

        // Create commitments for all 52 weeks of 2025
        for (let week = 1; week <= 52; week++) {
            const weekStartDate = getWeekStartDate(2025, week);
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekEndDate.getDate() + 6);

            for (const team of teams) {
                // Each consultant gets 1-3 commitments per week
                for (const consultantName of team.consultants) {
                    const numCommitments = Math.floor(Math.random() * 3) + 1;

                    for (let i = 0; i < numCommitments; i++) {
                        const studentName = studentNames[Math.floor(Math.random() * studentNames.length)];
                        const commitmentText = commitmentTemplates[Math.floor(Math.random() * commitmentTemplates.length)];
                        const leadStage = leadStages[Math.floor(Math.random() * leadStages.length)];
                        const status = statuses[Math.floor(Math.random() * statuses.length)];
                        const achievementPercentage = status === 'achieved' ? 100 : (status === 'missed' ? 0 : Math.floor(Math.random() * 100));
                        const meetingsDone = Math.floor(Math.random() * 4);
                        const admissionClosed = status === 'achieved' && Math.random() > 0.7;

                        commitments.push({
                            consultantName: consultantName,
                            teamLead: team.teamLead._id,
                            teamName: team.teamName,
                            weekNumber: week,
                            year: 2025,
                            weekStartDate: weekStartDate,
                            weekEndDate: weekEndDate,
                            studentName: studentName,
                            commitmentMade: commitmentText,
                            leadStage: leadStage,
                            status: status,
                            achievementPercentage: achievementPercentage,
                            meetingsDone: meetingsDone,
                            admissionClosed: admissionClosed,
                            isActive: true,
                        });
                        commitmentCount++;
                    }
                }
            }
        }

        await Commitment.insertMany(commitments);

        console.log('✅ Seeding completed successfully!');
        console.log(`📊 Created ${commitmentCount} commitments for 9 teams across 52 weeks of 2025`);
        console.log('');
        console.log('📋 LOGIN CREDENTIALS:');
        console.log('');
        console.log('================================================================================');
        console.log('');
        console.log('🔐 ADMIN:');
        console.log('   Email: admin@learnerseducation.com');
        console.log('   Password: admin123');
        console.log('');
        console.log('👔 TEAM LEADS:');
        console.log('   1. Tony (Team Tony - 6 consultants)');
        console.log('      Email: tony@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   2. Shaik (Team Shaik - 3 consultants)');
        console.log('      Email: shaik@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   3. Shasin (Team Shasin - 5 consultants)');
        console.log('      Email: shasin@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   4. Shakil (Team Shakil - 4 consultants)');
        console.log('      Email: shakil@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   5. Anousha (Team Anousha - 3 consultants)');
        console.log('      Email: anousha@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   6. Jamshad (Team Jamshad - 3 consultants)');
        console.log('      Email: jamshad@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   7. Manoj (Team Manoj - 3 consultants)');
        console.log('      Email: manoj@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   8. Bahrain (Team Bahrain - 2 consultants)');
        console.log('      Email: bahrain@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('   9. Arfath (Team Arfath - 3 consultants including Aishwarya)');
        console.log('      Email: arfath@learnerseducation.com');
        console.log('      Password: teamlead123');
        console.log('');
        console.log('================================================================================');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

// Helper function to get week start date
function getWeekStartDate(year, weekNumber) {
    const jan1 = new Date(year, 0, 1);
    const daysToMonday = (jan1.getDay() === 0 ? -6 : 1) - jan1.getDay();
    const firstMonday = new Date(year, 0, 1 + daysToMonday);
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    return weekStart;
}

seedDatabase();
