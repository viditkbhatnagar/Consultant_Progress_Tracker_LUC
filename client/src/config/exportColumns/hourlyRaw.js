// Raw-doc column config for Export Center → Hourly → Raw tab.
// Different shape from hourlyDaily/hourlyMonthly — this is one row per
// HourlyActivity (or per element of activities[] for multi-activity docs),
// not a per-consultant-per-day rollup.

export const hourlyRawColumns = [
    { key: 'date',           lbl: 'Date',           date: true, defaultExport: true },
    { key: 'consultantName', lbl: 'Consultant',                 defaultExport: true },
    { key: 'teamName',       lbl: 'Team',                       defaultExport: true },
    { key: 'organization',   lbl: 'Organization',               defaultExport: true },
    { key: 'slotId',         lbl: 'Slot',                       defaultExport: true },
    { key: 'activityType',   lbl: 'Activity Type',              defaultExport: true },
    { key: 'count',          lbl: 'Count',                      defaultExport: true },
    { key: 'followupCount',  lbl: 'Follow-up Count',            defaultExport: true },
    { key: 'duration',       lbl: 'Duration (mins)',            defaultExport: true },
    {
        key: 'note',
        lbl: 'Note',
        format: (r) => r.note || '',
        defaultExport: true,
    },
];

export default hourlyRawColumns;
