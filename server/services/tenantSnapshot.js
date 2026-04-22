// Live tenant snapshot for the chat copilot.
//
// Every fact that the chat system prompt used to hardcode (team lists,
// consultant rosters, commitment counts, activity-type frequencies,
// per-org student totals, date ranges, data-quality coverage…) is
// computed here from live DB aggregations and cached with a short TTL.
//
// Why a cache at all? Building the prompt is on the chat critical path;
// running ~12 aggregations per request adds 100-300ms and scales badly
// with concurrent users. A 2-minute TTL means at most one "cold" rebuild
// per window — usually invisible under load because the first caller's
// rebuild warms the cache for everyone else.
//
// Error handling: if an aggregation errors, we return the last known
// good snapshot (stale > absent). If we've never built one, we return a
// minimal empty structure so the prompt builder can still format a
// valid string.

const User = require('../models/User');
const Consultant = require('../models/Consultant');
const Commitment = require('../models/Commitment');
const Meeting = require('../models/Meeting');
const Student = require('../models/Student');
const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const DailyReference = require('../models/DailyReference');

const TTL_MS = 2 * 60 * 1000; // 2 minutes

let cache = null;
let cacheBuiltAt = 0;
let buildPromise = null;

const EMPTY_SNAPSHOT = Object.freeze({
    builtAt: null,
    stale: true,
    users: {
        admins: [],
        managers: [],
        skillhubLogins: [],
        teamLeads: [],
    },
    consultantsByTeam: {},
    excludedFromHourly: [],
    commitments: {
        total: 0,
        byOrg: {},
        byStatus: {},
        byLeadStage: [],
        admissionClosedTotal: 0,
        admissionClosedWithDate: 0,
        admissionClosedWithAmount: 0,
        dateRange: {},
    },
    meetings: { total: 0, byMode: {}, byStatus: [], dateRange: {} },
    students: {
        total: 0,
        byOrg: {},
        luc: { total: 0, withAdmissionFeePaid: 0, universities: [], sources: [] },
        skillhub: { total: 0, curricula: [] },
    },
    hourly: { total: 0, dateRange: {}, byActivityType: [] },
    dailyAdmissions: { total: 0, dateRange: {} },
    dailyReferences: { total: 0, dateRange: {} },
});

