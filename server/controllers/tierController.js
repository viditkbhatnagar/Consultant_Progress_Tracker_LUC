const OpenAI = require('openai');
const Tier = require('../models/Tier');
const TierImage = require('../models/TierImage');
const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');
const AIUsage = require('../models/AIUsage');
const s3 = require('../services/s3');
const { emitToOrg } = require('../services/realtime');
const { announceTierImage } = require('../services/announcer');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// One scene theme PER DAY (cycles daily) — go-karts one day, mountain climb
// the next, and so on. gpt-image-2 renders the title, amounts, taglines and
// slogans crisply, so everything is baked into the image (no client overlay).
const THEMES = [
    { key: 'gokart', scene: 'three teams racing colourful go-karts at top speed down a racetrack toward a checkered finish line, tyre smoke and speed lines' },
    { key: 'mountain', scene: 'three teams of climbers scaling a tall snowy mountain toward a summit flag, ropes, ice axes and pure grit' },
    { key: 'rowing', scene: 'three teams rowing colourful racing boats down a river toward a finish buoy, splashing water and synchronised oars' },
    { key: 'relay', scene: 'three teams sprinting a stadium relay race, passing batons toward a finish banner under bright lights and a roaring crowd' },
    { key: 'cycling', scene: 'three teams cycling hard up a scenic mountain road toward a checkered finish at the very top, jerseys flapping' },
    { key: 'airrace', scene: 'three teams flying small colourful stunt planes in an air race through the clouds toward a glowing finish ring, vapour trails' },
    { key: 'sailing', scene: 'three teams sailing colourful yachts across sparkling water toward a lighthouse finish, sails full and spray flying' },
    { key: 'dunes', scene: 'three teams of runners in a desert dune marathon racing toward a finish flag at golden sunrise, sand kicking up' },
];

const TIER_TAGLINES = { 1: 'STRONG. FOCUSED. CLOSING THE GAP!', 2: 'IN THE RACE. ON THE MOVE!', 3: 'LEADING TODAY. INSPIRING EVERYDAY!' };
const TIER_COLORS = { 1: 'GREEN', 2: 'BLUE', 3: 'GOLD/YELLOW' };

// gpt-image-2 medium landscape (1536x1024) ≈ $0.041/image — for AI Usage cost tracking.
const IMAGE_COST_USD = 0.041;

function dailyTheme() {
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start) / 86400000);
    return THEMES[dayOfYear % THEMES.length];
}

const grp = (n) => Number(n || 0).toLocaleString('en-US');

function buildPrompt({ tiers, theme }) {
    const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
    const leader = [...tiers].sort((a, b) => (b.mtdAchieved || 0) - (a.mtdAchieved || 0))[0] || { tier: 3 };
    const plaques = sorted
        .map((t) => `a ${TIER_COLORS[t.tier]} scoreboard plaque reading "TIER ${t.tier}" with the big bold number "${grp(t.mtdAchieved)}" and below it the small tagline "${TIER_TAGLINES[t.tier] || ''}"`)
        .join('; then ');
    return `A vibrant, highly detailed comic-book / cartoon style motivational team-competition poster, landscape orientation. At the very top a huge bold 3D yellow-and-white title: "MONTH END RACE IS ON!". Just below it a small banner subtitle: "The finish line is near — every admission counts!". Main scene: ${theme.scene} — three teams of happy cheering cartoon characters, Tier 1 wearing GREEN, Tier 2 wearing BLUE, Tier 3 wearing GOLD/YELLOW, full of speed, confetti and motion. A shiny golden trophy near the top-right with a red flag reading "TIER ${leader.tier} LEADING THE WAY!". Across the bottom third, three large scoreboard plaques side by side: ${plaques}. A dark bottom strip with three motivational slogans "ONE TEAM. ONE GOAL.", "FINISH STRONG. FINISH TOGETHER.", "LET'S MAKE THIS OUR BEST MONTH YET!", and a bright red "LET'S GO!" starburst. Energetic, polished and professional. Render ALL text crisply and EXACTLY as written, with the tier numbers EXACTLY as given.`;
}

async function generateScene(tiers) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const theme = dailyTheme();
    const result = await client.images.generate({
        model: 'gpt-image-2',
        prompt: buildPrompt({ tiers, theme }),
        size: '1536x1024',
        quality: 'medium',
    });
    const item = result.data[0];
    let dataUrl;
    if (item.b64_json) {
        dataUrl = `data:image/png;base64,${item.b64_json}`;
    } else if (item.url) {
        const resp = await fetch(item.url);
        const buf = Buffer.from(await resp.arrayBuffer());
        dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    } else {
        throw new Error('OpenAI returned no image');
    }
    return { theme: theme.key, dataUrl, usage: result.usage };
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

