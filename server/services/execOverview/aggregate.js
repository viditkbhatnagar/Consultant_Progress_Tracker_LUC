// Aggregation logic for the Executive Overview + Team Detail dashboards.
//
// Data source: TeamMonthlyEntry (one row per consultant × month).
// Everything is manually entered to match the Excel exactly — no auto
// derivation from Student records. Total Admissions, % Revenue, team
// totals and YTD strips are computed in this module from the entered
// values, mirroring the Excel formulas.

const User = require('../../models/User');
const Consultant = require('../../models/Consultant');
const TeamMonthlyEntry = require('../../models/TeamMonthlyEntry');
const {
    PROGRAM_BUCKETS,
    AGI_BUCKETS,
    ALL_BUCKETS,
    PROGRAM_SLUGS,
    AGI_SLUGS,
    ALL_SLUGS,
    BUCKET_SLUGS,
    isAgiSlug,
} = require('./bucketing');

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const ON_TRACK_THRESHOLD = 0.8;

function statusFor(pct) {
    return pct >= ON_TRACK_THRESHOLD ? 'On Track' : 'Behind';
}

function pct(num, den) {
    if (!den || den <= 0) return 0;
    return (num || 0) / den;
}

// Total admissions for a row excludes AGI columns (matches Excel
// formula SUM(H:U), where AGI is columns F-G).
function rowTotalAdmissions(entry) {
    let n = 0;
    for (const slug of PROGRAM_SLUGS) n += entry[slug] || 0;
    return n;
}

// Convert a TeamMonthlyEntry doc into the per-row shape the UI consumes.
function shapeRow(entry, consultantMeta) {
    const buckets = {};
    for (const bucket of ALL_BUCKETS) {
        buckets[bucket] = entry[BUCKET_SLUGS[bucket]] || 0;
    }
    return {
        consultantId: entry.consultant,
        consultantName: entry.consultantName || consultantMeta?.name || 'Unknown',
        isActive: consultantMeta?.isActive ?? true,
        monthlyTarget: entry.monthlyTarget || 0,
        achievedRevenue: entry.achievedRevenue || 0,
        percentRevenue: pct(entry.achievedRevenue, entry.monthlyTarget),
        totalAdmissions: rowTotalAdmissions(entry),
        buckets,
    };
}

// Build an empty placeholder row for a consultant who has no entry yet
// for a given month — keeps the table shape stable.
function placeholderRow(consultant) {
    const buckets = {};
    for (const bucket of ALL_BUCKETS) buckets[bucket] = 0;
    return {
        consultantId: consultant._id,
        consultantName: consultant.name,
        isActive: consultant.isActive ?? true,
        monthlyTarget: 0,
        achievedRevenue: 0,
        percentRevenue: 0,
        totalAdmissions: 0,
        buckets,
    };
}

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

    const consultants = await Consultant.find({ teamLead: teamLeadId })
        .select('name email isActive')
        .lean();

    const entries = await TeamMonthlyEntry.find({
        organization: 'luc',
        teamLead: teamLeadId,
        year,
    }).lean();

    // Build (consultantId -> month -> entry) index.
    const idx = new Map();
    for (const c of consultants) idx.set(String(c._id), { meta: c, months: {} });
    for (const e of entries) {
        const key = String(e.consultant);
        if (!idx.has(key)) {
            idx.set(key, {
                meta: { _id: e.consultant, name: e.consultantName, isActive: false },
                months: {},
            });
        }
        idx.get(key).months[e.month] = e;
    }

    const months = [];
    for (let m = 1; m <= 12; m++) {
        let memberRows = [];
        for (const [, ctx] of idx.entries()) {
            const entry = ctx.months[m];
            memberRows.push(entry ? shapeRow(entry, ctx.meta) : placeholderRow(ctx.meta));
        }
        memberRows.sort((a, b) => a.consultantName.localeCompare(b.consultantName));

        // TEAM TOTAL row = column-sum over members.
        const teamBuckets = {};
        for (const b of ALL_BUCKETS) teamBuckets[b] = 0;
        let teamTarget = 0;
        let teamAchieved = 0;
        for (const row of memberRows) {
            teamTarget += row.monthlyTarget;
            teamAchieved += row.achievedRevenue;
            for (const b of ALL_BUCKETS) teamBuckets[b] += row.buckets[b];
        }
        const teamAdmissions = PROGRAM_BUCKETS.reduce((acc, b) => acc + teamBuckets[b], 0);
        months.push({
            month: m,
            monthName: MONTH_NAMES[m - 1],
            members: memberRows,
            teamTotal: {
                monthlyTarget: teamTarget,
                achievedRevenue: teamAchieved,
                percentRevenue: pct(teamAchieved, teamTarget),
                totalAdmissions: teamAdmissions,
                buckets: teamBuckets,
            },
        });
    }

    // YTD strip: sum every month — for past years that's a full year, for
    // the current year it naturally ends at the last entered month
    // (months past TODAY simply have no entries → zeros).
    let ytdTarget = 0;
    let ytdAchieved = 0;
    for (const b of months) {
        ytdTarget += b.teamTotal.monthlyTarget;
        ytdAchieved += b.teamTotal.achievedRevenue;
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
        bucketSlugs: BUCKET_SLUGS,
        ytd: {
            target: ytdTarget,
            achieved: ytdAchieved,
            percent: pct(ytdAchieved, ytdTarget),
            remaining: Math.max(0, ytdTarget - ytdAchieved),
        },
        months,
    };
}

