// One-off: profile the non-zero admissionFeePaid distribution for LUC
// students to see whether values like 1575 / 2625 match a VAT-on-top
// pattern (5% UAE VAT) — i.e. system/import artefact — versus arbitrary
// human-entered numbers. Read-only.
//
//   node scripts/profileAdmissionFees.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

(async () => {
    await connectDB();
    const rows = await Student.find({
        organization: 'luc',
        admissionFeePaid: { $gt: 0 },
    })
        .select('admissionFeePaid courseFee teamName closingDate createdBy')
        .lean();

    console.log('Total LUC students with admissionFeePaid > 0:', rows.length);

    const freq = {};
    for (const r of rows) freq[r.admissionFeePaid] = (freq[r.admissionFeePaid] || 0) + 1;
    const sorted = Object.entries(freq)
        .map(([v, c]) => [Number(v), c])
        .sort((a, b) => b[1] - a[1]);

    console.log('\nTop 25 most common admissionFeePaid values:');
    for (const [v, c] of sorted.slice(0, 25)) {
        const pad = String(v).padStart(8);
        console.log(`   ${pad}  →  ${c} students`);
    }

    // Bucketing
    let net1500 = 0, net2500 = 0, vat1575 = 0, vat2625 = 0;
    let endsIn75or25_below3000 = 0;
    let roundHundred = 0;
    const messy = new Map();
    for (const r of rows) {
        const v = r.admissionFeePaid;
        if (v === 1500) net1500++;
        else if (v === 2500) net2500++;
        else if (v === 1575) vat1575++;
        else if (v === 2625) vat2625++;
        else {
            messy.set(v, (messy.get(v) || 0) + 1);
        }
        if (v % 100 === 0) roundHundred++;
        if (v < 3000 && (v % 100 === 75 || v % 100 === 25)) endsIn75or25_below3000++;
    }
    console.log('\n=== Buckets ===');
    console.log('  1500 (net):            ', net1500);
    console.log('  2500 (net):            ', net2500);
    console.log('  1575 (1500 + 5% VAT):  ', vat1575);
    console.log('  2625 (2500 + 5% VAT):  ', vat2625);
    console.log('  Other (non-canonical): ', [...messy.values()].reduce((a, b) => a + b, 0));
    console.log('  Any round hundred:     ', roundHundred);
    console.log('  Ends in 25/75 (<3000): ', endsIn75or25_below3000);

    // Top 15 messy values
    console.log('\nTop 15 "other" values:');
    [...messy.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([v, c]) => console.log(`   ${String(v).padStart(8)}  →  ${c} students`));

    // How many look like round * 1.05? (5% VAT added on top)
    let vatLikely = 0;
    const vatExamples = [];
    for (const r of rows) {
        const v = r.admissionFeePaid;
        const net = v / 1.05;
        const rounded = Math.round(net);
        if (
            Math.abs(net - rounded) < 0.01 &&
            rounded % 50 === 0 &&
            v !== rounded
        ) {
            vatLikely++;
            if (vatExamples.length < 10) vatExamples.push([v, rounded]);
        }
    }
    console.log('\n5% VAT-on-top matches (v = round(50s) * 1.05):', vatLikely);
    console.log('  Examples (gross → net):', vatExamples);

    // Who entered the "odd" ones? admin vs team leads
    const oddBy = new Map();
    for (const r of rows) {
        const v = r.admissionFeePaid;
        if (v === 1500 || v === 2500) continue;
        const key = r.createdBy ? String(r.createdBy) : 'null';
        oddBy.set(key, (oddBy.get(key) || 0) + 1);
    }
    console.log('\n"Non-canonical value" count grouped by createdBy:');
    for (const [k, c] of [...oddBy.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`   ${k}  →  ${c}`);
    }

    await mongoose.connection.close();
    process.exit(0);
})();
