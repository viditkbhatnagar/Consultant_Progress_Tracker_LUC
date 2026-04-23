// Deep audit on LUC student dates and fees. Surfaces the specific rows
// behind "dates showing July/August 2026 when today is April 2026" and
// "admission fee numbers look haywire".

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

const h = (t) => console.log(`\n========== ${t} ==========`);

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

(async () => {
    await connectDB();
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    console.log(`Today: ${todayIso}`);

    // ---- closingDate monthly distribution ----
    h('LUC students by closingDate month (to see the Aug/Jul 2026 anomaly)');
    const byMonth = await Student.aggregate([
        { $match: { organization: 'luc', closingDate: { $ne: null } } },
        {
            $group: {
                _id: {
                    y: { $year: '$closingDate' },
                    m: { $month: '$closingDate' },
                },
                n: { $sum: 1 },
            },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    let totalWithDate = 0;
    for (const r of byMonth) {
        totalWithDate += r.n;
        console.log(`  ${r._id.y}-${String(r._id.m).padStart(2, '0')}: ${r.n}`);
    }
    console.log(`  TOTAL with closingDate: ${totalWithDate}`);

    // ---- enquiryDate monthly distribution ----
    h('LUC students by enquiryDate month');
    const enqMonth = await Student.aggregate([
        { $match: { organization: 'luc', enquiryDate: { $ne: null } } },
        {
            $group: {
                _id: { y: { $year: '$enquiryDate' }, m: { $month: '$enquiryDate' } },
                n: { $sum: 1 },
            },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    for (const r of enqMonth) console.log(`  ${r._id.y}-${String(r._id.m).padStart(2, '0')}: ${r.n}`);

    // ---- Future-dated records (detail) ----
    h('LUC students with closingDate > today');
    const futureClose = await Student.find({
        organization: 'luc',
        closingDate: { $gt: now },
    })
        .select('studentName consultantName teamName closingDate enquiryDate createdAt courseFee admissionFeePaid')
        .sort('closingDate')
        .lean();
    console.log(`Count: ${futureClose.length}`);
    for (const s of futureClose) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | cons=${s.consultantName} | close=${fmt(s.closingDate)} | enq=${fmt(s.enquiryDate)} | created=${fmt(s.createdAt)} | courseFee=${s.courseFee} | paid=${s.admissionFeePaid}`
        );
    }

    h('LUC students with enquiryDate > today');
    const futureEnq = await Student.find({
        organization: 'luc',
        enquiryDate: { $gt: now },
    })
        .select('studentName consultantName teamName closingDate enquiryDate createdAt')
        .sort('enquiryDate')
        .lean();
    console.log(`Count: ${futureEnq.length}`);
    for (const s of futureEnq) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | close=${fmt(s.closingDate)} | enq=${fmt(s.enquiryDate)}`
        );
    }

    // ---- Dates that look AHEAD of "created-at" (implausible) ----
    h('LUC students where closingDate is > 6 months AFTER createdAt (suspicious data entry)');
    const all = await Student.find({ organization: 'luc' })
        .select('studentName consultantName teamName closingDate enquiryDate createdAt courseFee admissionFeePaid')
        .lean();
    const sixMonths = 1000 * 60 * 60 * 24 * 183;
    const aheadOfCreated = all.filter(
        (s) => s.closingDate && s.createdAt && new Date(s.closingDate) - new Date(s.createdAt) > sixMonths
    );
    console.log(`Count: ${aheadOfCreated.length}`);
    for (const s of aheadOfCreated.slice(0, 25)) {
        console.log(
            `  ${s.studentName} | created=${fmt(s.createdAt)} | close=${fmt(s.closingDate)} | diff_days=${Math.round((new Date(s.closingDate) - new Date(s.createdAt)) / (1000 * 60 * 60 * 24))}`
        );
    }

    // ---- Fee distribution ----
    h('LUC fee distribution');
    const feeStats = await Student.aggregate([
        { $match: { organization: 'luc' } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                minCourseFee: { $min: '$courseFee' },
                maxCourseFee: { $max: '$courseFee' },
                avgCourseFee: { $avg: '$courseFee' },
                minPaid: { $min: '$admissionFeePaid' },
                maxPaid: { $max: '$admissionFeePaid' },
                avgPaid: { $avg: '$admissionFeePaid' },
                sumPaid: { $sum: '$admissionFeePaid' },
                sumCourseFee: { $sum: '$courseFee' },
            },
        },
    ]);
    console.log(JSON.stringify(feeStats[0], null, 2));

    // Percentiles (p50, p95, p99) for courseFee and admissionFeePaid
    const courseFees = all.map((s) => s.courseFee || 0).sort((a, b) => a - b);
    const admissionFees = all
        .map((s) => s.admissionFeePaid || 0)
        .filter((x) => x > 0)
        .sort((a, b) => a - b);
    const pct = (arr, p) => (arr.length ? arr[Math.floor((p / 100) * (arr.length - 1))] : 0);
    console.log(`\ncourseFee percentiles:`);
    console.log(`  p50=${pct(courseFees, 50)} p90=${pct(courseFees, 90)} p95=${pct(courseFees, 95)} p99=${pct(courseFees, 99)} max=${pct(courseFees, 100)}`);
    console.log(`admissionFeePaid percentiles (non-zero only):`);
    console.log(`  n=${admissionFees.length} p50=${pct(admissionFees, 50)} p90=${pct(admissionFees, 90)} p95=${pct(admissionFees, 95)} p99=${pct(admissionFees, 99)} max=${pct(admissionFees, 100)}`);

    // ---- Fee outliers ----
    h('Top 15 LUC students by courseFee (possible over-inflated entries)');
    const topCourse = [...all]
        .sort((a, b) => (b.courseFee || 0) - (a.courseFee || 0))
        .slice(0, 15);
    for (const s of topCourse) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | cons=${s.consultantName} | courseFee=${s.courseFee} | paid=${s.admissionFeePaid} | close=${fmt(s.closingDate)}`
        );
    }

    h('Top 15 LUC students by admissionFeePaid');
    const topPaid = [...all]
        .sort((a, b) => (b.admissionFeePaid || 0) - (a.admissionFeePaid || 0))
        .slice(0, 15);
    for (const s of topPaid) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | cons=${s.consultantName} | courseFee=${s.courseFee} | paid=${s.admissionFeePaid} | close=${fmt(s.closingDate)}`
        );
    }

    h('LUC students where admissionFeePaid > courseFee (overpaid)');
    const overpaid = all.filter(
        (s) => (s.admissionFeePaid || 0) > (s.courseFee || 0) && (s.admissionFeePaid || 0) > 0
    );
    console.log(`Count: ${overpaid.length}`);
    for (const s of overpaid) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | courseFee=${s.courseFee} | paid=${s.admissionFeePaid} | delta=+${(s.admissionFeePaid || 0) - (s.courseFee || 0)}`
        );
    }

    h('LUC students with 0 courseFee');
    const zeroFee = all.filter((s) => !s.courseFee);
    for (const s of zeroFee) {
        console.log(
            `  ${s.studentName} | team=${s.teamName} | cons=${s.consultantName} | close=${fmt(s.closingDate)} | paid=${s.admissionFeePaid}`
        );
    }

    h('LUC: admissionFeePaid suspiciously close to courseFee * 10 or courseFee / 10 (decimal typo?)');
    const decimalTypos = all.filter((s) => {
        if (!s.courseFee || !s.admissionFeePaid) return false;
        const ratio = s.admissionFeePaid / s.courseFee;
        return ratio >= 9 || (ratio > 0 && ratio < 0.12 && s.admissionFeePaid > 10);
    });
    console.log(`Count: ${decimalTypos.length}`);
    for (const s of decimalTypos.slice(0, 20)) {
        const ratio = (s.admissionFeePaid / s.courseFee).toFixed(2);
        console.log(
            `  ${s.studentName} | team=${s.teamName} | courseFee=${s.courseFee} | paid=${s.admissionFeePaid} | ratio=${ratio}`
        );
    }

    await mongoose.connection.close();
    process.exit(0);
})();
