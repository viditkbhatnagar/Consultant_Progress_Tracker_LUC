// One-off — profile Skillhub admissionFeePaid + registrationFee value
// distributions so we can pick realistic quick-pick chip values for the
// Skillhub Student form. Read-only.
//
//   node scripts/profileSkillhubFees.js

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');

(async () => {
    await connectDB();
    for (const field of ['admissionFeePaid', 'registrationFee']) {
        console.log(`\n=== Skillhub ${field} (> 0) ===`);
        const rows = await Student.find({
            organization: { $in: ['skillhub_training', 'skillhub_institute'] },
            [field]: { $gt: 0 },
        })
            .select(`${field} organization`)
            .lean();
        console.log('Rows with > 0:', rows.length);

        const freq = {};
        for (const r of rows) {
            const v = r[field];
            freq[v] = (freq[v] || 0) + 1;
        }
        const sorted = Object.entries(freq)
            .map(([v, c]) => [Number(v), c])
            .sort((a, b) => b[1] - a[1]);

        console.log('Top 15 values:');
        for (const [v, c] of sorted.slice(0, 15)) {
            console.log(`   ${String(v).padStart(8)}  →  ${c}`);
        }

        const roundOnly = sorted.filter(([v]) => v % 100 === 0);
        console.log('\nTop 10 round-100 values only:');
        for (const [v, c] of roundOnly.slice(0, 10)) {
            console.log(`   ${String(v).padStart(8)}  →  ${c}`);
        }

        // Split by branch so we know if Training vs Institute differ.
        const byOrg = { skillhub_training: {}, skillhub_institute: {} };
        for (const r of rows) {
            const m = byOrg[r.organization] || (byOrg[r.organization] = {});
            m[r[field]] = (m[r[field]] || 0) + 1;
        }
        for (const [org, m] of Object.entries(byOrg)) {
            const ordered = Object.entries(m)
                .map(([v, c]) => [Number(v), c])
                .filter(([v]) => v % 100 === 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6);
            if (ordered.length === 0) continue;
            console.log(`\n  ${org} — top round-100:`);
            for (const [v, c] of ordered) {
                console.log(`     ${String(v).padStart(8)}  →  ${c}`);
            }
        }
    }

    await mongoose.connection.close();
    process.exit(0);
})();
