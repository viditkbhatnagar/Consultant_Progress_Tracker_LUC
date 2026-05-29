const TeamMonthlyEntry = require('../models/TeamMonthlyEntry');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const { ALL_SLUGS, BUCKET_SLUGS } = require('../services/execOverview/bucketing');
const { emitTeamEntry } = require('../services/realtime');
const { announceTeamAdmission } = require('../services/announcer');

const EDITABLE_NUM_FIELDS = ['monthlyTarget', 'achievedRevenue', ...ALL_SLUGS];

// slug -> display name (BUCKET_SLUGS maps name -> slug), for announcement text.
const SLUG_TO_NAME = Object.fromEntries(
    Object.entries(BUCKET_SLUGS).map(([name, slug]) => [slug, name])
);
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const VALID_MONTH = (m) => Number.isInteger(m) && m >= 1 && m <= 12;
const VALID_YEAR = (y) => Number.isInteger(y) && y >= 2020 && y <= 2100;

// Build the read filter. Team leads see only their own team's rows;
// admins see all LUC rows (optionally narrowed by ?teamLeadId).
function readScope(req) {
    const filter = { organization: 'luc' };
    if (req.user.role === 'team_lead') filter.teamLead = req.user._id;
    return filter;
}

// Ensure the requester is allowed to write a row for this consultant.
// Admin: always allowed. Team lead: only their own consultants.
async function assertWriteAccess(req, consultantId) {
    if (req.user.role === 'admin') return { ok: true };
    const c = await Consultant.findById(consultantId).lean();
    if (!c) return { ok: false, message: 'Consultant not found' };
    if (String(c.teamLead) !== String(req.user._id)) {
        return { ok: false, message: 'Cannot edit a consultant outside your team' };
    }
    return { ok: true, consultant: c };
}

// Coerce + whitelist payload fields. Only the editable numeric fields
// and `notes` flow through to the DB; everything else (organization,
// teamLead etc.) is set server-side.
function pickEditableFields(body) {
    const out = {};
    for (const f of EDITABLE_NUM_FIELDS) {
        if (body[f] != null) {
            const n = Number(body[f]);
            if (Number.isFinite(n) && n >= 0) out[f] = n;
        }
    }
    if (typeof body.notes === 'string') out.notes = body.notes.trim();
    return out;
}

// @desc    List team entries for a year, optionally narrowed by team.
// @route   GET /api/team-entries?year=2025[&teamLeadId=...]
// @access  Private (admin, team_lead)
exports.listEntries = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        const filter = { ...readScope(req), year };
        if (req.query.teamLeadId && req.user.role === 'admin') {
            filter.teamLead = req.query.teamLeadId;
        }
        const entries = await TeamMonthlyEntry.find(filter).lean();
        res.status(200).json({ success: true, data: entries });
    } catch (err) {
        next(err);
    }
};

