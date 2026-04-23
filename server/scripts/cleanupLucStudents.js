// One-time cleanup script for LUC Student data-quality issues surfaced
// in scripts/auditLucStudentsDeep.js.
//
//   cd server && node scripts/cleanupLucStudents.js            (dry-run)
//   cd server && node scripts/cleanupLucStudents.js --apply    (apply fixes)
//
// AUTO-FIX (only in --apply): year-2926 typo on closingDate.
// HUMAN-REVIEW: future-dated rows, duplicate-student pairs, zero
// courseFee rows, over-paid rows. Script reports them; you decide.

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

const APPLY = process.argv.includes('--apply');
const fmt = (d) =>
    d ? new Date(d).toISOString().slice(0, 10).split('-').reverse().join('/') : '—';
const money = (n) => `AED ${(n || 0).toLocaleString()}`;

const hr = (t) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);

(async () => {
    await connectDB();
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    console.log(`Today: ${todayIso}`);
    console.log(`Mode: ${APPLY ? '*** APPLY (will write) ***' : 'DRY-RUN (read-only)'}`);

    // ---------- 1) Year 2926 typo (auto-fix) ----------
    hr('1. YEAR-2926 TYPO — will be auto-fixed in --apply');
    const typoRows = await Student.find({
        organization: 'luc',
        closingDate: { $gte: new Date('2900-01-01') },
    })
        .select('studentName consultantName teamName closingDate enquiryDate')
        .lean();
    console.log(`Found ${typoRows.length} row(s) with a closingDate year > 2900.`);
    for (const s of typoRows) {
        const bad = new Date(s.closingDate);
        // Fix: subtract 900 years (2926 → 2026). Safer than hand-typing a date
        // since the DD/MM part is presumably correct — only the YYYY is wrong.
        const fixed = new Date(bad);
        fixed.setUTCFullYear(bad.getUTCFullYear() - 900);
        console.log(
            `  • ${s.studentName} [${s.teamName} / ${s.consultantName}] — ${fmt(bad)} → ${fmt(fixed)}`
        );
        if (APPLY) {
            await Student.updateOne({ _id: s._id }, { $set: { closingDate: fixed } });
            console.log(`      ✔ updated`);
        }
    }

    // ---------- 2) Future-dated rows (report only) ----------
    hr('2. FUTURE-DATED closingDate (human-review, no auto-fix)');
    const futureClose = await Student.find({
        organization: 'luc',
        closingDate: { $gt: now, $lt: new Date('2900-01-01') }, // excludes the 2926 typo
    })
        .select(
            'studentName consultantName teamName closingDate enquiryDate createdAt courseFee admissionFeePaid'
        )
        .sort('closingDate')
        .lean();
    console.log(`Found ${futureClose.length} row(s). Decide per row whether to delete, backdate, or keep (if it's genuinely a scheduled future closing).`);
    for (const s of futureClose) {
        console.log(
            `  • ${s.studentName} [${s.teamName} / ${s.consultantName}] — close=${fmt(s.closingDate)} · enq=${fmt(s.enquiryDate)} · created=${fmt(s.createdAt)} · courseFee=${money(s.courseFee)} · paid=${money(s.admissionFeePaid)}`
        );
    }

    hr('3. FUTURE-DATED enquiryDate (human-review)');
    const futureEnq = await Student.find({
        organization: 'luc',
        enquiryDate: { $gt: now },
    })
        .select('studentName consultantName teamName closingDate enquiryDate')
        .sort('enquiryDate')
        .lean();
    console.log(`Found ${futureEnq.length} row(s).`);
    for (const s of futureEnq) {
        console.log(
            `  • ${s.studentName} [${s.teamName} / ${s.consultantName}] — enq=${fmt(s.enquiryDate)} · close=${fmt(s.closingDate)}`
        );
    }

    // ---------- 4) Duplicate student names (human-review) ----------
    hr('4. DUPLICATE STUDENT NAMES within LUC (human-review — could be re-enrollments or data-entry dups)');
    const dupNames = await Student.aggregate([
        { $match: { organization: 'luc', studentName: { $ne: '' } } },
        {
            $group: {
                _id: '$studentName',
                n: { $sum: 1 },
                ids: { $push: '$_id' },
                closingDates: { $push: '$closingDate' },
                teams: { $push: '$teamName' },
                consultants: { $push: '$consultantName' },
                paidAmounts: { $push: '$admissionFeePaid' },
            },
        },
        { $match: { n: { $gt: 1 } } },
        { $sort: { n: -1, _id: 1 } },
    ]);
    console.log(`Found ${dupNames.length} duplicate-name group(s).`);
    for (const g of dupNames) {
        console.log(`  ▸ "${g._id}" — ${g.n} records:`);
        for (let i = 0; i < g.n; i++) {
            console.log(
                `      #${i + 1}: close=${fmt(g.closingDates[i])} · team=${g.teams[i]} · consultant=${g.consultants[i]} · paid=${money(g.paidAmounts[i])}`
            );
        }
    }

    // ---------- 5) Zero courseFee rows (human-review) ----------
    hr('5. ZERO courseFee on LUC (should have a fee — finance to fill)');
    const zeroFee = await Student.find({
        organization: 'luc',
        $or: [{ courseFee: 0 }, { courseFee: null }, { courseFee: { $exists: false } }],
    })
        .select('studentName teamName consultantName closingDate admissionFeePaid')
        .lean();
    console.log(`Found ${zeroFee.length} row(s).`);
    for (const s of zeroFee) {
        console.log(
            `  • ${s.studentName} [${s.teamName} / ${s.consultantName}] — close=${fmt(s.closingDate)} · paid=${money(s.admissionFeePaid)}`
        );
    }

    // ---------- 6) Over-paid rows (paid > courseFee) ----------
    hr('6. OVERPAID rows (admissionFeePaid > courseFee)');
    const allLuc = await Student.find({ organization: 'luc' })
        .select('studentName teamName consultantName courseFee admissionFeePaid closingDate')
        .lean();
    const overpaid = allLuc.filter(
        (s) => (s.admissionFeePaid || 0) > (s.courseFee || 0) && (s.admissionFeePaid || 0) > 0
    );
    console.log(`Found ${overpaid.length} row(s).`);
    for (const s of overpaid) {
        console.log(
            `  • ${s.studentName} [${s.teamName}] — courseFee=${money(s.courseFee)} · paid=${money(s.admissionFeePaid)} · delta=+${money((s.admissionFeePaid || 0) - (s.courseFee || 0))}`
        );
    }

    // ---------- 7) closingDate before enquiryDate (human-review) ----------
    hr('7. closingDate < enquiryDate (data-entry order error)');
    const reversed = allLuc.filter((s) => {
        return (
            s.enquiryDate &&
            s.closingDate &&
            new Date(s.closingDate) < new Date(s.enquiryDate)
        );
    });
    // Need full date fields for reversed
    const reversedFull = await Student.find({
        _id: { $in: reversed.map((r) => r._id) },
    })
        .select('studentName teamName consultantName enquiryDate closingDate')
        .lean();
    console.log(`Found ${reversedFull.length} row(s).`);
    for (const s of reversedFull) {
        console.log(
            `  • ${s.studentName} [${s.teamName}] — enq=${fmt(s.enquiryDate)} · close=${fmt(s.closingDate)}`
        );
    }

    // ---------- Summary ----------
    hr('SUMMARY');
    console.log(`Year-2926 typos       : ${typoRows.length}  ${APPLY ? '(fixed)' : '(will fix on --apply)'}`);
    console.log(`Future closingDate    : ${futureClose.length}  (review)`);
    console.log(`Future enquiryDate    : ${futureEnq.length}  (review)`);
    console.log(`Duplicate names       : ${dupNames.length} group(s)  (review)`);
    console.log(`Zero courseFee        : ${zeroFee.length}  (fill in)`);
    console.log(`Overpaid              : ${overpaid.length}  (verify with finance)`);
    console.log(`Date order reversed   : ${reversedFull.length}  (swap or fix)`);

    if (!APPLY) {
        console.log(`\nRun with --apply to auto-fix the year-2926 typo(s). Everything else needs a human decision.`);
    }

    await mongoose.connection.close();
    process.exit(0);
})();
