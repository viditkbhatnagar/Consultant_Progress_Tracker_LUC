// Read-only "tools" exposed to the chat LLM.
//
// Every tool here is intentionally UNSCOPED — the chatbot deliberately
// sees the whole organization regardless of which role is asking. Matches
// the product decision "anyone can query anything via chat" and decouples
// chat visibility from the strict role-scoping that the REST API enforces.
//
// Hard rules each tool follows:
//   - Read-only (find / aggregate only — no writes).
//   - Pagination cap via MAX_ROWS so we never shove huge result sets back
//     into the LLM context window.
//   - Projection to a compact shape — we drop noisy internal fields (ids
//     not needed, timestamps when irrelevant) to keep latency + token
//     cost predictable.
//   - Any tool can receive an empty args object — we handle missing
//     filters gracefully.
//   - No sensitive fields ever leak. User model `password` is `select:
//     false` in the schema, but we still project explicitly to be safe.

const mongoose = require('mongoose');

const User = require('../models/User');
const Commitment = require('../models/Commitment');
const Meeting = require('../models/Meeting');
const Student = require('../models/Student');
const Consultant = require('../models/Consultant');
const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');

const MAX_ROWS = 200;

const toDate = (s) => (s ? new Date(s) : null);
const inRange = (field, start, end) => {
    const f = {};
    const s = toDate(start);
    const e = toDate(end);
    if (s) f.$gte = s;
    if (e) {
        // Inclusive end-of-day so "2026-04-30" captures that whole day.
        const eod = new Date(e);
        eod.setHours(23, 59, 59, 999);
        f.$lte = eod;
    }
    return Object.keys(f).length ? { [field]: f } : null;
};

// Case-insensitive contains match, safe against regex injection.
const icontains = (value) =>
    new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// ==============================
// People: users, consultants
// ==============================

async function searchPeople({ query = '', role, organization, limit = 20 } = {}) {
    const cap = Math.min(Number(limit) || 20, MAX_ROWS);
    const [users, consultants] = await Promise.all([
        User.find({
            ...(query ? { $or: [{ name: icontains(query) }, { email: icontains(query) }] } : {}),
            ...(role ? { role } : {}),
            ...(organization ? { organization } : {}),
            isActive: true,
        })
            .select('name email role teamName organization isActive')
            .limit(cap)
            .lean(),
        Consultant.find({
            ...(query ? { $or: [{ name: icontains(query) }, { email: icontains(query) }] } : {}),
            ...(organization ? { organization } : {}),
            isActive: true,
        })
            .select('name email phone teamName organization teamLead isActive')
            .populate('teamLead', 'name teamName')
            .limit(cap)
            .lean(),
    ]);
    return {
        users: users.map((u) => ({
            kind: 'user',
            id: String(u._id),
            name: u.name,
            email: u.email,
            role: u.role,
            team: u.teamName,
            organization: u.organization,
        })),
        consultants: consultants.map((c) => ({
            kind: 'consultant',
            id: String(c._id),
            name: c.name,
            email: c.email,
            phone: c.phone,
            team: c.teamName,
            teamLead: c.teamLead?.name,
            organization: c.organization,
        })),
    };
}

async function listTeamLeads({ organization } = {}) {
    const rows = await User.find({
        role: 'team_lead',
        isActive: true,
        ...(organization ? { organization } : {}),
    })
        .select('name email teamName organization')
        .sort('teamName')
        .lean();
    return rows.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        team: u.teamName,
        organization: u.organization,
    }));
}

async function getTeamRoster({ teamName, organization } = {}) {
    if (!teamName) return { error: 'teamName is required' };
    const [lead, consultants] = await Promise.all([
        User.findOne({ teamName, role: 'team_lead', ...(organization ? { organization } : {}) })
            .select('name email organization')
            .lean(),
        Consultant.find({
            teamName,
            isActive: true,
            ...(organization ? { organization } : {}),
        })
            .select('name email phone')
            .lean(),
    ]);
    if (!lead && consultants.length === 0) {
        return { error: `No team found named '${teamName}'` };
    }
    return {
        teamName,
        teamLead: lead ? { name: lead.name, email: lead.email } : null,
        consultants: consultants.map((c) => ({ name: c.name, email: c.email, phone: c.phone })),
        consultantCount: consultants.length,
    };
}

// ==============================
// Commitments
// ==============================