// Per-tier monthly achieved (Jan..current MTD month) for the 3-line trend chart.
async function buildTierTrend(year) {
    const month = await currentMonth(year);
    const months = Array.from({ length: month }, (_, i) => i + 1);
    const tiers = await Tier.find({ organization: 'luc' }).sort({ tier: 1 }).populate('members', '_id').lean();
    const series = [];
    for (const t of tiers) {
        const ids = (t.members || []).map((m) => m._id);
        const entries = ids.length
            ? await TeamMonthlyEntry.find({ consultant: { $in: ids }, year, month: { $lte: month } }).lean()
            : [];
        const byMonth = {};
        for (const e of entries) byMonth[e.month] = (byMonth[e.month] || 0) + (e.achievedRevenue || 0);
        series.push({ tier: t.tier, label: t.label || `Tier ${t.tier}`, data: months.map((m) => byMonth[m] || 0) });
    }
    return { months, series };
}

// @desc    Tier config + live MTD totals + monthly trend.  @route GET /api/tiers
exports.getTiers = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        const [base, trend] = await Promise.all([buildTiers(year), buildTierTrend(year)]);
        res.json({ success: true, data: { ...base, trend } });
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

        const { theme, dataUrl, usage } = await generateScene(snapshot);

        // Archive the PNG to S3 under a date-structured key. Keep the base64
        // inline only as a fallback when S3 is unconfigured / the upload fails,
        // so Mongo stays lean and the history view can presign from the key.
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const buffer = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const s3Key = `tier-images/${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}/${now.getTime()}-${theme}.png`;
        let storedKey = '';
        let inlineFallback = '';
        if (s3.isEnabled()) {
            try {
                await s3.uploadBuffer(s3Key, buffer, 'image/png');
                storedKey = s3Key;
            } catch (e) {
                console.error('[tiers] S3 upload failed, storing inline:', e.message);
                inlineFallback = dataUrl;
            }
        } else {
            inlineFallback = dataUrl;
        }

        const doc = await TierImage.create({
            organization: 'luc',
            image: inlineFallback,
            s3Key: storedKey,
            theme,
            headline: 'Month-End Race Is On!',
            month,
            year,
            tiers: snapshot,
            generatedBy: req.user._id || req.user.id,
        });

        // Track image-generation cost on the AI Usage dashboard. gpt-image-2
        // bills input ($8/1M) + output ($30/1M) tokens; fall back to the flat
        // per-image price if the SDK didn't return a usage block.
        try {
            const promptTokens = usage?.input_tokens || 0;
            const completionTokens = usage?.output_tokens || 0;
            const totalTokens = usage?.total_tokens || promptTokens + completionTokens;
            const cost = totalTokens
                ? (promptTokens / 1e6) * 8 + (completionTokens / 1e6) * 30
                : IMAGE_COST_USD;
            await AIUsage.create({
                user: req.user._id || req.user.id,
                role: req.user.role,
                type: 'image',
                teamName: req.user.teamName || '',
                organization: req.user.organization || 'luc',
                model: 'gpt-image-2',
                promptTokens,
                completionTokens,
                totalTokens,
                cost,
            });
        } catch (logErr) {
            console.error('[tiers] AI usage log failed:', logErr.message);
        }

        // Light socket ping — clients fetch /latest-image (the image is large).
        emitToOrg('luc', 'tier-image', { _id: doc._id, month, year, monthName: MONTH_NAMES[month - 1] });

        // Org-wide dismissable banner so EVERY user (not just the TL modal) is
        // alerted wherever they are in the app. Best-effort — never block the image.
        try {
            await announceTierImage({ organization: 'luc', tiers: snapshot, monthName: MONTH_NAMES[month - 1], year, actorName: req.user.name });
        } catch (annErr) {
            console.error('[tiers] announce failed:', annErr.message);
        }

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
        if (img) {
            if (img.month) img.monthName = MONTH_NAMES[img.month - 1];
            // Serve from S3 via a short-lived presigned URL; fall back to the
            // inline data URL for legacy/no-S3 docs.
            if (img.s3Key) {
                const url = await s3.getSignedGetUrl(img.s3Key, 3600);
                if (url) img.image = url;
            }
        }
        res.json({ success: true, data: img || null });
    } catch (err) {
        next(err);
    }
};

// @desc    Past tier images, newest first (admin + TL).  @route GET /api/tiers/images
exports.getImageHistory = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 60, 200);
        const imgs = await TierImage.find({ organization: 'luc' }).sort({ createdAt: -1 }).limit(limit).lean();
        const out = [];
        for (const img of imgs) {
            let url = img.image || null;
            if (img.s3Key) {
                const signed = await s3.getSignedGetUrl(img.s3Key, 3600);
                if (signed) url = signed;
            }
            out.push({
                _id: img._id,
                url,
                theme: img.theme,
                month: img.month,
                monthName: img.month ? MONTH_NAMES[img.month - 1] : '',
                year: img.year,
                tiers: img.tiers || [],
                createdAt: img.createdAt,
            });
        }
        res.json({ success: true, data: out });
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
