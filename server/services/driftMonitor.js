const Commitment = require('../models/Commitment');
const Notification = require('../models/Notification');
const User = require('../models/User');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// Check whether any LUC closed commitments older than 7 days are still
// missing a linked Student record. If so, drop a notification on every
// active admin's bell. Idempotent on a per-admin per-day basis — won't
// duplicate if it runs more than once in 24h.
async function runDriftCheck() {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const orphanCount = await Commitment.countDocuments({
        organization: 'luc',
        admissionClosed: true,
        admissionClosedDate: { $lte: sevenDaysAgo },
        $or: [{ studentId: null }, { studentId: { $exists: false } }],
    });

    if (orphanCount === 0) return { orphanCount, notified: 0 };

    const admins = await User.find({ role: 'admin', isActive: { $ne: false } })
        .select('_id name')
        .lean();
    if (admins.length === 0) return { orphanCount, notified: 0 };

    const since = new Date(Date.now() - ONE_DAY_MS);
    let notified = 0;
    const title = 'Drift check — closed commitments without student';
    const message =
        `${orphanCount} LUC closed commitment${orphanCount === 1 ? '' : 's'} older than 7 days ` +
        'still have no linked Student record. Open the Reconciliation page to pair them.';

    for (const admin of admins) {
        const recent = await Notification.findOne({
            user: admin._id,
            type: 'team_update',
            title,
            createdAt: { $gte: since },
        }).lean();
        if (recent) continue;

        await Notification.create({
            user: admin._id,
            type: 'team_update',
            title,
            message,
            priority: orphanCount >= 10 ? 'high' : 'medium',
        });
        notified++;
    }
    return { orphanCount, notified };
}

// Kick off the daily drift check. Runs once on boot (delayed so the
// initial Mongo connect can land), then every 24h. Safe to call once
// per process — the returned interval handle is held only for tests.
function startDriftMonitor({ intervalMs = ONE_DAY_MS, bootDelayMs = 30_000 } = {}) {
    const tick = async () => {
        try {
            const r = await runDriftCheck();
            if (r.orphanCount > 0) {
                console.log(
                    `[drift-monitor] orphans=${r.orphanCount} notified=${r.notified}`
                );
            }
        } catch (err) {
            console.error('[drift-monitor] check failed:', err.message);
        }
    };
    setTimeout(tick, bootDelayMs);
    return setInterval(tick, intervalMs);
}

module.exports = { runDriftCheck, startDriftMonitor };
