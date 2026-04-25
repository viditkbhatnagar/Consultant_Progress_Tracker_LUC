// Daily-view column config for the Hourly Tracker page. Slot columns are
// dynamic (LUC has 10 active slots, Skillhub has 11 incl. lunch), so this
// is a factory rather than a static array. Lifted from the inline logic in
// HourlyTrackerPage.handleExport (lines 612–642).

export function buildHourlyDailyColumns(slots) {
    const slotColumns = (slots || []).filter((s) => !s.isLunch).map((s) => ({
        key: `slot_${s.id}`,
        lbl: `${s.lbl}-${s.end}`,
        defaultExport: true,
    }));
    return [
        { key: 'rowIndex', lbl: '#', format: (_r, i) => i + 1, defaultExport: true },
        { key: 'consultantName', lbl: 'Consultant', defaultExport: true },
        ...slotColumns,
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
        { key: 'reference',   lbl: 'Reference',       defaultExport: true },
        { key: 'admissions',  lbl: 'Admissions',      defaultExport: true },
    ];
}

export default buildHourlyDailyColumns;
