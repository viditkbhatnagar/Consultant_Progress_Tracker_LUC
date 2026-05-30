const OpenAI = require('openai');
const Tier = require('../models/Tier');
const TierImage = require('../models/TierImage');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');
const { emitToOrg } = require('../services/realtime');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Varied cartoon scene themes. The AI draws NO text — the exact tier labels and
// amounts are overlaid as real text on the client, so they're always correct.
const THEMES = [
    'a high-energy cartoon go-kart race with three teams of cheering racers speeding toward a finish line, confetti everywhere, dynamic motion lines',
    'a cartoon mountain-climbing race, three roped teams scrambling up a snowy peak toward a summit flag, bright blue sky',
    'three cartoon rocket ships blasting off in a friendly space race toward a glowing planet, stars and fiery trails',
    'a cartoon city marathon, three teams of runners sprinting down a sunny street toward a finish banner, motion and energy',
    'a cartoon sailing regatta, three colourful sailboats racing across sparkling turquoise water toward a buoy',
    'a cartoon stadium relay race, three teams sprinting and passing batons under bright stadium lights, a cheering crowd',
    'a cartoon bicycle race, three teams of cyclists pedalling hard down a scenic road toward a checkered finish',
];

function buildPrompt(theme) {
    return `${theme}. Vibrant, bold comic-book / cartoon style, highly energetic and motivational, lots of dynamic action, speed and confetti. Three clearly distinct competing groups. Leave a clean, uncluttered horizontal band across the BOTTOM third of the image suitable for a scoreboard. IMPORTANT: do NOT render any text, letters, numbers, words, captions or logos anywhere in the image — imagery only.`;
}

async function generateScene() {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const result = await client.images.generate({
        model: 'dall-e-3',
        prompt: buildPrompt(theme),
        size: '1792x1024',
        quality: 'standard',
        response_format: 'b64_json',
        n: 1,
    });
    const b64 = result.data[0].b64_json;
    return { theme, dataUrl: `data:image/png;base64,${b64}` };
}

// Current MTD month = latest month with achieved revenue (mirrors the dashboard).
async function currentMonth(year) {
    const latest = await TeamMonthlyEntry.find({ organization: 'luc', year, achievedRevenue: { $gt: 0 } })
        .sort({ month: -1 })
        .limit(1)
        .lean();
    if (latest.length) return latest[0].month;
    const now = new Date();
    return now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : 12;
}

// Tiers with live per-member + per-tier MTD achieved.
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

// @desc    Tier config + live MTD totals.  @route GET /api/tiers
exports.getTiers = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        res.json({ success: true, data: await buildTiers(year) });
    } catch (err) {
        next(err);
    }
};

// @desc    Generate a tier-standings image (admin).  @route POST /api/tiers/generate-image
exports.generateImage = async (req, res, next) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ success: false, message: 'OPENAI_API_KEY not configured' });
        }
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        const { month, tiers } = await buildTiers(year);
        const snapshot = tiers.map((t) => ({ tier: t.tier, label: t.label || `Tier ${t.tier}`, mtdAchieved: t.mtdAchieved }));

        const { theme, dataUrl } = await generateScene();
        const doc = await TierImage.create({
            organization: 'luc',
            image: dataUrl,
            theme,
            headline: 'Month-End Race Is On!',
            month,
            year,
            tiers: snapshot,
            generatedBy: req.user._id || req.user.id,
        });

        // Light socket ping — clients fetch /latest-image (the image is large).
        emitToOrg('luc', 'tier-image', { _id: doc._id, month, year, monthName: MONTH_NAMES[month - 1] });

        res.json({
            success: true,
            data: { _id: doc._id, image: dataUrl, theme, headline: doc.headline, month, monthName: MONTH_NAMES[month - 1], year, tiers: snapshot, createdAt: doc.createdAt },
        });
    } catch (err) {
        console.error('[tiers] generateImage failed:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Image generation failed' });
    }
};

// @desc    Latest generated tier image (for TL tab + dashboard banner).  @route GET /api/tiers/latest-image
exports.getLatestImage = async (req, res, next) => {
    try {
        const img = await TierImage.findOne({ organization: 'luc' }).sort({ createdAt: -1 }).lean();
        if (img && img.month) img.monthName = MONTH_NAMES[img.month - 1];
        res.json({ success: true, data: img || null });
    } catch (err) {
        next(err);
    }
};

// @desc    Replace a tier's member list (admin).  @route PUT /api/tiers/:tier
exports.updateTier = async (req, res, next) => {
    try {
        const tierNum = Number(req.params.tier);
        if (![1, 2, 3].includes(tierNum)) {
            return res.status(400).json({ success: false, message: 'tier must be 1, 2 or 3' });
        }
        const members = Array.isArray(req.body.members) ? req.body.members : [];
        await Tier.updateOne(
            { organization: 'luc', tier: tierNum },
            { $set: { members }, $setOnInsert: { organization: 'luc', tier: tierNum, label: `Tier ${tierNum}` } },
            { upsert: true }
        );
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        res.json({ success: true, data: await buildTiers(year) });
    } catch (err) {
        next(err);
    }
};

exports.buildTiers = buildTiers;
