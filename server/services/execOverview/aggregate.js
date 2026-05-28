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

// "Effective current month" mirrors the Excel's MONTH(TODAY()) semantic:
// it's the latest month that has any non-zero achieved revenue. This
// keeps YTD totals bounded to months that were actually tracked instead
// of summing future-planning placeholder rows. Falls back to today's
// calendar month for the current year, or 12 for a fully-elapsed past
// year with no entries yet.
function effectiveCurrentMonth({ entries, year }) {
    let latest = 0;
    for (const e of entries) {
        if ((e.achievedRevenue || 0) > 0 && e.month > latest) latest = e.month;
    }
    if (latest > 0) return latest;
    const now = new Date();
    if (now.getUTCFullYear() === year) return now.getUTCMonth() + 1;
    if (now.getUTCFullYear() > year) return 12;
    return 0; // future year — nothing to roll up yet
}

// Org-wide effective month — used by getTeamDetail so every team shares
// the same MONTH(TODAY())-style cutoff (otherwise smaller teams with
// fewer active months get their YTD truncated below the Excel's).
async function orgWideEffectiveMonth({ year }) {
    const all = await TeamMonthlyEntry.find({
        organization: 'luc',
        year,
        achievedRevenue: { $gt: 0 },
    })
        .sort({ month: -1 })
        .limit(1)
        .lean();
    if (all.length) return all[0].month;
    const now = new Date();
    if (now.getUTCFullYear() === year) return now.getUTCMonth() + 1;
    if (now.getUTCFullYear() > year) return 12;
    return 0;
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

    // YTD strip: sum up to the org-wide latest-activity month so small
    // teams (e.g. Bahrain — last achievement Feb) still include Mar–May
    // target rows in their YTD, the way the Excel does. Past months
    // with target-only entries still count — they're tracked.
    const cutoff = await orgWideEffectiveMonth({ year });
    let ytdTarget = 0;
    let ytdAchieved = 0;
    for (let m = 1; m <= cutoff; m++) {
        ytdTarget += months[m - 1].teamTotal.monthlyTarget;
        ytdAchieved += months[m - 1].teamTotal.achievedRevenue;
    }

    // ── Member Wise Monthly Revenue (Excel "MEMBER WISE MONTHLY REVENUE") ──
    // Month × member matrix of achieved revenue + per-member YTD rows.
    // Ordered consultants (same name sort the month tables use).
    const orderedConsultants = [...idx.entries()]
        .map(([key, ctx]) => ({ key, meta: ctx.meta, months: ctx.months }))
        .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

    const memberWiseRevenue = {
        members: orderedConsultants.map((c) => {
            const monthly = [];
            let ytdAch = 0;
            let ytdTgt = 0;
            for (let m = 1; m <= 12; m++) {
                const e = c.months[m];
                const ach = e ? e.achievedRevenue || 0 : 0;
                monthly.push(ach);
                if (m <= cutoff) {
                    ytdAch += ach;
                    ytdTgt += e ? e.monthlyTarget || 0 : 0;
                }
            }
            return {
                consultantId: c.meta._id,
                consultantName: c.meta.name,
                isActive: c.meta.isActive,
                monthly,
                ytdAchieved: ytdAch,
                ytdTarget: ytdTgt,
                ytdPercent: pct(ytdAch, ytdTgt),
            };
        }),
    };

    // ── Consolidated Admissions — Program Wise (Excel "CONSOLIDATED ADM…") ──
    // Program × month counts. AGI rows listed first (matching Excel), then
    // the 14 program buckets. The Total Admissions row sums ONLY program
    // buckets (AGI excluded), mirroring Excel =SUM(program rows).
    const consolidatedOrder = [...AGI_BUCKETS, ...PROGRAM_BUCKETS];
    const consolidatedAdmissions = {
        rows: consolidatedOrder.map((bucket) => {
            const monthly = [];
            let total = 0;
            for (let m = 1; m <= 12; m++) {
                const v = months[m - 1].teamTotal.buckets[bucket] || 0;
                monthly.push(v);
                total += v;
            }
            return { program: bucket, monthly, total, isAgi: AGI_BUCKETS.includes(bucket) };
        }),
        totalAdmissions: (() => {
            const monthly = [];
            let total = 0;
            for (let m = 1; m <= 12; m++) {
                const v = months[m - 1].teamTotal.totalAdmissions || 0;
                monthly.push(v);
                total += v;
            }
            return { monthly, total };
        })(),
    };

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
        monthNames: MONTH_NAMES,
        ytd: {
            target: ytdTarget,
            achieved: ytdAchieved,
            percent: pct(ytdAchieved, ytdTarget),
            remaining: Math.max(0, ytdTarget - ytdAchieved),
        },
        months,
        memberWiseRevenue,
        consolidatedAdmissions,
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

    // Mirror the Excel's MONTH(TODAY()) cutoff — see comment on
    // effectiveCurrentMonth. Used for both MTD (the month itself) and
    // YTD (sum of months 1..cutoff).
    const currentMonth = effectiveCurrentMonth({ entries, year });
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

// Category split threshold (Excel: "Category A — Monthly Target ≥ 90,000").
const CATEGORY_A_THRESHOLD = 90000;

// Consultant Performance rankings (Excel "Consultant Performance" sheet).
// Per active consultant (excluding team-lead-as-consultant rows): a
// representative monthly target (max non-zero) drives the A/B split;
// YTD = Σ months 1..cutoff; MTD = cutoff month. Each category is ranked
// by YTD %. Also returns top-5 by MTD% and by YTD% for the highlight band.
async function getConsultantPerformance({ year }) {
    const [teamLeads, consultants, entries] = await Promise.all([
        User.find({ role: 'team_lead', organization: 'luc' }).select('name teamName').lean(),
        Consultant.find({ organization: 'luc', isActive: true }).select('name teamLead').lean(),
        TeamMonthlyEntry.find({ organization: 'luc', year }).lean(),
    ]);

    const cutoff = await orgWideEffectiveMonth({ year });

    // Team-lead display names keyed by lead id — used to drop the
    // team-lead's own self-consultant row from the rankings.
    const leadById = new Map(teamLeads.map((t) => [String(t._id), t]));

    // consultantId -> month -> entry
    const byConsultant = new Map();
    for (const e of entries) {
        const k = String(e.consultant);
        if (!byConsultant.has(k)) byConsultant.set(k, {});
        byConsultant.get(k)[e.month] = e;
    }

    const rows = [];
    for (const c of consultants) {
        const lead = leadById.get(String(c.teamLead));
        // Exclude the team-lead's own self-consultant row.
        if (lead && lead.name.trim().toLowerCase() === c.name.trim().toLowerCase()) continue;

        const months = byConsultant.get(String(c._id)) || {};
        let repMonthly = 0;
        let ytdTarget = 0;
        let ytdAchieved = 0;
        for (let m = 1; m <= 12; m++) {
            const e = months[m];
            if (!e) continue;
            if ((e.monthlyTarget || 0) > repMonthly) repMonthly = e.monthlyTarget || 0;
            if (m <= cutoff) {
                ytdTarget += e.monthlyTarget || 0;
                ytdAchieved += e.achievedRevenue || 0;
            }
        }
        const mtdEntry = months[cutoff];
        const mtdTarget = mtdEntry ? mtdEntry.monthlyTarget || 0 : 0;
        const mtdAchieved = mtdEntry ? mtdEntry.achievedRevenue || 0 : 0;

        rows.push({
            consultantId: c._id,
            name: c.name,
            team: lead ? (lead.teamName || `Team ${lead.name}`) : '',
            monthlyTarget: repMonthly,
            ytdTarget,
            ytdAchieved,
            ytdPercent: pct(ytdAchieved, ytdTarget),
            mtdTarget,
            mtdAchieved,
            mtdPercent: pct(mtdAchieved, mtdTarget),
        });
    }

    const byYtdDesc = (a, b) => b.ytdPercent - a.ytdPercent;
    const byMtdDesc = (a, b) => b.mtdPercent - a.mtdPercent;
    const rank = (list) => list.map((r, i) => ({ ...r, rank: i + 1 }));

    const categoryA = rank(rows.filter((r) => r.monthlyTarget >= CATEGORY_A_THRESHOLD).sort(byYtdDesc));
    const categoryB = rank(rows.filter((r) => r.monthlyTarget < CATEGORY_A_THRESHOLD).sort(byYtdDesc));

    const top5Ytd = [...rows].sort(byYtdDesc).slice(0, 5);
    const top5Mtd = [...rows].sort(byMtdDesc).slice(0, 5);

    return {
        year,
        cutoffMonth: cutoff,
        monthName: MONTH_NAMES[cutoff - 1] || '',
        activeCount: rows.length,
        categoryAThreshold: CATEGORY_A_THRESHOLD,
        categoryA,
        categoryB,
        top5Ytd,
        top5Mtd,
    };
}

module.exports = {
    getTeamDetail,
    getExecutiveOverview,
    getConsultantPerformance,
    MONTH_NAMES,
    ON_TRACK_THRESHOLD,
    CATEGORY_A_THRESHOLD,
};
