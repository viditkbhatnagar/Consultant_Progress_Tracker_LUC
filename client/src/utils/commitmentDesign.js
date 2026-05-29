// Visual helpers shared across the redesigned Commitment Tracker views.
// Mirrors utils/meetingDesign.js so the two trackers feel consistent.

import { alpha } from '@mui/material/styles';
import { LEAD_STAGES, getLeadStageColor } from './constants';

export const ALL_LEAD_STAGES = LEAD_STAGES
    .map((s) => s.value)
    .filter((v) => v !== 'Meeting Scheduled');

// Board-specific ordering: pin Admission and Awaiting Confirmation first
// (same rule as the Meetings board) then the rest in LEAD_STAGES order.
const BOARD_LEAD = ['Admission', 'Awaiting Confirmation'];
export const BOARD_STAGE_ORDER = [
    ...BOARD_LEAD.filter((s) => ALL_LEAD_STAGES.includes(s)),
    ...ALL_LEAD_STAGES.filter((s) => !BOARD_LEAD.includes(s)),
];

// Derived pill palette from existing LEAD_STAGES base color.
export const getStagePalette = (stage) => {
    const base = getLeadStageColor(stage);
    return {
        bg: alpha(base, 0.14),
        fg: base,
        dot: base,
    };
};

// Commitment workflow status (pending / in_progress / achieved / missed)
// has a separate palette.
export const STATUS_META = {
    pending: { label: 'Pending', color: '#94A3B8' },
    in_progress: { label: 'In Progress', color: '#2563EB' },
    achieved: { label: 'Achieved', color: '#16A34A' },
    missed: { label: 'Missed', color: '#DC2626' },
};

// Stages counted as admissions for KPIs.
export const ADMISSION_STAGES = ['Admission', 'CIF'];
// Stages indicating active follow-up work in the pipeline.
export const FOLLOW_UP_STAGES = [
    'Warm',
    'Hot',
    'Offer Sent',
    'Awaiting Confirmation',
];

export const formatDDMMYYYY = (dateLike) => {
    if (!dateLike) return '';
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};

// "April W5" for a commitment. A commitment belongs to the MONTH of its
// WEEK's Thursday (ISO 8601 convention), anchored to the week-start
// (Monday). So a week that straddles a month boundary (e.g. Apr 27–May 3)
// is attributed to the month holding most of it (April) — fixing the
// "April admission showing up in May" bug, where the label was previously
// taken from the raw commitmentDate (which can be the logging day, May 1).
// Dates are read in local time to match how week-start is stored
// (org-local Monday midnight) and the single timezone the app runs in.
export const formatWeekOfMonth = (commitmentDate, weekStartDate) => {
    const anchor = weekStartDate || commitmentDate;
    if (!anchor) return '';
    const start = new Date(anchor);
    if (Number.isNaN(start.getTime())) return '';
    const dow = (start.getDay() + 6) % 7; // 0 = Monday
    const mon = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dow);
    const thu = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dow + 3);
    // Month = the week's Thursday (ISO). Week number = which Monday-week of
    // that month (1st–7th → W1 … 22nd–28th → W4). A week whose Monday spills
    // from the previous month is W1 of the Thursday's month. This caps at W4
    // — never W5.
    const weekOfMonth = mon.getMonth() === thu.getMonth() ? Math.ceil(mon.getDate() / 7) : 1;
    return `${thu.toLocaleString('en-US', { month: 'long' })} W${weekOfMonth}`;
};

// Derive the best date a commitment is anchored to for display.
export const displayDate = (commitment) =>
    commitment?.commitmentDate || commitment?.createdAt || commitment?.weekStartDate;
