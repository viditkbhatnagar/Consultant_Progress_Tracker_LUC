/**
 * Idempotent: round Skillhub student money fields to whole AED so totals never
 * differ by the ±1-2 AED rounding of fractional (half-AED) amounts. Touches
 * courseFee, registrationFee, admissionFeePaid and each emi's amount/paidAmount
 * for skillhub_training + skillhub_institute only. LUC is left untouched (its
 * admission-fee amounts carry the intentional net/gross-VAT convention).
 *
 * Safe to run multiple times — only rows with a fractional value change.
 *
 * Usage:  cd server && node scripts/roundSkillhubWholeAed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const R = (n) => Math.round(Number(n) || 0);
const isFrac = (n) => n != null && Math.round(Number(n)) !== Number(n);

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set. Aborting.');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const coll = mongoose.connection.db.collection('students');
    const q = { organization: { $in: ['skillhub_training', 'skillhub_institute'] } };
    const rows = await coll.find(q).toArray();

    let changed = 0;
    for (const s of rows) {
        const set = {};
        for (const f of ['courseFee', 'registrationFee', 'admissionFeePaid']) {
            if (isFrac(s[f])) set[f] = R(s[f]);
        }
        if (Array.isArray(s.emis) && s.emis.some((e) => isFrac(e.amount) || isFrac(e.paidAmount))) {
            set.emis = s.emis.map((e) => ({ ...e, amount: R(e.amount), paidAmount: R(e.paidAmount) }));
        }
        if (Object.keys(set).length) {
            await coll.updateOne({ _id: s._id }, { $set: set });
            changed++;
        }
    }
    console.log(`Rounded ${changed} Skillhub student(s) to whole AED (of ${rows.length}).`);

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
