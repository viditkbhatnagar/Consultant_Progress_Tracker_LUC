const User = require('../models/User');
const {
    getTeamDetail,
    getExecutiveOverview,
    getConsultantPerformance,
} = require('../services/execOverview/aggregate');

// Parse the requested year; default to the current calendar year.
function parseYear(req) {
    const raw = parseInt(req.query.year, 10);
    if (Number.isFinite(raw) && raw >= 2020 && raw <= 2100) return raw;
    return new Date().getUTCFullYear();
}

// Optional month (1-12) for the Leadership Dashboard month picker. null means
// "use the latest-active month" (default behaviour).
function parseMonth(req) {
    const raw = parseInt(req.query.month, 10);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 12) return raw;
    return null;
}

// @desc    Executive Overview rollup (KPI + MTD/YTD team tables + consultant
//          snapshot + program × month matrix). LUC-only.
// @route   GET /api/exec-overview
// @access  Private (admin, team_lead) — both see the full org-wide view
exports.getOverview = async (req, res, next) => {
    try {
        const year = parseYear(req);
        const month = parseMonth(req);
        const data = await getExecutiveOverview({ year, month });
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

// @desc    Consultant Performance — Category A/B rankings + top-5 highlights.
// @route   GET /api/exec-overview/consultant-performance
// @access  Private (admin, team_lead)
exports.getConsultantPerformanceRankings = async (req, res, next) => {
    try {
        const year = parseYear(req);
        const data = await getConsultantPerformance({ year });
        res.status(200).json({ success: true, data });
    } catch (error) {
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
        // "Team X" entries sort alphabetically first; prefix-less / departed
        // teams (e.g. Aishwarya) sort last — so teams[0] (the "All Teams"
        // default landing) is always a real active team, never Aishwarya.
        teams.sort((a, b) => {
            const la = a.teamName || a.name;
            const lb = b.teamName || b.name;
            const aPrefixless = la.startsWith('Team ') ? 0 : 1;
            const bPrefixless = lb.startsWith('Team ') ? 0 : 1;
            return aPrefixless - bPrefixless || la.localeCompare(lb);
        });
        res.status(200).json({ success: true, data: teams });
    } catch (error) {
        next(error);
    }
};
