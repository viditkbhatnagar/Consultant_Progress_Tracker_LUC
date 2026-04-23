const OpenAI = require('openai');
const Commitment = require('../models/Commitment');
const Student = require('../models/Student');
const User = require('../models/User');

let openai;
const getClient = () => {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not configured on the server');
        }
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
};

// Aggregate organization-wide data for admin analysis.
// `organization` is an optional tenant filter (e.g. 'luc') — passing it lets
// us reuse the admin aggregation for LUC team leads who see org-wide data
// but only their own tenant. Leave undefined to match all tenants (admin).
const aggregateAdminData = async (startDate, endDate, organization = null) => {
    const dateFilter = {
        weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
    if (organization) dateFilter.organization = organization;

    const commitments = await Commitment.find(dateFilter)
        .populate('teamLead', 'name teamName')
        .lean();

    // Student data for the same period (by closingDate)
    const studentFilter = {
        closingDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
    if (organization) studentFilter.organization = organization;
    const students = await Student.find(studentFilter).lean();

    if (commitments.length === 0 && students.length === 0) {
        return null;
    }

    // Per-team stats
    const teamMap = {};
    commitments.forEach((c) => {
        const team = c.teamName || 'Unknown';
        if (!teamMap[team]) {
            teamMap[team] = {
                teamName: team,
                teamLeadName: c.teamLead?.name || 'Unknown',
                total: 0,
                achieved: 0,
                meetings: 0,
                admissionsClosed: 0,
                revenue: 0,
                consultants: {},
                leadStages: {},
            };
        }
        const t = teamMap[team];
        t.total++;
        if (c.status === 'achieved' || c.admissionClosed) t.achieved++;
        t.meetings += c.meetingsDone || 0;
        if (c.admissionClosed) {
            t.admissionsClosed++;
            t.revenue += c.closedAmount || 0;
        }

        // Per-consultant within team
        const cName = c.consultantName || 'Unknown';
        if (!t.consultants[cName]) {
            t.consultants[cName] = { total: 0, achieved: 0, meetings: 0, closed: 0 };
        }
        t.consultants[cName].total++;
        if (c.status === 'achieved' || c.admissionClosed) t.consultants[cName].achieved++;
        t.consultants[cName].meetings += c.meetingsDone || 0;
        if (c.admissionClosed) t.consultants[cName].closed++;

        // Lead stage distribution
        const stage = c.leadStage || 'Unknown';
        t.leadStages[stage] = (t.leadStages[stage] || 0) + 1;
    });

    // Convert consultant maps to sorted arrays
    const teams = Object.values(teamMap).map((t) => ({
        ...t,
        achievementRate: t.total > 0 ? Math.round((t.achieved / t.total) * 100) : 0,
        consultants: Object.entries(t.consultants)
            .map(([name, stats]) => ({
                name,
                ...stats,
                achievementRate: stats.total > 0 ? Math.round((stats.achieved / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.achievementRate - a.achievementRate),
    }));

    teams.sort((a, b) => b.achievementRate - a.achievementRate);

    // Org-wide lead stage distribution
    const orgLeadStages = {};
    commitments.forEach((c) => {
        const stage = c.leadStage || 'Unknown';
        orgLeadStages[stage] = (orgLeadStages[stage] || 0) + 1;
    });

    // Student stats summary
    const studentSummary = {
        totalAdmissions: students.length,
        totalRevenue: students.reduce((sum, s) => sum + (s.courseFee || 0), 0),
        avgConversionDays: students.length > 0
            ? Math.round(students.reduce((sum, s) => sum + (s.conversionTime || 0), 0) / students.length)
            : 0,
        bySource: {},
        byUniversity: {},
    };

    students.forEach((s) => {
        if (s.source) studentSummary.bySource[s.source] = (studentSummary.bySource[s.source] || 0) + 1;
        if (s.university) studentSummary.byUniversity[s.university] = (studentSummary.byUniversity[s.university] || 0) + 1;
    });

    return {
        dateRange: { startDate, endDate },
        totalCommitments: commitments.length,
        totalAchieved: commitments.filter((c) => c.status === 'achieved' || c.admissionClosed).length,
        totalMeetings: commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
        totalAdmissionsClosed: commitments.filter((c) => c.admissionClosed).length,
        orgLeadStages,
        teams,
        studentSummary,
    };
};

// Aggregate team-scoped data for team lead analysis
const aggregateTeamLeadData = async (teamLeadId, startDate, endDate) => {
    const dateFilter = {
        teamLead: teamLeadId,
        weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };

    const commitments = await Commitment.find(dateFilter).lean();

    const students = await Student.find({
        teamLead: teamLeadId,
        closingDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).lean();

    if (commitments.length === 0 && students.length === 0) {
        return null;
    }

    const now = new Date();

    // Per-consultant stats
    const consultantMap = {};
    commitments.forEach((c) => {
        const name = c.consultantName || 'Unknown';
        if (!consultantMap[name]) {
            consultantMap[name] = {
                name,
                total: 0,
                achieved: 0,
                meetings: 0,
                closed: 0,
                revenue: 0,
                leadStages: {},
                overdueFollowUps: 0,
                avgProbability: [],
                activeLeads: [],
            };
        }
        const con = consultantMap[name];
        con.total++;
        if (c.status === 'achieved' || c.admissionClosed) con.achieved++;
        con.meetings += c.meetingsDone || 0;
        if (c.admissionClosed) {
            con.closed++;
            con.revenue += c.closedAmount || 0;
        }

        const stage = c.leadStage || 'Unknown';
        con.leadStages[stage] = (con.leadStages[stage] || 0) + 1;

        if (c.conversionProbability) con.avgProbability.push(c.conversionProbability);

        // Track overdue follow-ups
        if (c.followUpDate && new Date(c.followUpDate) < now && !c.admissionClosed) {
            con.overdueFollowUps++;
        }

        // Track active (non-closed) leads with useful details
        if (!c.admissionClosed && c.status !== 'achieved') {
            con.activeLeads.push({
                student: c.studentName || 'Unnamed',
                stage: c.leadStage,
                probability: c.conversionProbability || 0,
                followUpDate: c.followUpDate,
                daysSinceCreated: Math.ceil((now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)),
            });
        }
    });

    const consultants = Object.values(consultantMap).map((con) => ({
        name: con.name,
        total: con.total,
        achieved: con.achieved,
        achievementRate: con.total > 0 ? Math.round((con.achieved / con.total) * 100) : 0,
        meetings: con.meetings,
        closed: con.closed,
        revenue: con.revenue,
        leadStages: con.leadStages,
        overdueFollowUps: con.overdueFollowUps,
        avgProbability: con.avgProbability.length > 0
            ? Math.round(con.avgProbability.reduce((a, b) => a + b, 0) / con.avgProbability.length)
            : 0,
        // Only include top 5 most promising active leads
        topActiveLeads: con.activeLeads
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 5),
    }));

    consultants.sort((a, b) => b.achievementRate - a.achievementRate);

    // Team-wide lead stage distribution
    const teamLeadStages = {};
    commitments.forEach((c) => {
        const stage = c.leadStage || 'Unknown';
        teamLeadStages[stage] = (teamLeadStages[stage] || 0) + 1;
    });

    // Student stats for this team
    const studentSummary = {
        totalAdmissions: students.length,
        totalRevenue: students.reduce((sum, s) => sum + (s.courseFee || 0), 0),
        avgConversionDays: students.length > 0
            ? Math.round(students.reduce((sum, s) => sum + (s.conversionTime || 0), 0) / students.length)
            : 0,
        bySource: {},
    };
    students.forEach((s) => {
        if (s.source) studentSummary.bySource[s.source] = (studentSummary.bySource[s.source] || 0) + 1;
    });

    const teamName = commitments[0]?.teamName || 'Your Team';

    return {
        dateRange: { startDate, endDate },
        teamName,
        totalCommitments: commitments.length,
        totalAchieved: commitments.filter((c) => c.status === 'achieved' || c.admissionClosed).length,
        totalMeetings: commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
        totalAdmissionsClosed: commitments.filter((c) => c.admissionClosed).length,
        teamLeadStages,
        consultants,
        studentSummary,
    };
};

// Build the prompt for admin dashboard analysis
const buildAdminPrompt = (data) => {
    const systemPrompt = `You are a senior business analyst for an education consultancy. You analyze team performance data and provide actionable insights. Be specific — use exact names, numbers, and percentages. Keep your analysis concise but impactful. Use markdown formatting with ## headers, **bold** for key metrics, and bullet points.`;

    const userPrompt = `Analyze this organization performance data for the period ${data.dateRange.startDate} to ${data.dateRange.endDate}:

ORGANIZATION OVERVIEW:
- Total Commitments: ${data.totalCommitments}
- Achieved: ${data.totalAchieved} (${data.totalCommitments > 0 ? Math.round((data.totalAchieved / data.totalCommitments) * 100) : 0}%)
- Total Meetings: ${data.totalMeetings}
- Admissions Closed: ${data.totalAdmissionsClosed}
- Lead Stage Distribution: ${JSON.stringify(data.orgLeadStages)}

TEAM-WISE BREAKDOWN:
${data.teams.map((t) => `
Team: ${t.teamName} (Lead: ${t.teamLeadName})
- Commitments: ${t.total}, Achieved: ${t.achieved} (${t.achievementRate}%), Meetings: ${t.meetings}, Admissions: ${t.admissionsClosed}, Revenue: ${t.revenue}
- Lead Stages: ${JSON.stringify(t.leadStages)}
- Consultants: ${t.consultants.map((c) => `${c.name}: ${c.total} commits, ${c.achievementRate}% achieved, ${c.meetings} meetings, ${c.closed} closed`).join('; ')}`).join('\n')}

STUDENT ADMISSIONS:
- Total: ${data.studentSummary.totalAdmissions}, Revenue: ${data.studentSummary.totalRevenue}, Avg Conversion: ${data.studentSummary.avgConversionDays} days
- By Source: ${JSON.stringify(data.studentSummary.bySource)}
- By University: ${JSON.stringify(data.studentSummary.byUniversity)}

Generate an analysis with EXACTLY these sections in this order:

## Recommendations
This is the MOST IMPORTANT section. Provide 5-7 detailed, specific, actionable recommendations for the admin. Each recommendation should:
- Name the specific team or consultant it applies to
- Reference the exact metric that triggered the recommendation
- Describe the concrete action to take and expected impact
- Be prioritized by urgency (most urgent first)
Write at least 2-3 sentences per recommendation.

## Team Leaderboard
Which team is leading and why (cite specific metrics). Rank all teams.

## Top Performers
Best consultant across the org and the top performer from each team. Mention what makes them stand out.

## Pipeline Health
Analyze the lead stage distribution. Where are leads getting stuck? Are there too many cold/dead leads?

## Revenue & Admissions
Key revenue insights, admission trends, top performing marketing sources.

## Areas Needing Attention
Teams or consultants underperforming. Be specific about what's lagging.`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

// Build the prompt for team lead dashboard analysis
const buildTeamLeadPrompt = (data) => {
    const systemPrompt = `You are a senior business analyst helping a team lead manage their sales consultants at an education consultancy. Provide specific, actionable coaching insights. Use exact names, numbers, and percentages. Use markdown formatting with ## headers, **bold** for key metrics, and bullet points.`;

    const userPrompt = `Analyze this team performance data for "${data.teamName}" for the period ${data.dateRange.startDate} to ${data.dateRange.endDate}:

TEAM OVERVIEW:
- Total Commitments: ${data.totalCommitments}
- Achieved: ${data.totalAchieved} (${data.totalCommitments > 0 ? Math.round((data.totalAchieved / data.totalCommitments) * 100) : 0}%)
- Total Meetings: ${data.totalMeetings}
- Admissions Closed: ${data.totalAdmissionsClosed}
- Lead Stage Distribution: ${JSON.stringify(data.teamLeadStages)}

CONSULTANT-WISE BREAKDOWN:
${data.consultants.map((c) => `
Consultant: ${c.name}
- Commitments: ${c.total}, Achieved: ${c.achieved} (${c.achievementRate}%), Meetings: ${c.meetings}, Admissions Closed: ${c.closed}, Revenue: ${c.revenue}
- Avg Conversion Probability: ${c.avgProbability}%
- Lead Stages: ${JSON.stringify(c.leadStages)}
- Overdue Follow-ups: ${c.overdueFollowUps}
- Top Active Leads: ${c.topActiveLeads.map((l) => `${l.student} (${l.stage}, ${l.probability}% prob, ${l.daysSinceCreated}d old${l.followUpDate ? ', follow-up: ' + new Date(l.followUpDate).toLocaleDateString() : ''})`).join('; ') || 'None'}`).join('\n')}

STUDENT ADMISSIONS:
- Total: ${data.studentSummary.totalAdmissions}, Revenue: ${data.studentSummary.totalRevenue}, Avg Conversion: ${data.studentSummary.avgConversionDays} days
- By Source: ${JSON.stringify(data.studentSummary.bySource)}

Generate an analysis with EXACTLY these sections in this order:

## Coaching Suggestions
This is the MOST IMPORTANT section. Provide 5-7 detailed, specific, actionable coaching recommendations. Each suggestion should:
- Name the specific consultant it applies to
- Reference the exact metric or lead that triggered the suggestion
- Describe the concrete coaching action and expected outcome
- Be prioritized by urgency (most urgent first)
Write at least 2-3 sentences per suggestion.

## Consultant Rankings
Rank all consultants with clear reasoning. Who's leading and why?

## Individual Assessments
Brief strength/weakness for each consultant (2-3 lines each).

## Pipeline Analysis
Which active leads look most promising? Which are at risk of going cold? Mention specific student names.

## Follow-up Priorities
Overdue follow-ups, leads that need immediate attention. Be specific.

## Conversion Insights
Where are leads getting stuck in the funnel? What stage has the biggest drop-off?`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

// GPT-4o-mini pricing per 1M tokens
const PRICING = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
};

// Call OpenAI API to generate analysis
const generateAnalysis = async (messages) => {
    const client = getClient();
    const model = 'gpt-4o-mini';

    const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 1500,
        temperature: 0.3,
    });

    const usage = response.usage || {};
    const pricing = PRICING[model] || PRICING['gpt-4o-mini'];
    const cost = ((usage.prompt_tokens || 0) * pricing.input + (usage.completion_tokens || 0) * pricing.output) / 1_000_000;

    return {
        content: response.choices[0].message.content,
        usage: {
            model,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
            cost: Math.round(cost * 1_000_000) / 1_000_000, // round to 6 decimals
        },
    };
};

// ─── STUDENT-DATABASE ANALYSIS ─────────────────────────────
// Aggregates the current Student Database filter window and builds a prompt
// keyed to the org (LUC vs Skillhub) since the field shapes diverge.
const aggregateStudentData = async ({
    startDate,
    endDate,
    organization,
    teamLeadId,
    curriculumSlug,
}) => {
    const isSkillhubOrg =
        organization === 'skillhub_training' ||
        organization === 'skillhub_institute';
    const dateField = isSkillhubOrg ? 'createdAt' : 'closingDate';

    const filter = {};
    if (organization) filter.organization = organization;
    if (teamLeadId) filter.teamLead = teamLeadId;

    if (startDate && endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter[dateField] = { $gte: new Date(startDate), $lte: end };
    }

    if (curriculumSlug === 'CBSE') {
        filter.$or = [{ curriculumSlug: 'CBSE' }, { curriculum: 'CBSE' }];
    } else if (curriculumSlug === 'IGCSE') {
        filter.$or = [
            { curriculumSlug: 'IGCSE' },
            { curriculum: { $regex: '^IGCSE', $options: 'i' } },
        ];
    }

    const students = await Student.find(filter).lean();
    if (students.length === 0) return null;

    const bump = (map, key) => {
        if (!key) return;
        map[key] = (map[key] || 0) + 1;
    };

    if (isSkillhubOrg) {
        // Skillhub: curriculum, yearOrGrade, mode, leadSource, status,
        // outstanding, EMI tracking.
        const byStatus = {};
        const byCurriculum = {};
        const byYearOrGrade = {};
        const byMode = {};
        const byLeadSource = {};
        const byConsultant = {};
        let totalCourseFee = 0;
        let totalPaid = 0;
        let totalOutstanding = 0;

        students.forEach((s) => {
            bump(byStatus, s.studentStatus);
            bump(byCurriculum, s.curriculum);
            bump(byYearOrGrade, s.yearOrGrade);
            bump(byMode, s.mode);
            bump(byLeadSource, s.leadSource);
            bump(byConsultant, s.consultantName);
            totalCourseFee += s.courseFee || 0;
            const paid = (s.admissionFeePaid || 0) + (s.registrationFee || 0);
            const emiPaid = Array.isArray(s.emis)
                ? s.emis.reduce((sum, e) => sum + (e.paidAmount || 0), 0)
                : 0;
            totalPaid += paid + emiPaid;
            totalOutstanding += Math.max(
                0,
                (s.courseFee || 0) - paid - emiPaid
            );
        });

        return {
            kind: 'skillhub',
            dateRange: { startDate, endDate },
            organization,
            curriculumSlug,
            totalStudents: students.length,
            totalCourseFee,
            totalPaid,
            totalOutstanding,
            byStatus,
            byCurriculum,
            byYearOrGrade,
            byMode,
            byLeadSource,
            byConsultant,
        };
    }

    // LUC: university / program / source / consultant / team
    const byUniversity = {};
    const byProgram = {};
    const bySource = {};
    const byConsultant = {};
    const byTeam = {};
    let totalRevenue = 0;
    let totalConversionDays = 0;
    let withConversion = 0;

    students.forEach((s) => {
        bump(byUniversity, s.university);
        bump(byProgram, s.program);
        bump(bySource, s.source);
        bump(byConsultant, s.consultantName);
        bump(byTeam, s.teamName);
        totalRevenue += s.courseFee || 0;
        if (s.conversionTime) {
            totalConversionDays += s.conversionTime;
            withConversion++;
        }
    });

    return {
        kind: 'luc',
        dateRange: { startDate, endDate },
        organization: organization || 'luc',
        totalStudents: students.length,
        totalRevenue,
        avgConversionDays:
            withConversion > 0 ? Math.round(totalConversionDays / withConversion) : 0,
        byUniversity,
        byProgram,
        bySource,
        byConsultant,
        byTeam,
    };
};

const buildStudentPrompt = (data) => {
    const systemPrompt = `You are a senior admissions analyst for an education consultancy. You analyze student enrollment data and provide actionable insights. Be specific — use exact names, numbers, and percentages. Keep the analysis concise but impactful. Use markdown formatting with ## headers, **bold** for key metrics, and bullet points.`;

    if (data.kind === 'skillhub') {
        const userPrompt = `Analyze this Skillhub student admissions data for ${data.dateRange.startDate} to ${data.dateRange.endDate} (${data.organization}${data.curriculumSlug ? ` / ${data.curriculumSlug}` : ''}):

OVERVIEW
- Total Students: ${data.totalStudents}
- Course Fees Billed: AED ${data.totalCourseFee.toLocaleString()}
- Collected: AED ${data.totalPaid.toLocaleString()}
- Outstanding: AED ${data.totalOutstanding.toLocaleString()} (${data.totalCourseFee ? Math.round((data.totalOutstanding / data.totalCourseFee) * 100) : 0}%)

DISTRIBUTIONS
- By Status: ${JSON.stringify(data.byStatus)}
- By Curriculum: ${JSON.stringify(data.byCurriculum)}
- By Year/Grade: ${JSON.stringify(data.byYearOrGrade)}
- By Mode: ${JSON.stringify(data.byMode)}
- By Lead Source: ${JSON.stringify(data.byLeadSource)}
- By Counselor: ${JSON.stringify(data.byConsultant)}

Generate an analysis with EXACTLY these sections in this order:

## Recommendations
5-7 detailed, specific, actionable recommendations (prioritized by urgency). Cite counselor names, statuses, or programs directly. 2-3 sentences each.

## Admissions Snapshot
Overall picture — how many new admissions vs active vs inactive, total billed, collection rate.

## Top Counselors
Best-performing counselors by volume; call out standouts from the distribution.

## Curriculum & Mode Trends
Which curriculum and mode are the most popular? Any outliers?

## Lead Source Effectiveness
Which lead sources are bringing the most admissions — and which are underperforming?

## Outstanding Fees Alert
Are there unusually high outstanding fees? What's the collection risk?`;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ];
    }

    // LUC
    const userPrompt = `Analyze this LUC student admissions data for ${data.dateRange.startDate} to ${data.dateRange.endDate}:

OVERVIEW
- Total Students: ${data.totalStudents}
- Revenue: AED ${data.totalRevenue.toLocaleString()}
- Avg Conversion Time: ${data.avgConversionDays} days

DISTRIBUTIONS
- By University: ${JSON.stringify(data.byUniversity)}
- By Program: ${JSON.stringify(data.byProgram)}
- By Source: ${JSON.stringify(data.bySource)}
- By Consultant: ${JSON.stringify(data.byConsultant)}
- By Team: ${JSON.stringify(data.byTeam)}

Generate an analysis with EXACTLY these sections in this order:

## Recommendations
5-7 detailed, specific, actionable recommendations (prioritized by urgency). Cite consultant names, sources, universities, or programs directly. 2-3 sentences each.

## Admissions Snapshot
Total conversions, revenue, avg conversion time — what does the window tell us?

## Top Consultants
Best-performing consultants by volume and revenue. Call out standouts.

## University & Program Mix
Which universities and programs dominate? Which are underperforming? Any missed opportunities?

## Source Effectiveness
Which marketing / lead sources are bringing the most admissions — and which are weak?

## Conversion Speed
Is the average conversion time healthy? Where could it be sped up?`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

// ─── PER-CONSULTANT ANALYSIS ───────────────────────────────
// Scope: one named consultant, within [startDate, endDate]. Cross-team by
// design — admin can pick any consultant from any team/org. Reads
// commitments + students keyed by consultantName (denormalized on both
// collections). Returns null if no activity in window.
const aggregateConsultantData = async ({
    consultantName,
    startDate,
    endDate,
    organization,
} = {}) => {
    if (!consultantName) return null;

    const commitFilter = {
        consultantName,
        weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
    const studentFilter = {
        consultantName,
        closingDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };
    if (organization) {
        commitFilter.organization = organization;
        studentFilter.organization = organization;
    }

    const [commitments, students] = await Promise.all([
        Commitment.find(commitFilter).lean(),
        Student.find(studentFilter).lean(),
    ]);

    if (commitments.length === 0 && students.length === 0) return null;

    const now = new Date();
    const leadStages = {};
    let achieved = 0;
    let meetings = 0;
    let closed = 0;
    let revenue = 0;
    let probabilitySum = 0;
    let probabilityCount = 0;
    let overdueFollowUps = 0;
    const activeLeads = [];

    for (const c of commitments) {
        if (c.status === 'achieved' || c.admissionClosed) achieved++;
        meetings += c.meetingsDone || 0;
        if (c.admissionClosed) {
            closed++;
            revenue += c.closedAmount || 0;
        }
        const stage = c.leadStage || 'Unknown';
        leadStages[stage] = (leadStages[stage] || 0) + 1;
        if (typeof c.conversionProbability === 'number') {
            probabilitySum += c.conversionProbability;
            probabilityCount++;
        }
        if (c.followUpDate && new Date(c.followUpDate) < now && !c.admissionClosed) {
            overdueFollowUps++;
        }
        if (!c.admissionClosed && c.status !== 'achieved') {
            activeLeads.push({
                student: c.studentName || 'Unnamed',
                stage: c.leadStage,
                probability: c.conversionProbability || 0,
                followUpDate: c.followUpDate,
                daysSinceCreated: Math.ceil(
                    (now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24)
                ),
            });
        }
    }

    // Student-side metrics (actual admitted / revenue booked).
    const totalStudentRevenue = students.reduce(
        (s, st) => s + (st.courseFee || 0),
        0
    );
    const avgConversion =
        students.length > 0
            ? Math.round(
                  students.reduce((s, st) => s + (st.conversionTime || 0), 0) /
                      students.length
              )
            : 0;

    const teamName =
        commitments[0]?.teamName ||
        students[0]?.teamName ||
        'Unknown team';
    const resolvedOrg =
        organization ||
        commitments[0]?.organization ||
        students[0]?.organization ||
        'unknown';

    return {
        dateRange: { startDate, endDate },
        consultantName,
        teamName,
        organization: resolvedOrg,
        totalCommitments: commitments.length,
        achieved,
        achievementRate:
            commitments.length > 0
                ? Math.round((achieved / commitments.length) * 100)
                : 0,
        meetings,
        closed,
        commitmentRevenue: revenue,
        studentAdmissions: students.length,
        studentRevenue: totalStudentRevenue,
        avgConversionDays: avgConversion,
        avgProbability:
            probabilityCount > 0
                ? Math.round(probabilitySum / probabilityCount)
                : 0,
        overdueFollowUps,
        leadStages,
        topActiveLeads: activeLeads
            .sort((a, b) => b.probability - a.probability)
            .slice(0, 6),
    };
};

const buildConsultantPrompt = (data) => {
    const systemPrompt = `You are a senior sales-ops coach for an education consultancy. You receive performance data for a SINGLE consultant and produce a tight, personalised coaching brief. Be specific — cite exact numbers, lead stages, and active-lead names. Do NOT fabricate anything. Use markdown with ## headers and bullet points.`;

    const userPrompt = `Analyze the performance of consultant **${data.consultantName}** (team: ${data.teamName}, org: ${data.organization}) for ${data.dateRange.startDate} to ${data.dateRange.endDate}:

PERFORMANCE
- Commitments: ${data.totalCommitments}  •  Achieved: ${data.achieved} (${data.achievementRate}%)
- Meetings Done: ${data.meetings}
- Admissions Closed: ${data.closed}  •  Closed-commitment Revenue: AED ${data.commitmentRevenue.toLocaleString()}
- Student Admissions (closingDate in window): ${data.studentAdmissions}  •  Booked Revenue: AED ${data.studentRevenue.toLocaleString()}
- Avg Conversion Time: ${data.avgConversionDays} days
- Avg Conversion Probability: ${data.avgProbability}%
- Overdue Follow-ups: ${data.overdueFollowUps}
- Lead Stage Distribution: ${JSON.stringify(data.leadStages)}

TOP ACTIVE LEADS (non-closed, sorted by probability):
${
    data.topActiveLeads.length > 0
        ? data.topActiveLeads
              .map(
                  (l) =>
                      `- ${l.student} — stage: ${l.stage || 'unset'}, prob: ${l.probability}%, age: ${l.daysSinceCreated}d${l.followUpDate ? `, follow-up: ${new Date(l.followUpDate).toLocaleDateString()}` : ''}`
              )
              .join('\n')
        : '- (no active leads)'
}

Generate an analysis with EXACTLY these sections in this order. Keep total output under 300 words.

## Snapshot
Two sentences: how this consultant performed in the window overall. Quote the key numbers.

## Strengths
2-3 bullets. What's going well — cite metrics.

## Watch-outs
2-3 bullets. Stalled stages, overdue follow-ups, weak close rate, etc. Cite specifics.

## Next actions
3-4 bullets. Each must be a concrete action tied to a named lead or a specific metric.`;

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
};

// ─── ANALYSIS TARGETS ──────────────────────────────────────
// Returns the list of teams (LUC + Skillhub) and consultants that had
// activity in the [startDate, endDate] window. Used by the admin deep-
// breakdown view to enumerate cards before firing per-target analyses.
const listAnalysisTargets = async (startDate, endDate) => {
    const dateFilter = {
        weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };

    // Teams from commitments (team_lead-scoped) + active team_lead/skillhub
    // users so we still show branches with no commits in the window.
    const [commitments, tlUsers] = await Promise.all([
        Commitment.find(dateFilter)
            .select('teamLead teamName consultantName organization')
            .lean(),
        User.find({
            role: { $in: ['team_lead', 'skillhub'] },
            isActive: { $ne: false },
        })
            .select('name teamName organization')
            .lean(),
    ]);

    const teamMap = new Map();
    for (const u of tlUsers) {
        const key = String(u._id);
        teamMap.set(key, {
            teamLeadId: key,
            teamName: u.teamName || u.name,
            organization: u.organization || 'luc',
            commitments: 0,
        });
    }
    const consultantMap = new Map();
    for (const c of commitments) {
        const tlId = c.teamLead ? String(c.teamLead) : null;
        if (tlId && teamMap.has(tlId)) {
            teamMap.get(tlId).commitments += 1;
        }
        const cName = (c.consultantName || '').trim();
        if (!cName) continue;
        const key = `${cName}__${c.organization || 'luc'}`;
        const row = consultantMap.get(key) || {
            consultantName: cName,
            teamName: c.teamName || '',
            organization: c.organization || 'luc',
            commitments: 0,
        };
        row.commitments += 1;
        consultantMap.set(key, row);
    }

    const teams = [...teamMap.values()].sort((a, b) =>
        a.teamName.localeCompare(b.teamName)
    );
    const consultants = [...consultantMap.values()].sort((a, b) =>
        a.consultantName.localeCompare(b.consultantName)
    );

    return { teams, consultants };
};

module.exports = {
    aggregateAdminData,
    aggregateTeamLeadData,
    aggregateStudentData,
    aggregateConsultantData,
    buildAdminPrompt,
    buildTeamLeadPrompt,
    buildStudentPrompt,
    buildConsultantPrompt,
    generateAnalysis,
    listAnalysisTargets,
};