async function getCommitments({
    consultantName,
    teamName,
    organization,
    status,
    leadStage,
    startDate,
    endDate,
    limit = 50,
} = {}) {
    const filter = {};
    if (consultantName) filter.consultantName = icontains(consultantName);
    if (teamName) filter.teamName = icontains(teamName);
    if (organization) filter.organization = organization;
    if (status) filter.status = status;
    if (leadStage) filter.leadStage = leadStage;
    const range = inRange('commitmentDate', startDate, endDate);
    if (range) Object.assign(filter, range);

    const cap = Math.min(Number(limit) || 50, MAX_ROWS);
    const rows = await Commitment.find(filter)
        .select(
            'consultantName teamName organization studentName commitmentMade leadStage status ' +
                'meetingsDone achievementPercentage admissionClosed closedAmount ' +
                'weekNumber year commitmentDate weekStartDate'
        )
        .sort('-commitmentDate')
        .limit(cap)
        .lean();

    return {
        count: rows.length,
        capped: rows.length === cap,
        rows: rows.map((r) => ({
            consultant: r.consultantName,
            team: r.teamName,
            org: r.organization,
            student: r.studentName,
            commitment: r.commitmentMade,
            stage: r.leadStage,
            status: r.status,
            meetings: r.meetingsDone || 0,
            achievement: r.achievementPercentage || 0,
            admissionClosed: !!r.admissionClosed,
            closedAmount: r.closedAmount || 0,
            week: `W${r.weekNumber}/${r.year}`,
            date: r.commitmentDate || r.weekStartDate,
        })),
    };
}

async function commitmentStats({
    consultantName,
    teamName,
    organization,
    startDate,
    endDate,
} = {}) {
    const match = {};
    if (consultantName) match.consultantName = icontains(consultantName);
    if (teamName) match.teamName = icontains(teamName);
    if (organization) match.organization = organization;
    const range = inRange('commitmentDate', startDate, endDate);
    if (range) Object.assign(match, range);

    // Always group by org so callers can see per-org breakdown AND the
    // grand total in one tool call. Without the breakdown the LLM can't
    // reconcile its answer with a scoped dashboard KPI (e.g., the admin
    // LUC view shows 241 while combined is 246).
    const perOrgAgg = await Commitment.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$organization',
                total: { $sum: 1 },
                achieved: {
                    $sum: {
                        $cond: [
                            { $or: [{ $eq: ['$status', 'achieved'] }, { $eq: ['$admissionClosed', true] }] },
                            1,
                            0,
                        ],
                    },
                },
                missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                meetings: { $sum: { $ifNull: ['$meetingsDone', 0] } },
                admissionsClosed: {
                    $sum: { $cond: [{ $eq: ['$admissionClosed', true] }, 1, 0] },
                },
                closedAmountTotal: {
                    $sum: {
                        $cond: [
                            { $eq: ['$admissionClosed', true] },
                            { $ifNull: ['$closedAmount', 0] },
                            0,
                        ],
                    },
                },
            },
        },
    ]);

    const totals = perOrgAgg.reduce(
        (acc, d) => ({
            total: acc.total + (d.total || 0),
            achieved: acc.achieved + (d.achieved || 0),
            missed: acc.missed + (d.missed || 0),
            pending: acc.pending + (d.pending || 0),
            inProgress: acc.inProgress + (d.inProgress || 0),
            meetings: acc.meetings + (d.meetings || 0),
            admissionsClosed: acc.admissionsClosed + (d.admissionsClosed || 0),
            closedAmountTotal: acc.closedAmountTotal + (d.closedAmountTotal || 0),
        }),
        { total: 0, achieved: 0, missed: 0, pending: 0, inProgress: 0, meetings: 0, admissionsClosed: 0, closedAmountTotal: 0 }
    );

    return {
        // Primary grand-total figure for simple "how many" questions.
        totalCommitments: totals.total,
        achieved: totals.achieved,
        missed: totals.missed,
        pending: totals.pending,
        inProgress: totals.inProgress,
        totalMeetings: totals.meetings,
        admissionsClosed: totals.admissionsClosed,
        closedAmountTotal: totals.closedAmountTotal,
        achievementRate: totals.total ? Math.round((totals.achieved / totals.total) * 100) : 0,
        // Per-org breakdown so the LLM can reconcile with scoped dashboards.
        byOrganization: perOrgAgg.map((r) => ({
            organization: r._id,
            totalCommitments: r.total || 0,
            achieved: r.achieved || 0,
            missed: r.missed || 0,
            pending: r.pending || 0,
            inProgress: r.inProgress || 0,
            totalMeetings: r.meetings || 0,
            admissionsClosed: r.admissionsClosed || 0,
            closedAmountTotal: r.closedAmountTotal || 0,
            achievementRate: r.total ? Math.round((r.achieved / r.total) * 100) : 0,
        })),
        window: { startDate, endDate },
        filters: { consultantName, teamName, organization },
    };
}

