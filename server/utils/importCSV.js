const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const User = require('../models/User');
const Commitment = require('../models/Commitment');

// Load env vars
dotenv.config();

const connectDB = require('../config/db');

const importFromCSV = async () => {
    try {
        await connectDB();

        console.log('🔄 Starting CSV import...\n');

        // Clear existing data
        await User.deleteMany({});
        await Commitment.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Import Users
        const usersFilePath = path.join(__dirname, '../data/users.csv');

        if (fs.existsSync(usersFilePath)) {
            const users = [];
            const userMap = new Map(); // To store email -> user ID mapping

            await new Promise((resolve, reject) => {
                fs.createReadStream(usersFilePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        users.push({
                            name: row.name,
                            email: row.email.toLowerCase(),
                            password: row.password,
                            role: row.role,
                            teamName: row.teamName || undefined,
                            phone: row.phone || undefined,
                            isActive: row.isActive !== 'false',
                        });
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // Create users in order: admin first, then team leads, then consultants
            const admins = users.filter(u => u.role === 'admin');
            const teamLeads = users.filter(u => u.role === 'team_lead');
            const consultants = users.filter(u => u.role === 'consultant');

            // Create admins
            for (const userData of admins) {
                const user = await User.create(userData);
                userMap.set(userData.email, user._id);
                console.log(`✅ Created admin: ${user.name}`);
            }

            // Create team leads
            for (const userData of teamLeads) {
                const user = await User.create(userData);
                userMap.set(userData.email, user._id);
                console.log(`✅ Created team lead: ${user.name}`);
            }

            // Create consultants (with team lead reference)
            for (const userData of consultants) {
                // Find team lead by team name
                const teamLead = teamLeads.find(tl => tl.teamName === userData.teamName);
                if (teamLead) {
                    userData.teamLead = userMap.get(teamLead.email);
                }
                const user = await User.create(userData);
                userMap.set(userData.email, user._id);
                console.log(`✅ Created consultant: ${user.name} (${userData.teamName})`);
            }

            console.log(`\n📊 Imported ${users.length} users\n`);

            // Import Commitments
            const commitmentsFilePath = path.join(__dirname, '../data/commitments.csv');

            if (fs.existsSync(commitmentsFilePath)) {
                const commitments = [];

                await new Promise((resolve, reject) => {
                    fs.createReadStream(commitmentsFilePath)
                        .pipe(csv())
                        .on('data', (row) => {
                            const consultantEmail = row.consultantEmail.toLowerCase();
                            const consultant = users.find(u => u.email === consultantEmail && u.role === 'consultant');

                            if (consultant) {
                                const teamLead = teamLeads.find(tl => tl.teamName === consultant.teamName);

                                // Calculate week dates based on week number and year
                                const weekNum = parseInt(row.weekNumber);
                                const year = parseInt(row.year);
                                const weekStartDate = getWeekStartDate(year, weekNum);
                                const weekEndDate = new Date(weekStartDate);
                                weekEndDate.setDate(weekEndDate.getDate() + 6);

                                commitments.push({
                                    consultant: userMap.get(consultantEmail),
                                    consultantName: consultant.name,
                                    teamLead: teamLead ? userMap.get(teamLead.email) : undefined,
                                    teamName: consultant.teamName,
                                    weekNumber: weekNum,
                                    year: year,
                                    weekStartDate,
                                    weekEndDate,
                                    dayCommitted: row.dayCommitted,
                                    studentName: row.studentName,
                                    commitmentMade: row.commitmentMade,
                                    leadStage: row.leadStage,
                                    conversionProbability: parseInt(row.conversionProbability),
                                    followUpDate: row.followUpDate ? new Date(row.followUpDate) : undefined,
                                    followUpNotes: row.followUpNotes || undefined,
                                    meetingsDone: parseInt(row.meetingsDone) || 0,
                                    achievementPercentage: parseInt(row.achievementPercentage) || 0,
                                    status: row.status || 'pending',
                                    admissionClosed: row.admissionClosed === 'true',
                                    closedDate: row.closedDate ? new Date(row.closedDate) : undefined,
                                    correctiveActionByTL: row.correctiveActionByTL || undefined,
                                    prospectForWeek: row.prospectForWeek ? parseInt(row.prospectForWeek) : undefined,
                                });
                            } else {
                                console.warn(`⚠️  Consultant not found for email: ${consultantEmail}`);
                            }
                        })
                        .on('end', resolve)
                        .on('error', reject);
                });

                await Commitment.insertMany(commitments);
                console.log(`📊 Imported ${commitments.length} commitments\n`);
            } else {
                console.log('⚠️  No commitments.csv file found, skipping commitments import\n');
            }

        } else {
            console.log('❌ users.csv file not found in server/data/ directory');
            console.log('Please create server/data/users.csv with your user data');
        }

        console.log('========================================');
        console.log('🎉 CSV Import completed successfully!');
        console.log('========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error importing CSV:', error);
        process.exit(1);
    }
};

// Helper function to get week start date
function getWeekStartDate(year, weekNumber) {
    const jan4 = new Date(year, 0, 4);
    const daysSinceMonday = (jan4.getDay() + 6) % 7;
    const firstMonday = new Date(year, 0, 4 - daysSinceMonday);
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    return weekStart;
}

importFromCSV();
