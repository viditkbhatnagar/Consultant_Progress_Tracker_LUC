// Aggregation logic for the Executive Overview + Team Detail dashboards.
//
// Two public entry points:
//   • getTeamDetail({ teamLeadId, year }) — per-team Excel-mirror payload.
//     One block per calendar month. Each block lists every consultant on
//     the team with their monthly target, achieved revenue, % progress,
//     total admissions, AGI counts, and per-bucket program counts.
//
//   • getExecutiveOverview({ year }) — org-wide rollup for the new tab.
//     KPI strip + MTD/YTD team tables + consultant snapshot + the
//     consolidated Program × Month admissions matrix.
//
// Both queries:
//   • are LUC-only (organization: 'luc')
//   • respect the studentController's applyHideLucZeroFeeFilter (the 626
//     importer-bug rows stay hidden — see project_luc_zero_fee_hidden.md)
//   • exclude AGI students from "totalAdmissions" sums (they're tracked
//     in AGI/AGI Standalone columns separately, matching the Excel)

const Student = require('../../models/Student');
const User = require('../../models/User');
const Consultant = require('../../models/Consultant');
const MonthlyTarget = require('../../models/MonthlyTarget');
const { applyHideLucZeroFeeFilter } = require('../../controllers/studentController');
const {
    PROGRAM_BUCKETS,
    AGI_BUCKETS,
    ALL_BUCKETS,
    isAgiBucket,
    bucketProgram,
} = require('./bucketing');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const ON_TRACK_THRESHOLD = 0.8;

// Status label derived from MTD%. Threshold lives in one place so the UI
// doesn't drift from the backend.
function statusFor(pct) {
    if (pct >= ON_TRACK_THRESHOLD) return 'On Track';
    return 'Behind';
}

// safeDivide for percentages where the denominator can be 0/null/undefined.
function pct(num, den) {
    if (!den || den <= 0) return 0;
    return (num || 0) / den;
}

// Bounds for the calendar year in UTC. We use UTC midnight to match the
// rest of the tracker (see fix/meeting-date-timezone — a99eb36).
function yearBounds(year) {
    return {
        start: new Date(Date.UTC(year, 0, 1)),
        end: new Date(Date.UTC(year + 1, 0, 1)),
    };
}

// Pull every LUC student closed in the year, scoped by (optional) teamLead.
// Returns lean docs with just the fields the aggregators need.
async function loadStudents({ year, teamLeadId }) {
    const { start, end } = yearBounds(year);
    const filter = {
        organization: 'luc',
        closingDate: { $gte: start, $lt: end },
    };
    if (teamLeadId) filter.teamLead = teamLeadId;
    applyHideLucZeroFeeFilter(filter);

    return Student.find(filter)
        .select('consultant consultantName teamLead university program admissionFeePaid closingDate')
        .lean();
}

// Pull MonthlyTarget rows for the year, scoped by (optional) teamLead.
async function loadTargets({ year, teamLeadId }) {
    const filter = { organization: 'luc', year };
    if (teamLeadId) filter.teamLead = teamLeadId;
    return MonthlyTarget.find(filter).lean();
}

// Group key for (consultant id || consultantName fallback). Older Students
// may have a null consultant ref so we fall back to the denormalized name.
function consultantKey(student) {
    if (student.consultant) return String(student.consultant);
    return `name:${(student.consultantName || '').trim().toLowerCase()}`;
}

// Build the per-(consultant, month) accumulator.
function emptyConsultantMonth() {
    const buckets = {};
    for (const b of ALL_BUCKETS) buckets[b] = 0;
    return {
        achievedRevenue: 0,
        totalAdmissions: 0, // excludes AGI buckets
        buckets,
    };
}

