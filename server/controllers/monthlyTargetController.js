const MonthlyTarget = require('../models/MonthlyTarget');
const Consultant = require('../models/Consultant');
const User = require('../models/User');

const VALID_MONTH = (m) => Number.isInteger(m) && m >= 1 && m <= 12;
const VALID_YEAR = (y) => Number.isInteger(y) && y >= 2020 && y <= 2100;

// Scope helper — admin sees all LUC targets; team_lead sees only their
// own team's targets (anyone else is rejected by the route role gate).
function targetScope(req) {
    const filter = { organization: 'luc' };
    if (req.user.role === 'team_lead') filter.teamLead = req.user._id;
    return filter;
}

// @desc    List monthly targets for a year, optionally narrowed by team.
// @route   GET /api/monthly-targets?year=2025&teamLeadId=...
// @access  Private (admin, team_lead)
exports.listTargets = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
        const filter = { ...targetScope(req), year };
        if (req.query.teamLeadId && req.user.role === 'admin') {
            filter.teamLead = req.query.teamLeadId;
        }
        const targets = await MonthlyTarget.find(filter)
            .select('consultant consultantName teamLead year month targetAmount notes')
            .lean();
        res.status(200).json({ success: true, data: targets });
    } catch (error) {
        next(error);
    }
};

// Shared validation + denormalization for upsert payloads.
async function normalizeRow(row, req) {
    const month = Number(row.month);
    const year = Number(row.year);
    if (!VALID_MONTH(month)) return { ok: false, message: 'month must be 1..12' };
    if (!VALID_YEAR(year)) return { ok: false, message: 'year must be 2020..2100' };
    if (!row.consultant) return { ok: false, message: 'consultant is required' };
    if (!row.teamLead) return { ok: false, message: 'teamLead is required' };

    const consultant = await Consultant.findById(row.consultant).lean();
    if (!consultant) return { ok: false, message: 'Consultant not found' };

    // Team leads can only set targets for consultants under them.
    if (
        req.user.role === 'team_lead' &&
        String(consultant.teamLead) !== String(req.user._id)
    ) {
        return { ok: false, message: 'Cannot set target for a consultant outside your team' };
    }

    const teamLead = await User.findById(row.teamLead).lean();
    if (!teamLead) return { ok: false, message: 'Team lead not found' };
    if (teamLead.organization !== 'luc') {
        return { ok: false, message: 'Monthly targets are LUC-only' };
    }

    return {
        ok: true,
        doc: {
            organization: 'luc',
            consultant: row.consultant,
            consultantName: consultant.name,
            teamLead: row.teamLead,
            year,
            month,
            targetAmount: Math.max(0, Number(row.targetAmount) || 0),
            notes: row.notes || '',
            lastUpdatedBy: req.user._id,
        },
    };
}

// @desc    Bulk upsert monthly targets (supports paste-from-Excel).
// @route   POST /api/monthly-targets/bulk
// @access  Private (admin always; team_lead for own consultants)
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
            const normalized = await normalizeRow(rows[i], req);
            if (!normalized.ok) {
                results.errors.push({ index: i, message: normalized.message });
                continue;
            }
            await MonthlyTarget.findOneAndUpdate(
                {
                    consultant: normalized.doc.consultant,
                    year: normalized.doc.year,
                    month: normalized.doc.month,
                },
                { $set: normalized.doc, $setOnInsert: { createdBy: req.user._id } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            results.upserted += 1;
        }

        res.status(200).json({ success: true, data: results });
    } catch (error) {
        next(error);
    }
};

// @desc    Single upsert (used by the in-cell editor).
// @route   PUT /api/monthly-targets
// @access  Private (admin, team_lead — own team only)
exports.upsertOne = async (req, res, next) => {
    try {
        const normalized = await normalizeRow(req.body, req);
        if (!normalized.ok) {
            return res.status(400).json({ success: false, message: normalized.message });
        }
        const doc = await MonthlyTarget.findOneAndUpdate(
            {
                consultant: normalized.doc.consultant,
                year: normalized.doc.year,
                month: normalized.doc.month,
            },
            { $set: normalized.doc, $setOnInsert: { createdBy: req.user._id } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        res.status(200).json({ success: true, data: doc });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete one target (admin only).
// @route   DELETE /api/monthly-targets/:id
// @access  Private (admin)
exports.deleteOne = async (req, res, next) => {
    try {
        const doc = await MonthlyTarget.findByIdAndDelete(req.params.id);
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Target not found' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};
