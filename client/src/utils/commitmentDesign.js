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

// "April W4" from a date. Matches formatWeekOfMonth in weekUtils but keeps
// this module self-contained.
export const formatWeekOfMonth = (primary, fallback) => {
    const source = primary || fallback;
    if (!source) return '';
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) return '';
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    const weekOfMonth = Math.ceil(d.getDate() / 7);
    return `${monthName} W${weekOfMonth}`;
};

// Derive the best date a commitment is anchored to for display.
export const displayDate = (commitment) =>
    commitment?.commitmentDate || commitment?.createdAt || commitment?.weekStartDate;
