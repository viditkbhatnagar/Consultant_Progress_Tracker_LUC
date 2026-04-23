// Student collection data-quality audit. Surfaces issues that matter
// downstream (KPIs, chatbot answers, exports). Read-only — just reports.
//
// Run: cd server && node scripts/auditStudents.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const User = require('../models/User');
const Consultant = require('../models/Consultant');

const h = (t) => console.log(`\n========== ${t} ==========`);

(async () => {
    await connectDB();

    // ---- Totals by org + status ----
    h('Totals by organization × status');
    const byOrgStatus = await Student.aggregate([
        { $group: { _id: { org: '$organization', status: '$studentStatus' }, n: { $sum: 1 } } },
        { $sort: { '_id.org': 1, '_id.status': 1 } },
    ]);
    for (const r of byOrgStatus)
        console.log(`  org=${r._id.org} status=${r._id.status ?? '(undefined)'}: ${r.n}`);

    // ---- LUC required-field coverage ----
    h('LUC required-field coverage (should all be populated for LUC students)');
    const lucCov = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                missingProgram: { $sum: { $cond: [{ $or: [{ $eq: ['$program', ''] }, { $eq: ['$program', null] }] }, 1, 0] } },
                missingUniversity: { $sum: { $cond: [{ $or: [{ $eq: ['$university', ''] }, { $eq: ['$university', null] }] }, 1, 0] } },
                missingSource: { $sum: { $cond: [{ $or: [{ $eq: ['$source', ''] }, { $eq: ['$source', null] }] }, 1, 0] } },
                missingCourseFee: { $sum: { $cond: [{ $or: [{ $eq: ['$courseFee', 0] }, { $eq: ['$courseFee', null] }] }, 1, 0] } },
                missingClosingDate: { $sum: { $cond: [{ $or: [{ $eq: ['$closingDate', null] }, { $not: ['$closingDate'] }] }, 1, 0] } },
                missingEnquiryDate: { $sum: { $cond: [{ $or: [{ $eq: ['$enquiryDate', null] }, { $not: ['$enquiryDate'] }] }, 1, 0] } },
                missingCampaignName: { $sum: { $cond: [{ $or: [{ $eq: ['$campaignName', ''] }, { $eq: ['$campaignName', null] }] }, 1, 0] } },
                missingStudentStatus: { $sum: { $cond: [{ $or: [{ $eq: [{ $type: '$studentStatus' }, 'missing'] }, { $eq: ['$studentStatus', null] }] }, 1, 0] } },
                missingConsultantName: { $sum: { $cond: [{ $or: [{ $eq: ['$consultantName', ''] }, { $eq: ['$consultantName', null] }] }, 1, 0] } },
                missingTeamName: { $sum: { $cond: [{ $or: [{ $eq: ['$teamName', ''] }, { $eq: ['$teamName', null] }] }, 1, 0] } },
            },
        },
    ]);
    console.log(JSON.stringify(lucCov[0], null, 2));

    // ---- Skillhub required-field coverage ----
    h('Skillhub required-field coverage');
    const shCov = await Student.aggregate([
        { $match: { organization: { $in: ['skillhub_training', 'skillhub_institute'] } } },
        {
            $group: {
                _id: '$organization',
                total: { $sum: 1 },
                missingEnrollment: { $sum: { $cond: [{ $or: [{ $eq: ['$enrollmentNumber', ''] }, { $eq: ['$enrollmentNumber', null] }] }, 1, 0] } },
                missingCurriculum: { $sum: { $cond: [{ $or: [{ $eq: ['$curriculum', ''] }, { $eq: ['$curriculum', null] }] }, 1, 0] } },
                missingYearGrade: { $sum: { $cond: [{ $or: [{ $eq: ['$yearOrGrade', ''] }, { $eq: ['$yearOrGrade', null] }] }, 1, 0] } },
                missingAcademicYear: { $sum: { $cond: [{ $or: [{ $eq: ['$academicYear', ''] }, { $eq: ['$academicYear', null] }] }, 1, 0] } },
                missingMode: { $sum: { $cond: [{ $or: [{ $eq: ['$mode', ''] }, { $eq: ['$mode', null] }] }, 1, 0] } },
                missingCourseDuration: { $sum: { $cond: [{ $or: [{ $eq: ['$courseDuration', ''] }, { $eq: ['$courseDuration', null] }] }, 1, 0] } },
                missingStudentStatus: { $sum: { $cond: [{ $or: [{ $eq: [{ $type: '$studentStatus' }, 'missing'] }, { $eq: ['$studentStatus', null] }] }, 1, 0] } },
                zeroCourseFee: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$courseFee', 0] }, 0] }, 1, 0] } },
            },
        },
    ]);
    for (const r of shCov) console.log(JSON.stringify(r, null, 2));

    // ---- Duplicate enrollment numbers (Skillhub unique constraint) ----
    h('Duplicate enrollmentNumbers (should be 0 — schema enforces unique+sparse)');
    const dupEnrol = await Student.aggregate([
        { $match: { enrollmentNumber: { $exists: true, $ne: '' } } },
        { $group: { _id: '$enrollmentNumber', n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
    ]);
    console.log(`Found ${dupEnrol.length} duplicate enrollment numbers`);
    for (const d of dupEnrol) console.log(`  '${d._id}' appears ${d.n} times`);

    // ---- Fee sanity ----
    h('Fee math sanity (LUC)');
    const feeSanity = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: null,
                sumCourseFee: { $sum: { $ifNull: ['$courseFee', 0] } },
                sumAdmissionFeePaid: { $sum: { $ifNull: ['$admissionFeePaid', 0] } },
                sumRegistrationFee: { $sum: { $ifNull: ['$registrationFee', 0] } },
                countWithCourseFee: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$courseFee', 0] }, 0] }, 1, 0] } },
                countWithAdmissionFeePaid: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$admissionFeePaid', 0] }, 0] }, 1, 0] } },
                countExcessPaid: {
                    $sum: {
                        $cond: [
                            {
                                $gt: [
                                    { $ifNull: ['$admissionFeePaid', 0] },
                                    { $ifNull: ['$courseFee', 0] },
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
    ]);
    console.log(JSON.stringify(feeSanity[0], null, 2));

    // ---- Date sanity ----
    h('Date sanity (LUC) — closingDate before enquiryDate, closingDate in future, etc.');
    const allLuc = await Student.find({ organization: 'luc' })
        .select('studentName enquiryDate closingDate createdAt')
        .lean();
    let closingBeforeEnquiry = 0;
    let closingInFuture = 0;
    let enquiryInFuture = 0;
    let closingWayOld = 0;
    const now = new Date();
    const oldThreshold = new Date('2020-01-01');
    const suspects = [];
    for (const s of allLuc) {
        if (s.enquiryDate && s.closingDate && new Date(s.closingDate) < new Date(s.enquiryDate)) {
            closingBeforeEnquiry++;
            if (suspects.length < 5) suspects.push(`closingBeforeEnquiry: ${s.studentName} enq=${s.enquiryDate} close=${s.closingDate}`);
        }
        if (s.closingDate && new Date(s.closingDate) > now) closingInFuture++;
        if (s.enquiryDate && new Date(s.enquiryDate) > now) enquiryInFuture++;
        if (s.closingDate && new Date(s.closingDate) < oldThreshold) closingWayOld++;
    }
    console.log(`  closingDate < enquiryDate: ${closingBeforeEnquiry}`);
    console.log(`  closingDate in future: ${closingInFuture}`);
    console.log(`  enquiryDate in future: ${enquiryInFuture}`);
    console.log(`  closingDate < 2020-01-01: ${closingWayOld}`);
    for (const s of suspects) console.log(`  sample → ${s}`);

    // ---- Orphaned consultant references ----
    h('Orphaned consultant names (on Student but no matching Consultant)');
    const consultantNames = new Set(
        (await Consultant.find({}).select('name').lean()).map((c) => c.name)
    );
    const studentConsultants = await Student.distinct('consultantName');
    const orphaned = studentConsultants.filter((n) => n && !consultantNames.has(n));
    console.log(`${orphaned.length} unique consultantName values on Student with no matching Consultant record.`);
    for (const n of orphaned.slice(0, 15)) console.log(`  '${n}'`);

    // ---- Orphaned teamLead refs ----
    h('Orphaned teamLead references (ObjectId → User not found)');
    const userIds = new Set((await User.find({}).select('_id').lean()).map((u) => String(u._id)));
    const studentTLs = await Student.distinct('teamLead');
    const orphanedTLs = studentTLs.filter((id) => id && !userIds.has(String(id)));
    console.log(`${orphanedTLs.length} Student.teamLead IDs that don't resolve to a User.`);
    for (const id of orphanedTLs.slice(0, 10)) console.log(`  ${id}`);

    // ---- sno coverage ----
    h('Serial number (sno) coverage');
    const snoAgg = await Student.aggregate([
        {
            $group: {
                _id: '$organization',
                total: { $sum: 1 },
                missing: { $sum: { $cond: [{ $or: [{ $eq: ['$sno', 0] }, { $eq: ['$sno', null] }] }, 1, 0] } },
                maxSno: { $max: '$sno' },
                minSno: { $min: '$sno' },
            },
        },
    ]);
    for (const r of snoAgg) console.log(JSON.stringify(r, null, 2));

    // ---- Duplicate sno per team (LUC) ----
    h('Duplicate sno within same team (LUC — sno is scoped per-team)');
    const dupSnoLuc = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: { team: '$teamName', sno: '$sno' },
                n: { $sum: 1 },
                names: { $push: '$studentName' },
            },
        },
        { $match: { n: { $gt: 1 } } },
        { $limit: 10 },
    ]);
    console.log(`Found ${dupSnoLuc.length} dup-sno-per-team instances (first 10 shown)`);
    for (const d of dupSnoLuc) console.log(`  team=${d._id.team} sno=${d._id.sno}: ${d.n} students — ${d.names.slice(0, 5).join(', ')}`);

    await mongoose.connection.close();
    process.exit(0);
})();
