// Deep data profile for the chatbot system prompt.
//
// Dumps every distinct value, range, and quality flag the LLM would
// benefit from knowing — so the prompt can tell it exactly what shape
// the data is in without wasting tokens on schema it'll never see.
//
// Run: cd server && node scripts/profileChatContext.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Commitment = require('../models/Commitment');
const Meeting = require('../models/Meeting');
const Student = require('../models/Student');
const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const DailyReference = require('../models/DailyReference');

const sectionTitle = (t) => console.log(`\n========== ${t} ==========`);

(async () => {
    await connectDB();

    // ---------- Users ----------
    sectionTitle('USERS');
    const userCount = await User.countDocuments();
    const userByRole = await User.aggregate([
        { $group: { _id: { role: '$role', org: '$organization', active: '$isActive' }, n: { $sum: 1 } } },
        { $sort: { '_id.role': 1, '_id.org': 1 } },
    ]);
    console.log(`Total users: ${userCount}`);
    for (const r of userByRole) {
        console.log(`  role=${r._id.role} org=${r._id.org} active=${r._id.active}: ${r.n}`);
    }
    const teamLeads = await User.find({ role: 'team_lead', isActive: true })
        .select('name teamName organization email')
        .sort('teamName')
        .lean();
    console.log(`\nActive team leads (${teamLeads.length}):`);
    for (const tl of teamLeads) console.log(`  ${tl.teamName} — ${tl.name} (${tl.email}) [${tl.organization}]`);
    const admins = await User.find({ role: 'admin' }).select('name email organization').lean();
    console.log(`\nAdmins (${admins.length}):`);
    for (const a of admins) console.log(`  ${a.name} (${a.email}) [${a.organization}]`);
    const skillhubUsers = await User.find({ role: 'skillhub' }).select('name email teamName organization').lean();
    console.log(`\nSkillhub branch logins (${skillhubUsers.length}):`);
    for (const s of skillhubUsers) console.log(`  ${s.name} (${s.email}) teamName=${s.teamName} org=${s.organization}`);
    const managers = await User.find({ role: 'manager' }).select('name email organization').lean();
    console.log(`\nManagers (${managers.length}):`);
    for (const m of managers) console.log(`  ${m.name} (${m.email}) [${m.organization}]`);

    // ---------- Consultants ----------
    sectionTitle('CONSULTANTS');
    const conByOrg = await Consultant.aggregate([
        { $group: { _id: { org: '$organization', active: '$isActive' }, n: { $sum: 1 } } },
        { $sort: { '_id.org': 1 } },
    ]);
    for (const r of conByOrg) console.log(`  org=${r._id.org} active=${r._id.active}: ${r.n}`);
    const conByTeam = await Consultant.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$teamName', n: { $sum: 1 }, names: { $push: '$name' } } },
        { $sort: { _id: 1 } },
    ]);
    console.log(`\nActive consultants by team:`);
    for (const t of conByTeam) console.log(`  ${t._id} (${t.n}): ${t.names.join(', ')}`);

    // ---------- Commitments ----------
    sectionTitle('COMMITMENTS');
    const cCount = await Commitment.countDocuments();
    console.log(`Total commitments: ${cCount}`);
    const cByOrg = await Commitment.aggregate([
        { $group: { _id: '$organization', n: { $sum: 1 } } },
    ]);
    for (const r of cByOrg) console.log(`  org=${r._id}: ${r.n}`);
    const cByStatus = await Commitment.aggregate([
        { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    console.log(`By status:`);
    for (const r of cByStatus) console.log(`  ${r._id}: ${r.n}`);
    const cByStage = await Commitment.aggregate([
        { $group: { _id: '$leadStage', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`By leadStage (actual values in use):`);
    for (const r of cByStage) console.log(`  ${r._id}: ${r.n}`);
    const cDateRange = await Commitment.aggregate([
        {
            $group: {
                _id: null,
                minWeek: { $min: '$weekStartDate' },
                maxWeek: { $max: '$weekStartDate' },
                minCommit: { $min: '$commitmentDate' },
                maxCommit: { $max: '$commitmentDate' },
                minUpdated: { $min: '$updatedAt' },
                maxUpdated: { $max: '$updatedAt' },
            },
        },
    ]);
    console.log(`\nDate ranges (commitments):`);
    console.log(JSON.stringify(cDateRange[0], null, 2));

    // Data quality: commitments with admissionClosed=true
    const closedStats = await Commitment.aggregate([
        { $match: { admissionClosed: true } },
        {
            $group: {
                _id: '$organization',
                total: { $sum: 1 },
                withClosedDate: { $sum: { $cond: [{ $ifNull: ['$closedDate', false] }, 1, 0] } },
                withClosedAmount: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$closedAmount', 0] }, 0] }, 1, 0] } },
                withAdmissionClosedDate: { $sum: { $cond: [{ $ifNull: ['$admissionClosedDate', false] }, 1, 0] } },
            },
        },
    ]);
    console.log(`\nAdmission-close data quality (all time):`);
    for (const r of closedStats) {
        console.log(
            `  ${r._id}: total=${r.total}, withClosedDate=${r.withClosedDate}, withClosedAmount=${r.withClosedAmount}, withAdmissionClosedDate=${r.withAdmissionClosedDate}`
        );
    }

    // ---------- Meetings ----------
    sectionTitle('MEETINGS');
    const mCount = await Meeting.countDocuments();
    console.log(`Total meetings: ${mCount}`);
    const mByMode = await Meeting.aggregate([
        { $group: { _id: '$mode', n: { $sum: 1 } } },
    ]);
    for (const r of mByMode) console.log(`  mode=${r._id}: ${r.n}`);
    const mByStatus = await Meeting.aggregate([
        { $group: { _id: '$status', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`By status:`);
    for (const r of mByStatus) console.log(`  ${r._id}: ${r.n}`);
    const mDateRange = await Meeting.aggregate([
        {
            $group: {
                _id: null,
                min: { $min: '$meetingDate' },
                max: { $max: '$meetingDate' },
            },
        },
    ]);
    console.log(`Meeting date range:`, JSON.stringify(mDateRange[0], null, 2));
    const mProgramTop = await Meeting.aggregate([
        { $group: { _id: '$program', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 15 },
    ]);
    console.log(`Top programs mentioned on meetings:`);
    for (const r of mProgramTop) console.log(`  ${r._id}: ${r.n}`);

    // ---------- Students ----------
    sectionTitle('STUDENTS');
    const sCount = await Student.countDocuments();
    console.log(`Total students: ${sCount}`);
    const sByOrg = await Student.aggregate([
        { $group: { _id: { org: '$organization', status: '$studentStatus' }, n: { $sum: 1 } } },
        { $sort: { '_id.org': 1, '_id.status': 1 } },
    ]);
    for (const r of sByOrg) console.log(`  org=${r._id.org} status=${r._id.status}: ${r.n}`);

    // LUC university mix
    const sByUniversity = await Student.aggregate([
        { $match: { organization: 'luc' } },
        { $group: { _id: '$university', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`\nLUC students by university:`);
    for (const r of sByUniversity) console.log(`  ${r._id}: ${r.n}`);

    // LUC source mix
    const sBySource = await Student.aggregate([
        { $match: { organization: 'luc' } },
        { $group: { _id: '$source', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`\nLUC students by source:`);
    for (const r of sBySource) console.log(`  ${r._id}: ${r.n}`);

    // Skillhub curriculum mix
    const sByCurriculum = await Student.aggregate([
        { $match: { organization: { $in: ['skillhub_training', 'skillhub_institute'] } } },
        {
            $group: {
                _id: { org: '$organization', curriculum: '$curriculum', slug: '$curriculumSlug' },
                n: { $sum: 1 },
            },
        },
    ]);
    console.log(`\nSkillhub students by curriculum:`);
    for (const r of sByCurriculum)
        console.log(`  org=${r._id.org} curriculum=${r._id.curriculum} slug=${r._id.slug}: ${r.n}`);

    // Revenue recorded vs missing
    const lucRevenueCoverage = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                withCourseFee: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$courseFee', 0] }, 0] }, 1, 0] } },
                withAdmissionFee: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$admissionFeePaid', 0] }, 0] }, 1, 0] } },
                sumCourseFee: { $sum: { $ifNull: ['$courseFee', 0] } },
            },
        },
    ]);
    console.log(`\nLUC Student fees coverage:`, JSON.stringify(lucRevenueCoverage[0], null, 2));

    // Skillhub monies
    const shMonies = await Student.aggregate([
        { $match: { organization: { $in: ['skillhub_training', 'skillhub_institute'] } } },
        {
            $group: {
                _id: '$organization',
                n: { $sum: 1 },
                sumCourseFee: { $sum: { $ifNull: ['$courseFee', 0] } },
                sumAdmissionFeePaid: { $sum: { $ifNull: ['$admissionFeePaid', 0] } },
                sumRegistrationFee: { $sum: { $ifNull: ['$registrationFee', 0] } },
            },
        },
    ]);
    console.log(`\nSkillhub monetary coverage:`);
    for (const r of shMonies) console.log(`  ${r._id}: n=${r.n} sumCourseFee=${r.sumCourseFee} upfront=${r.sumAdmissionFeePaid + r.sumRegistrationFee}`);

    // ---------- Hourly Activity ----------
    sectionTitle('HOURLY ACTIVITY');
    const hCount = await HourlyActivity.countDocuments();
    console.log(`Total hourly rows: ${hCount}`);
    const hByOrg = await HourlyActivity.aggregate([
        { $group: { _id: '$organization', n: { $sum: 1 } } },
    ]);
    for (const r of hByOrg) console.log(`  org=${r._id}: ${r.n}`);
    const hByType = await HourlyActivity.aggregate([
        { $group: { _id: '$activityType', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
    ]);
    console.log(`Activity type distribution:`);
    for (const r of hByType) console.log(`  ${r._id}: ${r.n}`);
    const hDateRange = await HourlyActivity.aggregate([
        { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' } } },
    ]);
    console.log(`Hourly date range:`, JSON.stringify(hDateRange[0], null, 2));

    // ---------- Daily rollups ----------
    sectionTitle('DAILY ADMISSIONS');
    const daCount = await DailyAdmission.countDocuments();
    const daSum = await DailyAdmission.aggregate([
        { $group: { _id: null, totalCount: { $sum: '$count' }, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } },
    ]);
    console.log(`Rows: ${daCount}`);
    console.log(JSON.stringify(daSum[0], null, 2));

    sectionTitle('DAILY REFERENCES');
    const drCount = await DailyReference.countDocuments();
    const drSum = await DailyReference.aggregate([
        { $group: { _id: null, totalCount: { $sum: '$count' }, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } },
    ]);
    console.log(`Rows: ${drCount}`);
    console.log(JSON.stringify(drSum[0], null, 2));

    await mongoose.connection.close();
    process.exit(0);
})();
