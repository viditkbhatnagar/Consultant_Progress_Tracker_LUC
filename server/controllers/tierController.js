const Tier = require('../models/Tier');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');

// Current MTD month = latest month with achieved revenue (mirrors the
// Leadership Dashboard's effective-current-month so the tier totals line up).
async function currentMonth(year) {
    const latest = await TeamMonthlyEntry.find({ organization: 'luc', year, achievedRevenue: { $gt: 0 } })
        .sort({ month: -1 })
        .limit(1)
        .lean();
    if (latest.length) return latest[0].month;
    const now = new Date();
    return now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : 12;
}

// Build tiers with live per-member + per-tier MTD achieved.
async function buildTiers(year) {
    const month = await currentMonth(year);
    const tiers = await Tier.find({ organization: 'luc' })
        .sort({ tier: 1 })
        .populate('members', 'name teamName isActive')
        .lean();

    for (const t of tiers) {
        const ids = (t.members || []).map((m) => m._id);
        const entries = await TeamMonthlyEntry.find({ consultant: { $in: ids }, year, month }).lean();
        const byConsultant = {};
        for (const e of entries) {
            const k = String(e.consultant);
            byConsultant[k] = (byConsultant[k] || 0) + (e.achievedRevenue || 0);
        }
        t.members = (t.members || []).map((m) => ({
            _id: m._id,
            name: m.name,
            teamName: m.teamName,
            isActive: m.isActive,
            mtdAchieved: byConsultant[String(m._id)] || 0,
        }));
        t.mtdAchieved = t.members.reduce((s, m) => s + m.mtdAchieved, 0);
    }
    return { year, month, tiers };
}

// @desc    Tier config + live MTD totals.
// @route   GET /api/tiers
// @access  Private (admin, team_lead) — LUC only
exports.getTiers = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        const data = await buildTiers(year);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
};

exports.buildTiers = buildTiers;
