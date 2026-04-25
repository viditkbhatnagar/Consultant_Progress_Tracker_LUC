// Monthly-view column config for the Hourly Tracker page. Lifted from
// HourlyTrackerPage.handleExport (lines 644–666).

export const hourlyMonthlyColumns = [
    { key: 'rowIndex', lbl: '#', format: (_r, i) => i + 1, defaultExport: true },
    {
        key: 'consultantName',
        lbl: 'Consultant',
        format: (r) => r.consultant?.name || r.consultantName || '',
        defaultExport: true,
    },
    { key: 'calls',       lbl: 'Calls',           format: (r) => r.calls || '',       defaultExport: true },
    { key: 'followups',   lbl: 'Follow-Ups',      format: (r) => r.followups || '',   defaultExport: true },
    { key: 'noshows',     lbl: 'Operations',      format: (r) => r.noshows || '',     defaultExport: true },
    { key: 'drips',       lbl: 'Drips',           format: (r) => r.drips || '',       defaultExport: true },
    { key: 'offlineMtgs', lbl: 'Offline Meeting', format: (r) => r.offlineMtgs || '', defaultExport: true },
    { key: 'zoomMtgs',    lbl: 'Zoom',            format: (r) => r.zoomMtgs || '',    defaultExport: true },
    { key: 'outMtgs',     lbl: 'Out Meeting',     format: (r) => r.outMtgs || '',     defaultExport: true },
    { key: 'teamMtgs',    lbl: 'Team Meeting',    format: (r) => r.teamMtgs || '',    defaultExport: true },
    { key: 'tlMtgs',      lbl: "TL's Team Meeting", format: (r) => r.tlMtgs || '',    defaultExport: true },
    { key: 'meetHrs',     lbl: 'Meeting Hours',   format: (r) => (r.meetHrs ? `${r.meetHrs}h` : ''), defaultExport: true },
    { key: 'references',  lbl: 'Reference',       format: (r) => r.references || '',  defaultExport: true },
    { key: 'admissions',  lbl: 'Admissions',      format: (r) => r.admissions || '',  defaultExport: true },
    { key: 'days',        lbl: 'Days Active',     format: (r) => r.days || '',        defaultExport: true },
];

export default hourlyMonthlyColumns;
