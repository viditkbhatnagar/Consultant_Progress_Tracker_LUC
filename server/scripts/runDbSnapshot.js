// Manual full-DB snapshot to S3 (same routine the nightly cron runs).
//   cd server && node scripts/runDbSnapshot.js
require('dotenv').config();
const mongoose = require('mongoose');
const { runDbSnapshot } = require('../services/dbSnapshot');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const manifest = await runDbSnapshot();
    if (manifest.collections) {
        for (const c of manifest.collections) {
            console.log(`  ${c.name.padEnd(22)} ${String(c.count).padStart(6)} docs  ${(c.bytes / 1024).toFixed(1)}KB`);
        }
    }
    await mongoose.disconnect();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
