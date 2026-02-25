const OpenAI = require('openai');
const Commitment = require('../models/Commitment');
const Student = require('../models/Student');

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

// Aggregate organization-wide data for admin analysis
const aggregateAdminData = async (startDate, endDate) => {
    const dateFilter = {
        weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    };

    const commitments = await Commitment.find(dateFilter)
        .populate('teamLead', 'name teamName')
        .lean();

    // Student data for the same period (by closingDate)
    const students = await Student.find({
        closingDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    }).lean();

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

module.exports = {
    aggregateAdminData,
    aggregateTeamLeadData,
    buildAdminPrompt,
    buildTeamLeadPrompt,
    generateAnalysis,
};