async function leaderboard({
    metric = 'achievement',
    scope = 'consultant',
    organization,
    startDate,
    endDate,
    limit = 10,
} = {}) {
    const match = {};
    if (organization) match.organization = organization;
    const range = inRange('commitmentDate', startDate, endDate);
    if (range) Object.assign(match, range);
    const key = scope === 'team' ? '$teamName' : '$consultantName';
    const cap = Math.min(Number(limit) || 10, 50);

    const agg = await Commitment.aggregate([
        { $match: match },
        {
            $group: {
                _id: key,
                total: { $sum: 1 },
                achieved: {
                    $sum: {
                        $cond: [
                            { $or: [{ $eq: ['$status', 'achieved'] }, { $eq: ['$admissionClosed', true] }] },
                            1,
                            0,
                        ],
                    },
                },
                meetings: { $sum: { $ifNull: ['$meetingsDone', 0] } },
                closed: { $sum: { $cond: [{ $eq: ['$admissionClosed', true] }, 1, 0] } },
                revenue: {
                    $sum: {
                        $cond: [
                            { $eq: ['$admissionClosed', true] },
                            { $ifNull: ['$closedAmount', 0] },
                            0,
                        ],
                    },
                },
            },
        },
        {
            $addFields: {
                achievementRate: {
                    $cond: [
                        { $gt: ['$total', 0] },
                        { $multiply: [{ $divide: ['$achieved', '$total'] }, 100] },
                        0,
                    ],
                },
            },
        },
    ]);
    const field = {
        achievement: 'achievementRate',
        meetings: 'meetings',
        commitments: 'total',
        closed: 'closed',
        revenue: 'revenue',
    }[metric] || 'achievementRate';
    agg.sort((a, b) => (b[field] || 0) - (a[field] || 0));
    return {
        scope,
        metric,
        rows: agg.slice(0, cap).map((r) => ({
            name: r._id,
            commitments: r.total,
            achieved: r.achieved,
            meetings: r.meetings,
            admissionsClosed: r.closed,
            revenue: r.revenue,
            achievementRate: Math.round(r.achievementRate || 0),
        })),
    };
}

// ==============================
// Meetings
// ==============================

async function getMeetings({
    consultantName,
    teamName,
    organization,
    status,
    startDate,
    endDate,
    limit = 50,
} = {}) {
    const filter = {};
    if (consultantName) filter.consultantName = icontains(consultantName);
    if (teamName) filter.teamName = icontains(teamName);
    if (organization) filter.organization = organization;
    if (status) filter.status = status;
    const range = inRange('meetingDate', startDate, endDate);
    if (range) Object.assign(filter, range);

    const cap = Math.min(Number(limit) || 50, MAX_ROWS);
    const rows = await Meeting.find(filter)
        .select(
            'consultantName teamName organization studentName status leadStage meetingDate ' +
                'program mode remarks'
        )
        .sort('-meetingDate')
        .limit(cap)
        .lean();
    return {
        count: rows.length,
        capped: rows.length === cap,
        rows: rows.map((m) => ({
            consultant: m.consultantName,
            team: m.teamName,
            org: m.organization,
            student: m.studentName,
            status: m.status,
            stage: m.leadStage,
            date: m.meetingDate,
            program: m.program,
            mode: m.mode,
            remarks: m.remarks,
        })),
    };
}

// ==============================
// Students
// ==============================