// Build per-team payload matching the Excel team sheet structure.
async function getTeamDetail({ teamLeadId, year }) {
    const teamLead = await User.findById(teamLeadId).select('name teamName organization role').lean();
    if (!teamLead) {
        const err = new Error('Team lead not found');
        err.statusCode = 404;
        throw err;
    }
    if (teamLead.organization !== 'luc') {
        const err = new Error('Executive Overview is LUC-only');
        err.statusCode = 403;
        throw err;
    }

    // All consultants under this team lead (active OR inactive — historical
    // data for inactive consultants should still appear).
    const consultants = await Consultant.find({ teamLead: teamLeadId })
        .select('name email isActive')
        .lean();

    const [students, targets] = await Promise.all([
        loadStudents({ year, teamLeadId }),
        loadTargets({ year, teamLeadId }),
    ]);

    // Index: consultantKey -> month (1..12) -> accumulator
    const index = new Map();
    const consultantById = new Map();
    for (const c of consultants) {
        consultantById.set(String(c._id), c);
    }

    // Seed all known consultants for all 12 months so the UI shows zeros
    // for rows with no admissions yet.
    for (const c of consultants) {
        const key = String(c._id);
        const months = {};
        for (let m = 1; m <= 12; m++) months[m] = emptyConsultantMonth();
        index.set(key, { meta: { name: c.name, id: c._id, isActive: c.isActive }, months });
    }

    // Walk students once and accumulate.
    for (const s of students) {
        const key = consultantKey(s);
        if (!index.has(key)) {
            // Historical consultant — show the row labeled with the name
            // we have on the student doc.
            const months = {};
            for (let m = 1; m <= 12; m++) months[m] = emptyConsultantMonth();
            index.set(key, {
                meta: { name: s.consultantName || 'Unknown', id: null, isActive: false },
                months,
            });
        }
        const month = new Date(s.closingDate).getUTCMonth() + 1;
        const slot = index.get(key).months[month];
        const bucket = bucketProgram({ university: s.university, program: s.program });
        if (bucket) {
            slot.buckets[bucket] += 1;
            if (!isAgiBucket(bucket)) slot.totalAdmissions += 1;
        } else {
            // Still count toward total admissions even if bucketing failed —
            // the row exists, the dashboard just can't column-place it.
            slot.totalAdmissions += 1;
        }
        slot.achievedRevenue += s.admissionFeePaid || 0;
    }

    // Targets index: consultantKey -> month -> targetAmount
    const targetIndex = new Map();
    for (const t of targets) {
        const key = String(t.consultant);
        if (!targetIndex.has(key)) targetIndex.set(key, {});
        targetIndex.get(key)[t.month] = t.targetAmount;
    }

    // Shape monthly blocks for the UI.
    const months = [];
    for (let m = 1; m <= 12; m++) {
        const memberRows = [];
        let teamTotal = emptyConsultantMonth();
        let teamTarget = 0;

        for (const [key, entry] of index.entries()) {
            const slot = entry.months[m];
            const target = (targetIndex.get(key) || {})[m] || 0;
            const achieved = slot.achievedRevenue;

            memberRows.push({
                consultantId: entry.meta.id,
                consultantName: entry.meta.name,
                isActive: entry.meta.isActive,
                monthlyTarget: target,
                achievedRevenue: achieved,
                percentRevenue: pct(achieved, target),
                totalAdmissions: slot.totalAdmissions,
                buckets: { ...slot.buckets },
            });

            teamTotal.achievedRevenue += achieved;
            teamTotal.totalAdmissions += slot.totalAdmissions;
            for (const b of ALL_BUCKETS) teamTotal.buckets[b] += slot.buckets[b];
            teamTarget += target;
        }

        months.push({
            month: m,
            monthName: MONTH_NAMES[m - 1],
            members: memberRows.sort((a, b) =>
                a.consultantName.localeCompare(b.consultantName)
            ),
            teamTotal: {
                monthlyTarget: teamTarget,
                achievedRevenue: teamTotal.achievedRevenue,
                percentRevenue: pct(teamTotal.achievedRevenue, teamTarget),
                totalAdmissions: teamTotal.totalAdmissions,
                buckets: teamTotal.buckets,
            },
        });
    }

    // YTD = months 1..currentMonth (only when viewing the current year).
    const now = new Date();
    const currentMonth = now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : 12;
    let ytdTarget = 0;
    let ytdAchieved = 0;
    for (let m = 1; m <= currentMonth; m++) {
        ytdTarget += months[m - 1].teamTotal.monthlyTarget;
        ytdAchieved += months[m - 1].teamTotal.achievedRevenue;
    }

    return {
        year,
        teamLead: {
            id: teamLead._id,
            name: teamLead.name,
            teamName: teamLead.teamName || `Team ${teamLead.name}`,
        },
        buckets: ALL_BUCKETS,
        programBuckets: PROGRAM_BUCKETS,
        agiBuckets: AGI_BUCKETS,
        ytd: {
            target: ytdTarget,
            achieved: ytdAchieved,
            percent: pct(ytdAchieved, ytdTarget),
            remaining: Math.max(0, ytdTarget - ytdAchieved),
        },
        months,
    };
}

