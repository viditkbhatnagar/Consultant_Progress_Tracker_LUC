// Column config for the commitments dataset. Lifted from
// `exportService.exportCommitmentsToExcel` (lines 6–61 of the legacy
// service). Achievement % moves into a column-level `format` callback so
// it's no longer hardcoded inside the export helper.

export const commitmentsColumns = [
    { key: 'weekNumber', lbl: 'Week', defaultExport: true },
    { key: 'year', lbl: 'Year', defaultExport: true },
    {
        key: 'consultantName',
        lbl: 'Consultant',
        format: (r) => r.consultantName || 'N/A',
        defaultExport: true,
    },
    { key: 'teamName', lbl: 'Team', defaultExport: true },
    {
        key: 'studentName',
        lbl: 'Student Name',
        format: (r) => r.studentName || 'N/A',
        defaultExport: true,
    },
    { key: 'dayCommitted', lbl: 'Day Committed', defaultExport: true },
    { key: 'commitmentMade', lbl: 'Commitment', defaultExport: true },
    { key: 'leadStage', lbl: 'Lead Stage', defaultExport: true },
    {
        key: 'conversionProbability',
        lbl: 'Conversion Probability',
        format: (r) =>
            r.conversionProbability != null ? `${r.conversionProbability}%` : 'N/A',
        defaultExport: true,
    },
    {
        key: 'meetingsDone',
        lbl: 'Meetings Done',
        format: (r) => r.meetingsDone || 0,
        defaultExport: true,
    },
    {
        key: 'achievementPct',
        lbl: 'Achievement %',
        // Mirrors the legacy inline computation; one place to evolve when
        // the rule changes.
        format: (r) => (r.status === 'achieved' || r.admissionClosed ? 100 : 0),
        defaultExport: true,
    },
    { key: 'status', lbl: 'Status', defaultExport: true },
    {
        key: 'admissionClosed',
        lbl: 'Admission Closed',
        format: (r) => (r.admissionClosed ? 'Yes' : 'No'),
        defaultExport: true,
    },
    { key: 'closedDate', lbl: 'Closed Date', date: true, defaultExport: true },
    { key: 'followUpDate', lbl: 'Follow-up Date', date: true, defaultExport: true },
    {
        key: 'correctiveActionByTL',
        lbl: 'Corrective Action',
        format: (r) => r.correctiveActionByTL || 'N/A',
        defaultExport: true,
    },
    {
        key: 'prospectForWeek',
        lbl: 'Prospect Rating',
        format: (r) => r.prospectForWeek || 'N/A',
        defaultExport: true,
    },
];

export default commitmentsColumns;