async function getStudents({
    query,
    organization,
    studentStatus,
    teamName,
    consultantName,
    startDate,
    endDate,
    limit = 50,
} = {}) {
    const filter = {};
    if (query) {
        filter.$or = [
            { studentName: icontains(query) },
            { enrollmentNumber: icontains(query) },
            { school: icontains(query) },
        ];
    }
    if (organization) filter.organization = organization;
    if (studentStatus) filter.studentStatus = studentStatus;
    if (teamName) filter.teamName = icontains(teamName);
    if (consultantName) filter.consultantName = icontains(consultantName);
    const range = inRange('createdAt', startDate, endDate);
    if (range) Object.assign(filter, range);

    const cap = Math.min(Number(limit) || 50, MAX_ROWS);
    const rows = await Student.find(filter)
        .select(
            'studentName enrollmentNumber organization studentStatus teamName consultantName ' +
                'program university source companyName curriculum academicYear yearOrGrade mode ' +
                'courseFee registrationFee admissionFeePaid emis createdAt closingDate'
        )
        .sort('-createdAt')
        .limit(cap)
        .lean();

    return {
        count: rows.length,
        capped: rows.length === cap,
        rows: rows.map((s) => {
            const emiPaid = (s.emis || []).reduce((sum, e) => sum + (e.paidAmount || 0), 0);
            const outstanding =
                (s.courseFee || 0) -
                (s.admissionFeePaid || 0) -
                (s.registrationFee || 0) -
                emiPaid;
            return {
                name: s.studentName,
                enrollment: s.enrollmentNumber,
                org: s.organization,
                status: s.studentStatus,
                team: s.teamName,
                consultant: s.consultantName,
                program: s.program,
                university: s.university,
                curriculum: s.curriculum,
                academicYear: s.academicYear,
                grade: s.yearOrGrade,
                mode: s.mode,
                courseFee: s.courseFee,
                paid: (s.admissionFeePaid || 0) + (s.registrationFee || 0) + emiPaid,
                outstanding,
                admittedAt: s.createdAt,
                closedAt: s.closingDate,
            };
        }),
    };
}