// Build the executive aggregate payload.
async function getExecutiveOverview({ year }) {
    const teamLeads = await User.find({
        role: 'team_lead',
        organization: 'luc',
        isActive: true,
    })
        .select('name teamName')
        .lean();

    const consultants = await Consultant.find({ organization: 'luc' })
        .select('name teamLead isActive')
        .lean();
    const consultantById = new Map(consultants.map((c) => [String(c._id), c]));

    const [students, targets] = await Promise.all([
        loadStudents({ year }),
        loadTargets({ year }),
    ]);

    const now = new Date();
    const currentMonth = now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : 12;

    // Per-team accumulators: targets per month, achieved per month.
    const teamIdx = new Map();
    for (const tl of teamLeads) {
        teamIdx.set(String(tl._id), {
            id: tl._id,
            name: tl.name,
            teamName: tl.teamName || `Team ${tl.name}`,
            monthly: Array.from({ length: 13 }, () => ({ target: 0, achieved: 0 })),
        });
    }

    // Per-consultant accumulators (for the Consultant Performance snapshot).
    const consIdx = new Map();
    for (const c of consultants) {
        consIdx.set(String(c._id), {
            id: c._id,
            name: c.name,
            teamLead: c.teamLead,
            monthly: Array.from({ length: 13 }, () => ({ target: 0, achieved: 0 })),
        });
    }

    // Distribute targets.
    for (const t of targets) {
        const cKey = String(t.consultant);
        const tlKey = String(t.teamLead);
        if (consIdx.has(cKey)) consIdx.get(cKey).monthly[t.month].target += t.targetAmount;
        if (teamIdx.has(tlKey)) teamIdx.get(tlKey).monthly[t.month].target += t.targetAmount;
    }

    // Distribute achieved + program buckets.
    const programMatrix = {};
    for (const b of ALL_BUCKETS) programMatrix[b] = Array.from({ length: 13 }, () => 0);

    for (const s of students) {
        const month = new Date(s.closingDate).getUTCMonth() + 1;
        const cKey = s.consultant ? String(s.consultant) : null;
        const tlKey = s.teamLead ? String(s.teamLead) : null;
        const amount = s.admissionFeePaid || 0;
        if (cKey && consIdx.has(cKey)) consIdx.get(cKey).monthly[month].achieved += amount;
        if (tlKey && teamIdx.has(tlKey)) teamIdx.get(tlKey).monthly[month].achieved += amount;

        const bucket = bucketProgram({ university: s.university, program: s.program });
        if (bucket) programMatrix[bucket][month] += 1;
    }

    // MTD / YTD team tables.
    const mtdMonth = currentMonth;
    const teamsMtd = [];
    const teamsYtd = [];
    let totalYtdTarget = 0;
    let totalYtdAchieved = 0;
    let totalMtdTarget = 0;
    let totalMtdAchieved = 0;

    for (const team of teamIdx.values()) {
        let ytdTarget = 0;
        let ytdAchieved = 0;
        for (let m = 1; m <= currentMonth; m++) {
            ytdTarget += team.monthly[m].target;
            ytdAchieved += team.monthly[m].achieved;
        }
        const mtdTarget = team.monthly[mtdMonth].target;
        const mtdAchieved = team.monthly[mtdMonth].achieved;

        teamsMtd.push({
            id: team.id,
            teamName: team.teamName,
            leader: team.name,
            mtdTarget,
            mtdAchieved,
            mtdPercent: pct(mtdAchieved, mtdTarget),
            status: statusFor(pct(mtdAchieved, mtdTarget)),
        });
        teamsYtd.push({
            id: team.id,
            teamName: team.teamName,
            leader: team.name,
            ytdTarget,
            ytdAchieved,
            ytdPercent: pct(ytdAchieved, ytdTarget),
            remaining: Math.max(0, ytdTarget - ytdAchieved),
        });

        totalMtdTarget += mtdTarget;
        totalMtdAchieved += mtdAchieved;
        totalYtdTarget += ytdTarget;
        totalYtdAchieved += ytdAchieved;
    }

    // Consultant Performance snapshot.
    const consultantsSnapshot = [];
    for (const c of consIdx.values()) {
        let ytdTarget = 0;
        let ytdAchieved = 0;
        for (let m = 1; m <= currentMonth; m++) {
            ytdTarget += c.monthly[m].target;
            ytdAchieved += c.monthly[m].achieved;
        }
        const mtdTarget = c.monthly[mtdMonth].target;
        const mtdAchieved = c.monthly[mtdMonth].achieved;
        consultantsSnapshot.push({
            id: c.id,
            name: c.name,
            mtdPercent: pct(mtdAchieved, mtdTarget),
            ytdPercent: pct(ytdAchieved, ytdTarget),
        });
    }

    // Program × Month matrix in the order the Excel uses, with YTD totals
    // and the AGI exclusion rule baked in.
    const programRows = ALL_BUCKETS.map((bucket) => {
        const counts = [];
        let ytd = 0;
        for (let m = 1; m <= 12; m++) {
            counts.push(programMatrix[bucket][m]);
            ytd += programMatrix[bucket][m];
        }
        return { program: bucket, monthly: counts, ytdTotal: ytd, isAgi: isAgiBucket(bucket) };
    });

    // Grand total ROW excludes AGI buckets (the Excel labels AGI as
    // "(excl. from total)" and tallies the rest).
    const grandTotalRow = Array.from({ length: 12 }, () => 0);
    let grandYtd = 0;
    for (const row of programRows) {
        if (row.isAgi) continue;
        for (let m = 0; m < 12; m++) grandTotalRow[m] += row.monthly[m];
        grandYtd += row.ytdTotal;
    }
    const totalForShare = grandYtd || 1;
    for (const row of programRows) {
        row.share = row.isAgi ? null : row.ytdTotal / totalForShare;
    }

    return {
        year,
        generatedAt: new Date().toISOString(),
        kpi: {
            ytdTarget: totalYtdTarget,
            ytdAchieved: totalYtdAchieved,
            ytdPercent: pct(totalYtdAchieved, totalYtdTarget),
            ytdGap: Math.max(0, totalYtdTarget - totalYtdAchieved),
            mtdTarget: totalMtdTarget,
            mtdAchieved: totalMtdAchieved,
            mtdMonth,
        },
        teamsMtd: teamsMtd.sort((a, b) => a.teamName.localeCompare(b.teamName)),
        teamsYtd: teamsYtd.sort((a, b) => a.teamName.localeCompare(b.teamName)),
        consultants: consultantsSnapshot.sort((a, b) => b.ytdPercent - a.ytdPercent),
        programs: programRows,
        programGrandTotal: { monthly: grandTotalRow, ytdTotal: grandYtd },
        buckets: ALL_BUCKETS,
        programBuckets: PROGRAM_BUCKETS,
        agiBuckets: AGI_BUCKETS,
        monthNames: MONTH_NAMES,
    };
}

module.exports = {
    getTeamDetail,
    getExecutiveOverview,
    MONTH_NAMES,
    ON_TRACK_THRESHOLD,
};
