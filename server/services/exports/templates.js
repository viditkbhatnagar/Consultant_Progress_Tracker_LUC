// Pre-built template registry. Plan §8. Each template entry declares the
// dataset, default filters, and a list of sheets — sheets can be `pivot`
// (rowDim/colDim/measure/agg) or `raw` (column subset + optional extra
// match). The controller's runTemplate handler walks this registry, runs
// each sheet's pipeline through the matching builder, and returns a JSON
// envelope the client serializes to xlsx.
//
// Permission model: a template's `roles` array gates which roles may run
// it. Defaults follow the dataset matrix in plan §6.

const TEMPLATES = [
    // ─── LUC Students (admin / team_lead / manager) ───────────────────
    {
        id: 'luc_source_x_month',
        name: 'Source × Month',
        description: 'LUC admissions by Source × Month — count and sum admission fee.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Source × Month (count)',        kind: 'pivot', rowDim: 'source', colDim: 'month', agg: 'count' },
            { name: 'Source × Month (admFee)',       kind: 'pivot', rowDim: 'source', colDim: 'month', agg: 'sum', measure: 'admissionFeePaid' },
        ],
    },
    {
        id: 'luc_team_x_source',
        name: 'Team × Source',
        description: 'LUC admissions by Team Lead × Source — count.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                       kind: 'raw' },
            { name: 'Team Lead × Source (count)', kind: 'pivot', rowDim: 'teamLeadName', colDim: 'source', agg: 'count' },
        ],
    },
    {
        id: 'luc_program_x_university',
        name: 'Program × University',
        description: 'LUC program enrollment matrix by University.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                        kind: 'raw' },
            { name: 'University × Program (count)', kind: 'pivot', rowDim: 'university', colDim: 'program', agg: 'count' },
        ],
    },
    {
        id: 'luc_consultant_x_month',
        name: 'Consultant × Month',
        description: 'LUC admissions by Consultant × Month — count and sum course fee.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                              kind: 'raw' },
            { name: 'Consultant × Month (count)',        kind: 'pivot', rowDim: 'consultantName', colDim: 'month', agg: 'count' },
            { name: 'Consultant × Month (courseFee)',    kind: 'pivot', rowDim: 'consultantName', colDim: 'month', agg: 'sum', measure: 'courseFee' },
        ],
    },
    {
        id: 'luc_conversion_buckets',
        name: 'Conversion Time Buckets',
        description: 'LUC conversion-time distribution by Team Lead.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Bucket × Team Lead (count)',    kind: 'pivot', rowDim: 'conversionBucket', colDim: 'teamLeadName', agg: 'count' },
        ],
    },
    {
        id: 'luc_campaign_performance',
        name: 'Campaign Performance',
        description: 'LUC campaigns by count and admission-fee sum.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Campaign (count)',              kind: 'pivot', rowDim: 'campaignName', agg: 'count' },
            { name: 'Campaign (sum admFee)',         kind: 'pivot', rowDim: 'campaignName', agg: 'sum', measure: 'admissionFeePaid' },
        ],
    },
    {
        id: 'luc_nationality_split',
        name: 'Nationality / Region split',
        description: 'LUC admissions by Nationality × Region.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Nationality × Region (count)',  kind: 'pivot', rowDim: 'nationality', colDim: 'region', agg: 'count' },
        ],
    },
    {
        id: 'luc_open_day_attribution',
        name: 'Open Day Attribution',
        description: 'LUC Open Day funnel — by Open Day × Location.',
        dataset: 'students',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'manager'],
        sheets: [
            { name: 'Data',                                 kind: 'raw' },
            { name: 'OpenDay × Location (count)',           kind: 'pivot', rowDim: 'openDay', colDim: 'openDayLocation', agg: 'count' },
            { name: 'OpenDay × Location (sum admFee)',      kind: 'pivot', rowDim: 'openDay', colDim: 'openDayLocation', agg: 'sum', measure: 'admissionFeePaid' },
        ],
    },

    // ─── Skillhub Students (admin / manager / skillhub) ───────────────
    {
        id: 'skillhub_curriculum_x_grade',
        name: 'Curriculum × Year/Grade',
        description: 'Skillhub students by Curriculum × Year/Grade per branch.',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            { name: 'Data',                              kind: 'raw' },
            { name: 'Curriculum × Year/Grade (count)',   kind: 'pivot', rowDim: 'curriculum', colDim: 'yearOrGrade', agg: 'count' },
        ],
    },
    {
        id: 'skillhub_mode_x_subject',
        name: 'Mode × Subject (subject-enrollment count)',
        description: 'Counts each enrolled subject once. A 3-subject student counts in 3 rows.',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Mode × Subject (count)',        kind: 'pivot', rowDim: 'mode', colDim: 'subjects', agg: 'count' },
        ],
    },
    {
        id: 'skillhub_mode_x_subject_distinct',
        name: 'Mode × Subject (distinct students)',
        description: 'True student counts (a student with N subjects counts once per cell they fall into).',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            { name: 'Data',                              kind: 'raw' },
            { name: 'Mode × Subject (distinct)',         kind: 'pivot', rowDim: 'mode', colDim: 'subjects', agg: 'distinct' },
        ],
    },
    {
        id: 'skillhub_leadsource_x_branch',
        name: 'Lead Source × Branch',
        description: 'Skillhub admissions by Lead Source — count and revenue per branch.',
        dataset: 'students',
        organization: 'all',
        roles: ['admin', 'manager'],
        sheets: [
            { name: 'Data',                                  kind: 'raw' },
            { name: 'Lead Source × Branch (count)',          kind: 'pivot', rowDim: 'organization', colDim: 'consultantName', agg: 'count' },
        ],
    },
    {
        id: 'skillhub_outstanding_by_counselor',
        name: 'Outstanding by Counselor',
        description: 'Skillhub outstanding amount + course fee by counselor.',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            { name: 'Data',                              kind: 'raw' },
            { name: 'Counselor (outstanding)',           kind: 'pivot', rowDim: 'consultantName', agg: 'sum', measure: 'outstandingPerStudent' },
            { name: 'Counselor (course fee)',            kind: 'pivot', rowDim: 'consultantName', agg: 'sum', measure: 'courseFee' },
        ],
    },
    {
        id: 'skillhub_status_funnel',
        name: 'Status Funnel',
        description: 'Skillhub status × curriculum funnel.',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            { name: 'Data',                                  kind: 'raw' },
            { name: 'Status × Curriculum (count)',           kind: 'pivot', rowDim: 'studentStatus', colDim: 'curriculum', agg: 'count' },
        ],
    },
    {
        id: 'skillhub_overdue_emis',
        name: 'Overdue EMIs',
        description: 'Skillhub students with at least one EMI past due (paidOn null AND dueDate in the past).',
        dataset: 'students',
        organization: 'skillhub_training',
        roles: ['admin', 'manager', 'skillhub'],
        sheets: [
            // Raw-only sheet — the pivot dim catalog doesn't include
            // overdueEmiCount, so this template lives outside the standard
            // pivot path. The `overdueOnly` filter is honored post-fetch
            // by runRawQuery (computed from emis[] at request time).
            { name: 'Overdue EMIs', kind: 'raw', filters: { overdueOnly: true } },
        ],
    },

    // ─── Commitments (admin / team_lead / skillhub) ───────────────────
    {
        id: 'commitments_team_x_week_achievement',
        name: 'Team × Week Achievement',
        description: 'Commitments by Team Lead × Week — count + avg achievement %.',
        dataset: 'commitments',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                                       kind: 'raw' },
            { name: 'Team × Week (count)',                        kind: 'pivot', rowDim: 'teamLeadName', colDim: 'weekStartDateWeek', agg: 'count' },
            { name: 'Team × Week (avg achievement %)',            kind: 'pivot', rowDim: 'teamLeadName', colDim: 'weekStartDateWeek', agg: 'avg', measure: 'achievementPercentage' },
        ],
    },
    {
        id: 'commitments_consultant_funnel',
        name: 'Consultant Lead-Stage Funnel',
        description: 'Commitments by Consultant × Lead Stage.',
        dataset: 'commitments',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                                  kind: 'raw' },
            { name: 'Consultant × Lead Stage (count)',       kind: 'pivot', rowDim: 'consultantName', colDim: 'leadStage', agg: 'count' },
        ],
    },
    {
        id: 'commitments_closed_by_week',
        name: 'Closed Admissions by Week',
        description: 'Commitments by Week × Admission Closed — count + sum closed amount.',
        dataset: 'commitments',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                                          kind: 'raw' },
            { name: 'Week × Closed (count)',                         kind: 'pivot', rowDim: 'weekStartDateWeek', colDim: 'admissionClosed', agg: 'count' },
            { name: 'Week × Closed (sum closedAmount)',              kind: 'pivot', rowDim: 'weekStartDateWeek', colDim: 'admissionClosed', agg: 'sum', measure: 'closedAmount' },
        ],
    },
    {
        id: 'commitments_missed_reasons',
        name: 'Missed Commitments — Reasons',
        description: 'Missed commitments grouped by reason × team.',
        dataset: 'commitments',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                                  kind: 'raw',   filters: { status: 'missed' } },
            { name: 'Reason × Team (count)',                 kind: 'pivot', rowDim: 'leadStage', colDim: 'teamLeadName', agg: 'count', filters: { status: 'missed' } },
        ],
    },

    // ─── Meetings (admin / team_lead) ─────────────────────────────────
    {
        id: 'meetings_mode_x_status',
        name: 'Mode × Status',
        description: 'Meetings count by Mode × Status.',
        dataset: 'meetings',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Mode × Status (count)',         kind: 'pivot', rowDim: 'mode', colDim: 'status', agg: 'count' },
        ],
    },
    {
        id: 'meetings_consultant_productivity',
        name: 'Consultant Productivity',
        description: 'Meetings count by Consultant.',
        dataset: 'meetings',
        organization: 'luc',
        roles: ['admin', 'team_lead'],
        sheets: [
            { name: 'Data',                          kind: 'raw' },
            { name: 'Consultant (count)',            kind: 'pivot', rowDim: 'consultantName', agg: 'count' },
            { name: 'Consultant × Mode (count)',     kind: 'pivot', rowDim: 'consultantName', colDim: 'mode', agg: 'count' },
        ],
    },

    // ─── Hourly (admin / team_lead / skillhub) ────────────────────────
    {
        id: 'hourly_activity_heatmap',
        name: 'Activity-Type Heatmap',
        description: 'Hourly activities by Slot × Activity Type.',
        dataset: 'hourly',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'skillhub'],
        sheets: [
            { name: 'Data',                                  kind: 'raw' },
            { name: 'Slot × Activity Type (count)',          kind: 'pivot', rowDim: 'slotId', colDim: 'activityType', agg: 'count' },
        ],
    },
    {
        id: 'hourly_calls_vs_meetings_30d',
        name: 'Calls vs Meetings — last 30 days',
        description: 'Activity counts by activity type for the last 30 days.',
        dataset: 'hourly',
        organization: 'luc',
        roles: ['admin', 'team_lead', 'skillhub'],
        defaultDateRange: 'last_30_days',
        sheets: [
            { name: 'Data',                                  kind: 'raw' },
            { name: 'Activity Type (count)',                 kind: 'pivot', rowDim: 'activityType', agg: 'count' },
        ],
    },

    // ─── Cross-org (admin / manager) ──────────────────────────────────
    {
        id: 'crossorg_admissions_by_org_x_month',
        name: 'Cross-org: Admissions by Org × Month',
        description: 'Admissions count across LUC + Skillhub branches by createdAt month.',
        dataset: 'students',
        organization: 'all',
        roles: ['admin', 'manager'],
        sheets: [
            { name: 'Data',                                          kind: 'raw' },
            { name: 'Organization × Month (count)',                  kind: 'pivot', rowDim: 'organization', colDim: 'createdAtMonth', agg: 'count' },
        ],
    },
    {
        id: 'crossorg_revenue_by_org_x_quarter',
        name: 'Cross-org: Revenue by Org × Quarter',
        description: 'Course fee + admission fee summed across all orgs by createdAt quarter.',
        dataset: 'students',
        organization: 'all',
        roles: ['admin', 'manager'],
        sheets: [
            { name: 'Data',                                              kind: 'raw' },
            { name: 'Org × Quarter (sum courseFee)',                     kind: 'pivot', rowDim: 'organization', colDim: 'createdAtQuarter', agg: 'sum', measure: 'courseFee' },
            { name: 'Org × Quarter (sum admFee)',                        kind: 'pivot', rowDim: 'organization', colDim: 'createdAtQuarter', agg: 'sum', measure: 'admissionFeePaid' },
        ],
    },
    {
        id: 'crossorg_consultant_leaderboard',
        name: 'Cross-org: Consultant Leaderboard',
        description: 'Top consultants by admissions across all orgs.',
        dataset: 'students',
        organization: 'all',
        roles: ['admin', 'manager'],
        sheets: [
            { name: 'Data',                                          kind: 'raw' },
            { name: 'Consultant × Org (count)',                      kind: 'pivot', rowDim: 'consultantName', colDim: 'organization', agg: 'count' },
            { name: 'Consultant × Org (sum admFee)',                 kind: 'pivot', rowDim: 'consultantName', colDim: 'organization', agg: 'sum', measure: 'admissionFeePaid' },
        ],
    },
];

const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

function listForRole(user) {
    if (!user) return [];
    return TEMPLATES.filter((t) => t.roles.includes(user.role));
}

function findById(templateId) {
    return TEMPLATE_BY_ID[templateId] || null;
}

module.exports = {
    TEMPLATES,
    listForRole,
    findById,
};
