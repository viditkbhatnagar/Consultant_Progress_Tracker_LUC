// Column config for the meetings dataset. New file (no legacy export to lift
// from on MeetingTrackerPage). Surface fields that match what the page
// already shows in its table view.

export const meetingsColumns = [
    { key: 'meetingDate', lbl: 'Meeting Date', date: true, defaultExport: true },
    { key: 'studentName', lbl: 'Student', defaultExport: true },
    { key: 'program', lbl: 'Program', defaultExport: true },
    { key: 'mode', lbl: 'Mode', defaultExport: true },
    { key: 'status', lbl: 'Status', defaultExport: true },
    { key: 'teamLeadName', lbl: 'Team Lead', defaultExport: true },
    { key: 'consultantName', lbl: 'Consultant', defaultExport: true },
    {
        key: 'remarks',
        lbl: 'Remarks',
        format: (r) => r.remarks || '',
        defaultExport: true,
    },
];

export default meetingsColumns;