async function buildSnapshot() {
    // All aggregations launched in parallel; individual failures surface
    // as rejected promises, which we catch and degrade gracefully below.
    const [
        usersRaw,
        consultantsRaw,
        commitmentsByOrg,
        commitmentsByStatus,
        commitmentsByStage,
        commitmentsMeta,
        meetingsTotal,
        meetingsByMode,
        meetingsByStatus,
        meetingsRange,
        studentsByOrg,
        lucCoverage,
        lucUniversities,
        lucSources,
        skillhubCurricula,
        hourlyTotal,
        hourlyByType,
        hourlyRange,
        daTotal,
        daRange,
        drTotal,
        drRange,
    ] = await Promise.all([
        User.find({ isActive: true })
            .select('name email role teamName organization')
            .sort('teamName')
            .lean(),
        Consultant.find({ isActive: true })
            .select('name teamName organization excludeFromHourly')
            .sort('teamName name')
            .lean(),

        Commitment.aggregate([{ $group: { _id: '$organization', n: { $sum: 1 } } }]),
        Commitment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
        Commitment.aggregate([
            { $group: { _id: '$leadStage', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
        ]),
        Commitment.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    minCommit: { $min: '$commitmentDate' },
                    maxCommit: { $max: '$commitmentDate' },
                    minWeek: { $min: '$weekStartDate' },
                    maxWeek: { $max: '$weekStartDate' },
                    admissionClosedTotal: {
                        $sum: { $cond: [{ $eq: ['$admissionClosed', true] }, 1, 0] },
                    },
                    admissionClosedWithDate: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$admissionClosed', true] },
                                        { $ifNull: ['$admissionClosedDate', false] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    admissionClosedWithAmount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$admissionClosed', true] },
                                        { $gt: [{ $ifNull: ['$closedAmount', 0] }, 0] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]),

        Meeting.estimatedDocumentCount(),
        Meeting.aggregate([{ $group: { _id: '$mode', n: { $sum: 1 } } }]),
        Meeting.aggregate([
            { $group: { _id: '$status', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
        ]),
        Meeting.aggregate([
            { $group: { _id: null, min: { $min: '$meetingDate' }, max: { $max: '$meetingDate' } } },
        ]),

        Student.aggregate([{ $group: { _id: '$organization', n: { $sum: 1 } } }]),
        Student.aggregate([
            { $match: { organization: 'luc' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    withAdmissionFeePaid: {
                        $sum: {
                            $cond: [{ $gt: [{ $ifNull: ['$admissionFeePaid', 0] }, 0] }, 1, 0],
                        },
                    },
                    withCourseFee: {
                        $sum: { $cond: [{ $gt: [{ $ifNull: ['$courseFee', 0] }, 0] }, 1, 0] },
                    },
                    sumCourseFee: { $sum: { $ifNull: ['$courseFee', 0] } },
                    minClosing: { $min: '$closingDate' },
                    maxClosing: { $max: '$closingDate' },
                },
            },
        ]),
        Student.aggregate([
            { $match: { organization: 'luc' } },
            { $group: { _id: '$university', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
        ]),
        Student.aggregate([
            { $match: { organization: 'luc' } },
            { $group: { _id: '$source', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
        ]),
        Student.aggregate([
            { $match: { organization: { $in: ['skillhub_training', 'skillhub_institute'] } } },
            {
                $group: {
                    _id: { org: '$organization', curriculum: '$curriculum' },
                    n: { $sum: 1 },
                },
            },
        ]),

        HourlyActivity.estimatedDocumentCount(),
        HourlyActivity.aggregate([
            { $group: { _id: '$activityType', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
        ]),
        HourlyActivity.aggregate([
            { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' } } },
        ]),

        DailyAdmission.estimatedDocumentCount(),
        DailyAdmission.aggregate([
            { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' } } },
        ]),
        DailyReference.estimatedDocumentCount(),
        DailyReference.aggregate([
            { $group: { _id: null, min: { $min: '$date' }, max: { $max: '$date' } } },
        ]),
    ]);

    // ---- Users: bucket by role ----
    const admins = [];
    const managers = [];
    const skillhubLogins = [];
    const teamLeads = [];
    for (const u of usersRaw) {
        const entry = {
            name: u.name,
            email: u.email,
            teamName: u.teamName || null,
            organization: u.organization,
        };
        if (u.role === 'admin') admins.push(entry);
        else if (u.role === 'manager') managers.push(entry);
        else if (u.role === 'skillhub') skillhubLogins.push(entry);
        else if (u.role === 'team_lead') teamLeads.push(entry);
    }

    // ---- Consultants grouped by team ----
    const consultantsByTeam = {};
    const excludedFromHourly = [];
    for (const c of consultantsRaw) {
        const team = c.teamName || '—';
        if (!consultantsByTeam[team]) consultantsByTeam[team] = [];
        consultantsByTeam[team].push(c.name);
        if (c.excludeFromHourly) excludedFromHourly.push(`${c.name} (${team})`);
    }

    // ---- Plumb aggregations into a tidy shape ----
    const asObj = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? '(null)', r.n]));
    const asArr = (rows) => rows.map((r) => ({ name: r._id, n: r.n }));
    const commitmentMeta = commitmentsMeta[0] || {};
    const meetingRangeRow = meetingsRange[0] || {};
    const hourlyRangeRow = hourlyRange[0] || {};
    const daRangeRow = daRange[0] || {};
    const drRangeRow = drRange[0] || {};
    const lucCov = lucCoverage[0] || {};

    // Bucket Skillhub curricula by org.
    const skillhubCurriculaByOrg = {};
    for (const r of skillhubCurricula) {
        const key = r._id.org;
        if (!skillhubCurriculaByOrg[key]) skillhubCurriculaByOrg[key] = [];
        skillhubCurriculaByOrg[key].push({ curriculum: r._id.curriculum, n: r.n });
    }

    return {
        builtAt: new Date(),
        stale: false,
        users: { admins, managers, skillhubLogins, teamLeads },
        consultantsByTeam,
        excludedFromHourly,
        commitments: {
            total: commitmentMeta.total || 0,
            byOrg: asObj(commitmentsByOrg),
            byStatus: asObj(commitmentsByStatus),
            byLeadStage: asArr(commitmentsByStage),
            admissionClosedTotal: commitmentMeta.admissionClosedTotal || 0,
            admissionClosedWithDate: commitmentMeta.admissionClosedWithDate || 0,
            admissionClosedWithAmount: commitmentMeta.admissionClosedWithAmount || 0,
            dateRange: {
                minCommitmentDate: commitmentMeta.minCommit || null,
                maxCommitmentDate: commitmentMeta.maxCommit || null,
                minWeekStartDate: commitmentMeta.minWeek || null,
                maxWeekStartDate: commitmentMeta.maxWeek || null,
            },
        },
        meetings: {
            total: meetingsTotal || 0,
            byMode: asObj(meetingsByMode),
            byStatus: asArr(meetingsByStatus),
            dateRange: { min: meetingRangeRow.min || null, max: meetingRangeRow.max || null },
        },
        students: {
            total: (studentsByOrg || []).reduce((s, r) => s + r.n, 0),
            byOrg: asObj(studentsByOrg),
            luc: {
                total: lucCov.total || 0,
                withAdmissionFeePaid: lucCov.withAdmissionFeePaid || 0,
                withCourseFee: lucCov.withCourseFee || 0,
                sumCourseFee: lucCov.sumCourseFee || 0,
                minClosingDate: lucCov.minClosing || null,
                maxClosingDate: lucCov.maxClosing || null,
                universities: asArr(lucUniversities),
                sources: asArr(lucSources),
            },
            skillhub: {
                curriculaByOrg: skillhubCurriculaByOrg,
            },
        },
        hourly: {
            total: hourlyTotal || 0,
            byActivityType: asArr(hourlyByType),
            dateRange: { min: hourlyRangeRow.min || null, max: hourlyRangeRow.max || null },
        },
        dailyAdmissions: {
            total: daTotal || 0,
            dateRange: { min: daRangeRow.min || null, max: daRangeRow.max || null },
        },
        dailyReferences: {
            total: drTotal || 0,
            dateRange: { min: drRangeRow.min || null, max: drRangeRow.max || null },
        },
    };
}

// Public entry point. Deduplicates concurrent rebuilds — a burst of 10
// simultaneous chat turns after the TTL expires triggers exactly one
// aggregation pass; everyone else awaits the same promise.
async function getTenantSnapshot() {
    const now = Date.now();
    if (cache && now - cacheBuiltAt < TTL_MS) return cache;
    if (buildPromise) return buildPromise;

    buildPromise = buildSnapshot()
        .then((snap) => {
            cache = snap;
            cacheBuiltAt = Date.now();
            return snap;
        })
        .catch((err) => {
            // Fall back to stale cache if we have one; otherwise empty.
            // Log loudly — a snapshot that perpetually fails to refresh
            // would mean the chat prompt slowly drifts from reality.
            // eslint-disable-next-line no-console
            console.error('[tenantSnapshot] rebuild failed:', err.message);
            if (cache) return { ...cache, stale: true };
            return { ...EMPTY_SNAPSHOT, stale: true };
        })
        .finally(() => {
            buildPromise = null;
        });

    return buildPromise;
}

// Background warm-up so the first chat turn after boot isn't cold.
// Fire and forget; handled by getTenantSnapshot's own error path.
setTimeout(() => {
    getTenantSnapshot().catch(() => {});
}, 5000);

module.exports = { getTenantSnapshot };
