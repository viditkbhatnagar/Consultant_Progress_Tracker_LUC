const User = require('../models/User');
const { getTeamDetail, getExecutiveOverview } = require('../services/execOverview/aggregate');

// Parse the requested year; default to the current calendar year.
function parseYear(req) {
    const raw = parseInt(req.query.year, 10);
    if (Number.isFinite(raw) && raw >= 2020 && raw <= 2100) return raw;
    return new Date().getUTCFullYear();
}

// @desc    Executive Overview rollup (KPI + MTD/YTD team tables + consultant
//          snapshot + program × month matrix). LUC-only.
// @route   GET /api/exec-overview
// @access  Private (admin, team_lead) — both see the full org-wide view
exports.getOverview = async (req, res, next) => {
    try {
        const year = parseYear(req);
        const data = await getExecutiveOverview({ year });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// @desc    Per-team detail mirroring the Excel team sheet structure.
// @route   GET /api/exec-overview/team/:teamLeadId
// @access  Private — admin can request any LUC team; team_lead is locked
//          to their own user id (anything else → 403).
exports.getTeam = async (req, res, next) => {
    try {
        const { teamLeadId } = req.params;
        const year = parseYear(req);

        if (req.user.role === 'team_lead' && String(req.user._id) !== String(teamLeadId)) {
            return res.status(403).json({
                success: false,
                message: 'Team leads can only view their own team detail',
            });
        }

        const data = await getTeamDetail({ teamLeadId, year });
        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

// @desc    List of LUC team leads (id + name + teamName). Used by the
//          admin sidebar dropdown and the team picker on /exec-overview.
// @route   GET /api/exec-overview/teams
// @access  Private (admin, team_lead)
exports.getTeams = async (req, res, next) => {
    try {
        const teams = await User.find({
            role: 'team_lead',
            organization: 'luc',
            isActive: true,
        })
            .select('name teamName')
            .lean();
        teams.sort((a, b) => (a.teamName || a.name).localeCompare(b.teamName || b.name));
        res.status(200).json({ success: true, data: teams });
    } catch (error) {
        next(error);
    }
};