// Revenue for a date window. Data reality for THIS tenant (profiled
// against the live DB):
//   - LUC: `Commitment.closedDate` is NEVER populated (0 / 341 closed
//     records), and `Commitment.closedAmount` is always 0. The actual
//     close-date field that IS populated is `Commitment.admissionClosedDate`.
//     Real LUC cash lives on `Student.admissionFeePaid` (~349 / 975
//     records carry a non-zero value), attributed by `Student.closingDate`.
//     `Student.courseFee` is the sticker price, not revenue.
//   - Skillhub: `Student.admissionFeePaid + registrationFee + sum(emis.paidAmount)`
//     is real revenue. Upfront fees are attributed to `createdAt` because
//     no payment-date field exists; EMI payments carry `emis.paidOn`.
//
// Tool returns both admissions COUNT and revenue AMOUNT so callers can
// distinguish "N admissions closed" from "$X recorded".
async function getRevenue({ startDate, endDate, organization } = {}) {
    const s = toDate(startDate);
    const eRaw = toDate(endDate);
    const e = eRaw ? new Date(eRaw) : null;
    if (e) e.setHours(23, 59, 59, 999);

    const scopeLuc =
        !organization || organization === 'all' || organization === 'luc';
    const scopeSkillhub =
        !organization || organization === 'all' || organization === 'skillhub_training' || organization === 'skillhub_institute';

    // ---------- LUC admission COUNT (from Commitment.admissionClosedDate) ----------
    const lucAdmissionMatch = scopeLuc
        ? {
              admissionClosed: true,
              organization: 'luc',
              ...(s || e
                  ? {
                        admissionClosedDate: {
                            ...(s ? { $gte: s } : {}),
                            ...(e ? { $lte: e } : {}),
                        },
                    }
                  : {}),
          }
        : { _id: null };

    // ---------- LUC revenue AMOUNT (from Student.admissionFeePaid, attributed by closingDate) ----------
    const lucStudentMatch = scopeLuc
        ? {
              organization: 'luc',
              ...(s || e
                  ? {
                        closingDate: {
                            ...(s ? { $gte: s } : {}),
                            ...(e ? { $lte: e } : {}),
                        },
                    }
                  : {}),
          }
        : { _id: null };

    const [lucAgg, lucStudentAgg, skillhubAgg] = await Promise.all([
        Commitment.aggregate([
            { $match: lucAdmissionMatch },
            {
                $group: {
                    _id: '$organization',
                    admissions: { $sum: 1 },
                    revenue: { $sum: { $ifNull: ['$closedAmount', 0] } },
                    admissionsWithAmount: {
                        $sum: {
                            $cond: [{ $gt: [{ $ifNull: ['$closedAmount', 0] }, 0] }, 1, 0],
                        },
                    },
                },
            },
        ]),
        Student.aggregate([
            { $match: lucStudentMatch },
            {
                $group: {
                    _id: '$organization',
                    studentsClosing: { $sum: 1 },
                    cashCollected: { $sum: { $ifNull: ['$admissionFeePaid', 0] } },
                    courseFeeBooked: { $sum: { $ifNull: ['$courseFee', 0] } },
                    studentsWithCash: {
                        $sum: {
                            $cond: [{ $gt: [{ $ifNull: ['$admissionFeePaid', 0] }, 0] }, 1, 0],
                        },
                    },
                },
            },
        ]),
        // Skillhub: sum admission/registration/EMI payments dated in window.
        Student.aggregate([
            {
                $match: {
                    organization: { $in: ['skillhub_training', 'skillhub_institute'] },
                    ...(organization && organization !== 'all' && organization !== 'luc'
                        ? { organization }
                        : {}),
                },
            },
            {
                $project: {
                    organization: 1,
                    createdAt: 1,
                    admissionFeePaid: { $ifNull: ['$admissionFeePaid', 0] },
                    registrationFee: { $ifNull: ['$registrationFee', 0] },
                    emis: { $ifNull: ['$emis', []] },
                },
            },
            {
                $addFields: {
                    emiPaidInWindow: {
                        $sum: {
                            $map: {
                                input: '$emis',
                                as: 'e',
                                in: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$$e.paidOn', null] },
                                                startDate
                                                    ? { $gte: ['$$e.paidOn', toDate(startDate)] }
                                                    : { $literal: true },
                                                endDate
                                                    ? { $lte: ['$$e.paidOn', (() => { const d = toDate(endDate); d.setHours(23,59,59,999); return d; })()] }
                                                    : { $literal: true },
                                            ],
                                        },
                                        { $ifNull: ['$$e.paidAmount', 0] },
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                    // Admission + registration fees count against the student's
                    // createdAt — best proxy we have for "payment date" when no
                    // payment-date field exists on those fee slots.
                    upfrontInWindow: {
                        $cond: [
                            {
                                $and: [
                                    startDate
                                        ? { $gte: ['$createdAt', toDate(startDate)] }
                                        : { $literal: true },
                                    endDate
                                        ? { $lte: ['$createdAt', (() => { const d = toDate(endDate); d.setHours(23,59,59,999); return d; })()] }
                                        : { $literal: true },
                                ],
                            },
                            { $add: ['$admissionFeePaid', '$registrationFee'] },
                            0,
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$organization',
                    revenue: { $sum: { $add: ['$emiPaidInWindow', '$upfrontInWindow'] } },
                    admissions: { $sum: { $cond: [{ $gt: [{ $add: ['$emiPaidInWindow', '$upfrontInWindow'] }, 0] }, 1, 0] } },
                },
            },
        ]),
    ]);

    const byOrg = {};
    // LUC: admissions come from Commitment; cash comes from Student (different
    // dates, so admissions count and revenue may not line up 1:1).
    for (const row of lucAgg) {
        byOrg[row._id] = byOrg[row._id] || { organization: row._id };
        byOrg[row._id].admissions = (byOrg[row._id].admissions || 0) + (row.admissions || 0);
        byOrg[row._id].commitmentClosedAmount =
            (byOrg[row._id].commitmentClosedAmount || 0) + (row.revenue || 0);
    }
    for (const row of lucStudentAgg) {
        byOrg[row._id] = byOrg[row._id] || { organization: row._id };
        byOrg[row._id].studentsClosing = row.studentsClosing || 0;
        byOrg[row._id].cashCollected =
            (byOrg[row._id].cashCollected || 0) + (row.cashCollected || 0);
        byOrg[row._id].courseFeeBooked =
            (byOrg[row._id].courseFeeBooked || 0) + (row.courseFeeBooked || 0);
        byOrg[row._id].studentsWithCash = row.studentsWithCash || 0;
    }
    for (const row of skillhubAgg) {
        byOrg[row._id] = byOrg[row._id] || { organization: row._id };
        byOrg[row._id].admissions =
            (byOrg[row._id].admissions || 0) + (row.admissions || 0);
        byOrg[row._id].cashCollected =
            (byOrg[row._id].cashCollected || 0) + (row.revenue || 0);
    }

    // Compute `revenue` per row as the best available signal:
    //   LUC → cashCollected (from Student.admissionFeePaid)
    //   Skillhub → cashCollected (from upfront + emis.paidOn)
    const rows = Object.values(byOrg).map((r) => ({
        ...r,
        revenue: r.cashCollected || 0,
    }));

    const totalRevenue = rows.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalAdmissions = rows.reduce((s, r) => s + (r.admissions || 0), 0);

    return {
        window: { startDate, endDate },
        totalRevenue,
        totalAdmissions,
        byOrganization: rows,
        notes: {
            luc:
                'LUC admissions counted via Commitment.admissionClosedDate. LUC cash revenue is sum of Student.admissionFeePaid attributed to Student.closingDate in window. Commitment.closedAmount is never populated in this tenant (ignore it).',
            skillhub:
                'Skillhub admissions counted via Student.createdAt in window. Revenue = admissionFeePaid + registrationFee (attributed to createdAt) + sum(emis.paidAmount where emis.paidOn in window).',
        },
    };
}

// ==============================
// Hourly tracker (attendance, activity)
// ==============================

async function getHourlyAttendance({ consultantName, date, organization } = {}) {
    const filter = {};
    if (consultantName) filter.consultantName = icontains(consultantName);
    if (organization) filter.organization = organization;
    if (date) {
        const d = toDate(date);
        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        filter.date = { $gte: d, $lte: end };
    } else {
        // Default: today.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        filter.date = { $gte: today, $lte: end };
    }

    const rows = await HourlyActivity.find(filter)
        .select('consultantName organization slotId activityType count durationMinutes date')
        .sort('consultantName slotId')
        .limit(MAX_ROWS)
        .lean();

    // Roll up per-consultant so the LLM gets a clean per-person picture.
    const byConsultant = {};
    for (const r of rows) {
        if (!byConsultant[r.consultantName]) {
            byConsultant[r.consultantName] = {
                consultant: r.consultantName,
                organization: r.organization,
                slots: [],
                totalSlots: 0,
            };
        }
        byConsultant[r.consultantName].slots.push({
            slot: r.slotId,
            type: r.activityType,
            count: r.count || 0,
            minutes: r.durationMinutes || 0,
        });
        byConsultant[r.consultantName].totalSlots++;
    }
    return {
        date: filter.date.$gte,
        count: rows.length,
        perConsultant: Object.values(byConsultant),
        present: Object.keys(byConsultant),
    };
}

// Cross-tracker absence detection. "Who was absent today" is the canonical
// question — the Hourly Tracker alone isn't enough because a consultant
// might have skipped logging slots while still being active (logging a
// commitment, holding a meeting). We treat "absent" as "no activity
// anywhere in the tracker for that date":
//   - zero HourlyActivity rows
//   - zero Commitments with commitmentDate on that day
//   - zero Meetings with meetingDate on that day
//
// Anyone with a non-zero count on any of those is PRESENT. Absentees are
// listed with their team + org so the LLM can say "Dipin (Team Shasin, LUC)
// is absent".
async function getAbsentConsultants({ date, organization } = {}) {
    const d = toDate(date) || new Date();
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const consultantFilter = { isActive: true };
    if (organization) consultantFilter.organization = organization;
    const consultants = await Consultant.find(consultantFilter)
        .select('name teamName organization excludeFromHourly')
        .lean();

    // Run every per-consultant check concurrently. Each is an indexed
    // count — cheap — and MongoDB handles 100+ parallel counts fine.
    const enriched = await Promise.all(
        consultants.map(async (c) => {
            const [hourly, commits, meetings] = await Promise.all([
                HourlyActivity.countDocuments({
                    consultantName: c.name,
                    date: { $gte: dayStart, $lte: dayEnd },
                }),
                Commitment.countDocuments({
                    consultantName: c.name,
                    commitmentDate: { $gte: dayStart, $lte: dayEnd },
                }),
                Meeting.countDocuments({
                    consultantName: c.name,
                    meetingDate: { $gte: dayStart, $lte: dayEnd },
                }),
            ]);
            const total = hourly + commits + meetings;
            return {
                name: c.name,
                team: c.teamName,
                organization: c.organization,
                hourlyEntries: hourly,
                commitmentsLogged: commits,
                meetingsHeld: meetings,
                totalActivity: total,
                present: total > 0,
                excludedFromHourly: !!c.excludeFromHourly,
            };
        })
    );

    const absent = enriched.filter((r) => !r.present);
    const present = enriched.filter((r) => r.present);

    return {
        date: dayStart.toISOString().slice(0, 10),
        totalConsultants: consultants.length,
        presentCount: present.length,
        absentCount: absent.length,
        absent: absent.map((r) => ({
            name: r.name,
            team: r.team,
            organization: r.organization,
            excludedFromHourly: r.excludedFromHourly,
        })),
        present: present.map((r) => ({
            name: r.name,
            team: r.team,
            organization: r.organization,
            hourlyEntries: r.hourlyEntries,
            commitmentsLogged: r.commitmentsLogged,
            meetingsHeld: r.meetingsHeld,
        })),
        notes:
            'Activity = hourly slots OR commitments logged OR meetings held on the given date. Consultants marked excludedFromHourly (Ameen, Zakeer) don\'t use the Hourly Tracker — they may still show present via commitments or meetings. Data windows: hourly Mar 25–Apr 22 2026, commitments Dec 2025–Apr 27 2026, meetings Apr 1–Apr 22 2026. Dates outside those will return everyone as absent.',
    };
}

async function getDailyAdmissions({ startDate, endDate, organization } = {}) {
    const filter = {};
    if (organization) filter.organization = organization;
    const range = inRange('date', startDate, endDate);
    if (range) Object.assign(filter, range);
    const rows = await DailyAdmission.find(filter)
        .sort('-date')
        .limit(MAX_ROWS)
        .lean();
    return {
        count: rows.length,
        rows: rows.map((r) => ({
            consultant: r.consultantName,
            organization: r.organization,
            date: r.date,
            count: r.count,
        })),
    };
}

// ==============================
// Today snapshot — small helper the LLM can call to orient itself.
// ==============================

async function todaySnapshot() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const [todayCommits, todayMeetings, presentCount, orgs] = await Promise.all([
        Commitment.countDocuments({ createdAt: { $gte: dayStart } }),
        Meeting.countDocuments({ meetingDate: { $gte: dayStart, $lte: now } }),
        HourlyActivity.distinct('consultantName', {
            date: { $gte: dayStart },
        }),
        Commitment.distinct('organization'),
    ]);

    return {
        now,
        todayCommitments: todayCommits,
        todayMeetings,
        presentConsultants: presentCount,
        presentConsultantNames: presentCount, // already a list of names from distinct()
        organizations: orgs,
    };
}

// ==============================
// OpenAI tool schema + dispatch table
// ==============================

const TOOL_SCHEMAS = [
    {
        type: 'function',
        function: {
            name: 'search_people',
            description:
                'Search team leads, admins, managers, counselors, and consultants by name or email. Use when the user mentions a person\'s name and you need to identify who they are (team, role, org) before running other queries. Returns both User accounts and Consultant records.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Partial name or email, case-insensitive.' },
                    role: { type: 'string', enum: ['admin', 'team_lead', 'manager', 'skillhub'] },
                    organization: { type: 'string', enum: ['luc', 'skillhub_training', 'skillhub_institute'] },
                    limit: { type: 'number', default: 20 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_team_leads',
            description: 'List all active team leads. Useful when the user asks "what teams are there".',
            parameters: {
                type: 'object',
                properties: {
                    organization: { type: 'string', enum: ['luc', 'skillhub_training', 'skillhub_institute'] },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_team_roster',
            description: 'Get the full roster (team lead + all consultants) for a named team.',
            parameters: {
                type: 'object',
                properties: {
                    teamName: { type: 'string', description: 'Exact team name, e.g. "Team Tony"' },
                    organization: { type: 'string' },
                },
                required: ['teamName'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_commitments',
            description:
                'Fetch commitment records with filters. Use when the user asks about individual commitments rather than aggregate numbers. For counts/rates/summaries, prefer commitment_stats or leaderboard.',
            parameters: {
                type: 'object',
                properties: {
                    consultantName: { type: 'string' },
                    teamName: { type: 'string' },
                    organization: { type: 'string', enum: ['luc', 'skillhub_training', 'skillhub_institute'] },
                    status: { type: 'string', enum: ['pending', 'in_progress', 'achieved', 'missed'] },
                    leadStage: { type: 'string' },
                    startDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
                    endDate: { type: 'string', description: 'ISO date YYYY-MM-DD' },
                    limit: { type: 'number', default: 50 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'commitment_stats',
            description:
                'Aggregate commitment metrics (total, achieved, missed, meetings, admissions closed, achievement rate, closed revenue) with optional filters. Always prefer this over get_commitments when the user wants a number or percentage.',
            parameters: {
                type: 'object',
                properties: {
                    consultantName: { type: 'string' },
                    teamName: { type: 'string' },
                    organization: { type: 'string', enum: ['luc', 'skillhub_training', 'skillhub_institute'] },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'leaderboard',
            description:
                'Rank consultants or teams by a metric (achievement rate, meetings, commitments, admissions closed, revenue).',
            parameters: {
                type: 'object',
                properties: {
                    metric: { type: 'string', enum: ['achievement', 'meetings', 'commitments', 'closed', 'revenue'], default: 'achievement' },
                    scope: { type: 'string', enum: ['consultant', 'team'], default: 'consultant' },
                    organization: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    limit: { type: 'number', default: 10 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_meetings',
            description: 'Fetch meeting records with filters.',
            parameters: {
                type: 'object',
                properties: {
                    consultantName: { type: 'string' },
                    teamName: { type: 'string' },
                    organization: { type: 'string' },
                    status: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    limit: { type: 'number', default: 50 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_students',
            description:
                'Fetch student records (LUC or Skillhub) with filters. Supports free-text search across name, enrollment number, and school.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    organization: { type: 'string' },
                    studentStatus: { type: 'string', enum: ['new_admission', 'active', 'inactive'] },
                    teamName: { type: 'string' },
                    consultantName: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    limit: { type: 'number', default: 50 },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_revenue',
            description:
                'Compute revenue for a date window. Combines LUC (sum of closedAmount on Commitments closed in window) and Skillhub (sum of admission fees + registration fees + EMI payments dated in window). Breaks down by organization.',
            parameters: {
                type: 'object',
                properties: {
                    startDate: { type: 'string', description: 'YYYY-MM-DD' },
                    endDate: { type: 'string', description: 'YYYY-MM-DD' },
                    organization: {
                        type: 'string',
                        description: 'Filter to one org. Omit or "all" for combined.',
                        enum: ['luc', 'skillhub_training', 'skillhub_institute', 'all'],
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_hourly_attendance',
            description:
                'Return per-consultant Hourly Tracker slot breakdown for a given day. Use when the user asks what someone specifically DID during the day (which slots, what activity type, counts). For "who is absent / who is present" questions use get_absent_consultants instead — it cross-checks commitments and meetings too.',
            parameters: {
                type: 'object',
                properties: {
                    consultantName: { type: 'string' },
                    date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
                    organization: { type: 'string' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_absent_consultants',
            description:
                'Cross-tracker absence detection for a given day. Returns the list of active consultants with ZERO activity across: HourlyActivity slots, Commitments logged (by commitmentDate), and Meetings held (by meetingDate). Use this for any "who is absent / who is present / who was missing / who did not show up" question. Defaults to today.',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
                    organization: {
                        type: 'string',
                        enum: ['luc', 'skillhub_training', 'skillhub_institute'],
                        description: 'Optional — leave off to cover all orgs.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_daily_admissions',
            description: 'Per-day admission counts (DailyAdmission collection), usually for reporting.',
            parameters: {
                type: 'object',
                properties: {
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    organization: { type: 'string' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'today_snapshot',
            description:
                'Quick snapshot of what happened today: commitments created, meetings, who is present. Use this when the user asks an open-ended "what\'s going on today" type question.',
            parameters: { type: 'object', properties: {} },
        },
    },
];

const DISPATCH = {
    search_people: searchPeople,
    list_team_leads: listTeamLeads,
    get_team_roster: getTeamRoster,
    get_commitments: getCommitments,
    commitment_stats: commitmentStats,
    leaderboard,
    get_meetings: getMeetings,
    get_students: getStudents,
    get_revenue: getRevenue,
    get_hourly_attendance: getHourlyAttendance,
    get_absent_consultants: getAbsentConsultants,
    get_daily_admissions: getDailyAdmissions,
    today_snapshot: todaySnapshot,
};

async function runTool(name, args) {
    const fn = DISPATCH[name];
    if (!fn) return { error: `Unknown tool: ${name}` };
    try {
        const parsed = typeof args === 'string' ? JSON.parse(args || '{}') : args || {};
        const result = await fn(parsed);
        return result;
    } catch (err) {
        return { error: err.message || 'Tool execution failed' };
    }
}

module.exports = {
    TOOL_SCHEMAS,
    runTool,
};