async function getExecutiveOverview({ year }) {
    const [teamLeads, consultants, entries] = await Promise.all([
        User.find({ role: 'team_lead', organization: 'luc', isActive: true })
            .select('name teamName')
            .lean(),
        Consultant.find({ organization: 'luc' })
            .select('name teamLead isActive')
            .lean(),
        TeamMonthlyEntry.find({ organization: 'luc', year }).lean(),
    ]);

    const now = new Date();
    const currentMonth = now.getUTCFullYear() === year ? now.getUTCMonth() + 1 : 12;
    const mtdMonth = currentMonth;

    const teamIdx = new Map();
    for (const tl of teamLeads) {
        teamIdx.set(String(tl._id), {
            id: tl._id,
            name: tl.name,
            teamName: tl.teamName || `Team ${tl.name}`,
            monthly: Array.from({ length: 13 }, () => ({ target: 0, achieved: 0 })),
        });
    }

    const consIdx = new Map();
    for (const c of consultants) {
        consIdx.set(String(c._id), {
            id: c._id,
            name: c.name,
            teamLead: c.teamLead,
            monthly: Array.from({ length: 13 }, () => ({ target: 0, achieved: 0 })),
        });
    }

    const programMatrix = {};
    for (const slug of ALL_SLUGS) programMatrix[slug] = Array.from({ length: 13 }, () => 0);

    for (const e of entries) {
        const cKey = String(e.consultant);
        const tlKey = String(e.teamLead);
        if (consIdx.has(cKey)) {
            consIdx.get(cKey).monthly[e.month].target += e.monthlyTarget || 0;
            consIdx.get(cKey).monthly[e.month].achieved += e.achievedRevenue || 0;
        }
        if (teamIdx.has(tlKey)) {
            teamIdx.get(tlKey).monthly[e.month].target += e.monthlyTarget || 0;
            teamIdx.get(tlKey).monthly[e.month].achieved += e.achievedRevenue || 0;
        }
        for (const slug of ALL_SLUGS) {
            programMatrix[slug][e.month] += e[slug] || 0;
        }
    }

    const teamsMtd = [];
    const teamsYtd = [];
    let totalMtdTarget = 0;
    let totalMtdAchieved = 0;
    let totalYtdTarget = 0;
    let totalYtdAchieved = 0;
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

    const programRows = ALL_BUCKETS.map((bucket) => {
        const slug = BUCKET_SLUGS[bucket];
        const counts = [];
        let ytd = 0;
        for (let m = 1; m <= 12; m++) {
            counts.push(programMatrix[slug][m]);
            ytd += programMatrix[slug][m];
        }
        return { program: bucket, slug, monthly: counts, ytdTotal: ytd, isAgi: isAgiSlug(slug) };
    });

    const grandTotalRow = Array.from({ length: 12 }, () => 0);
    let grandYtd = 0;
    for (const row of programRows) {
        if (row.isAgi) continue;
        for (let m = 0; m < 12; m++) grandTotalRow[m] += row.monthly[m];
        grandYtd += row.ytdTotal;
    }
    const denom = grandYtd || 1;
    for (const row of programRows) {
        row.share = row.isAgi ? null : row.ytdTotal / denom;
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
        bucketSlugs: BUCKET_SLUGS,
        monthNames: MONTH_NAMES,
    };
}

module.exports = {
    getTeamDetail,
    getExecutiveOverview,
    MONTH_NAMES,
    ON_TRACK_THRESHOLD,
};
