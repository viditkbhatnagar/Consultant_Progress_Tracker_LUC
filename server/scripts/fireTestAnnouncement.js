/**
 * Fire (or clear) a TEST announcement to verify the announcement banner.
 *
 *   node scripts/fireTestAnnouncement.js           # create a test announcement
 *   node scripts/fireTestAnnouncement.js --clear    # delete all test announcements
 *
 * NOTE: this writes the Announcement DB record, so the banner shows on page
 * load / refresh for every LUC user (admin, any team lead, manager). The live
 * Socket.IO *toast* only fires from the running server process (a real
 * admission via createStudent) — a standalone script can't reach the server's
 * live socket instance. Auto-expires in 2h as a safety net; --clear removes it.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
    await mongoose.connect(process.env.MONGODB_URI);

    if (process.argv.includes('--clear')) {
        const res = await Announcement.deleteMany({ 'meta.test': true });
        console.log(`Cleared ${res.deletedCount} test announcement(s).`);
    } else {
        const customMessage = process.argv.slice(2).find((a) => !a.startsWith('--'));
        const ann = await Announcement.create({
            organization: 'luc',
            type: 'manual',
            priority: 'high',
            title: '🎉 Test Announcement',
            message: customMessage || 'If you can see this banner, the announcement feature works. Click "Got it" to dismiss.',
            meta: { test: true },
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // auto-clears in 2 hours
        });
        console.log('Created test announcement:', String(ann._id));
        console.log('Log in as any LUC user (admin or any team lead) and refresh — the banner appears at the top.');
    }

    await mongoose.disconnect();
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
