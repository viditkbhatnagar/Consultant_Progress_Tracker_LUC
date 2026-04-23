// Safety dump before we start hiding LUC students whose admissionFeePaid
// is 0 (or unset). Writes every matching row as-is to a JSON file under
// server/dumps/, timestamped. Nothing is deleted or mutated.
//
//   node scripts/dumpZeroAdmissionFeeLuc.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

(async () => {
    await connectDB();

    const rows = await Student.find({
        organization: 'luc',
        $or: [
            { admissionFeePaid: 0 },
            { admissionFeePaid: null },
            { admissionFeePaid: { $exists: false } },
        ],
    })
        .lean()
        .sort('studentName');

    const dumpDir = path.join(__dirname, '..', 'dumps');
    if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

    const stamp = new Date()
        .toISOString()
        .replace(/[T:.-]/g, '')
        .slice(0, 14);
    const outPath = path.join(dumpDir, `luc_zero_admission_fee_${stamp}.json`);
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');

    console.log(`✔ Dumped ${rows.length} LUC student(s) to:`);
    console.log(`  ${outPath}`);
    console.log(`  (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);

    await mongoose.connection.close();
    process.exit(0);
})();