// @desc    Upsert ONE row (one consultant × month). Partial updates
//          supported — pass only the fields you changed.
// @route   PUT /api/team-entries
// @access  Private (admin, team_lead — own consultants only)
exports.upsertEntry = async (req, res, next) => {
    try {
        const { consultant, teamLead, year, month } = req.body;
        if (!consultant) return res.status(400).json({ success: false, message: 'consultant is required' });
        if (!teamLead) return res.status(400).json({ success: false, message: 'teamLead is required' });
        const m = Number(month);
        const y = Number(year);
        if (!VALID_MONTH(m)) return res.status(400).json({ success: false, message: 'month must be 1..12' });
        if (!VALID_YEAR(y)) return res.status(400).json({ success: false, message: 'year must be 2020..2100' });

        const access = await assertWriteAccess(req, consultant);
        if (!access.ok) return res.status(403).json({ success: false, message: access.message });

        const consultantDoc = access.consultant || (await Consultant.findById(consultant).lean());
        if (!consultantDoc) return res.status(404).json({ success: false, message: 'Consultant not found' });
        const tlDoc = await User.findById(teamLead).lean();
        if (!tlDoc || tlDoc.organization !== 'luc') {
            return res.status(400).json({ success: false, message: 'Team lead must be a LUC user' });
        }

        const changes = pickEditableFields(req.body);
        // consultantName is set in $set (applies on both insert and update),
        // so it must NOT also appear in $setOnInsert — Mongoose rejects the
        // same path in both operators ("would create a conflict").
        const setOnInsert = {
            organization: 'luc',
            consultant,
            teamLead,
            year: y,
            month: m,
            createdBy: req.user._id,
        };
        // Snapshot the prior course counts so we announce only *new* admissions
        // (an increase), never a re-save of the same value or a target edit.
        const prev = await TeamMonthlyEntry.findOne({ consultant, year: y, month: m }).lean();

        const doc = await TeamMonthlyEntry.findOneAndUpdate(
            { consultant, year: y, month: m },
            {
                $set: { ...changes, consultantName: consultantDoc.name, lastUpdatedBy: req.user._id },
                $setOnInsert: setOnInsert,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        emitTeamEntry('luc', 'upserted', { consultant, teamLead, year: y, month: m });

        // Org-wide "new admission" announcement when this admin edit increased a
        // course/program count. Best-effort — never block the save.
        try {
            const courses = [];
            for (const slug of ALL_SLUGS) {
                const before = prev ? Number(prev[slug] || 0) : 0;
                const after = Number(doc[slug] || 0);
                if (after > before) courses.push({ name: SLUG_TO_NAME[slug] || slug, delta: after - before });
            }
            if (courses.length) {
                await announceTeamAdmission({
                    organization: 'luc',
                    teamName: tlDoc.teamName || `Team ${tlDoc.name}`,
                    consultantName: consultantDoc.name,
                    monthName: MONTH_NAMES[m - 1],
                    year: y,
                    courses,
                    actorName: req.user.name,
                });
            }
        } catch (announceErr) {
            console.error('[announcer] team-admission announcement failed (non-fatal):', announceErr.message);
        }

        res.status(200).json({ success: true, data: doc });
    } catch (err) {
        // Duplicate-key race (two parallel upserts) — retry once.
        if (err.code === 11000) {
            try {
                const { consultant, year, month } = req.body;
                const doc = await TeamMonthlyEntry.findOne({
                    consultant,
                    year: Number(year),
                    month: Number(month),
                }).lean();
                emitTeamEntry('luc', 'upserted', {
                    consultant, teamLead: req.body.teamLead, year: Number(year), month: Number(month),
                });
                return res.status(200).json({ success: true, data: doc });
            } catch (inner) {
                return next(inner);
            }
        }
        next(err);
    }
};

// @desc    Bulk upsert (paste-from-Excel). Each row must contain the
//          identity fields + at least one editable field. Errors are
//          returned per-index so the UI can highlight bad cells.
// @route   POST /api/team-entries/bulk
// @access  Private (admin, team_lead — own consultants only)
exports.bulkUpsert = async (req, res, next) => {
    try {
        const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'rows must be a non-empty array' });
        }
        if (rows.length > 5000) {
            return res.status(400).json({ success: false, message: 'Max 5000 rows per bulk upsert' });
        }

        const results = { upserted: 0, errors: [] };
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const m = Number(row.month);
            const y = Number(row.year);
            if (!row.consultant || !row.teamLead || !VALID_MONTH(m) || !VALID_YEAR(y)) {
                results.errors.push({ index: i, message: 'Missing identity fields' });
                continue;
            }
            const access = await assertWriteAccess(req, row.consultant);
            if (!access.ok) {
                results.errors.push({ index: i, message: access.message });
                continue;
            }
            const consultantDoc = access.consultant || (await Consultant.findById(row.consultant).lean());
            if (!consultantDoc) {
                results.errors.push({ index: i, message: 'Consultant not found' });
                continue;
            }
            const changes = pickEditableFields(row);
            try {
                await TeamMonthlyEntry.findOneAndUpdate(
                    { consultant: row.consultant, year: y, month: m },
                    {
                        // consultantName lives only in $set (see upsertEntry note).
                        $set: { ...changes, consultantName: consultantDoc.name, lastUpdatedBy: req.user._id },
                        $setOnInsert: {
                            organization: 'luc',
                            consultant: row.consultant,
                            teamLead: row.teamLead,
                            year: y,
                            month: m,
                            createdBy: req.user._id,
                        },
                    },
                    { upsert: true, new: false, setDefaultsOnInsert: true }
                );
                results.upserted += 1;
            } catch (e) {
                results.errors.push({ index: i, message: e.message });
            }
        }

        // One coalesced event for the whole bulk so clients refetch once.
        if (results.upserted > 0) {
            const year = Number(rows[0].year);
            emitTeamEntry('luc', 'bulk', { year, upserted: results.upserted });
        }
        res.status(200).json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete one entry (admin only).
// @route   DELETE /api/team-entries/:id
// @access  Private (admin)
exports.deleteEntry = async (req, res, next) => {
    try {
        const doc = await TeamMonthlyEntry.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Entry not found' });
        emitTeamEntry('luc', 'deleted', { id: req.params.id, year: doc.year });
        res.status(200).json({ success: true });
    } catch (err) {
        next(err);
    }
};

// Re-export bucket meta so the client can ask the server for the
// canonical column order without hard-coding it.
exports.getBucketMeta = (req, res) => {
    const { PROGRAM_BUCKETS, AGI_BUCKETS } = require('../services/execOverview/bucketing');
    res.status(200).json({
        success: true,
        data: {
            programBuckets: PROGRAM_BUCKETS,
            agiBuckets: AGI_BUCKETS,
            bucketSlugs: BUCKET_SLUGS,
        },
    });
};
