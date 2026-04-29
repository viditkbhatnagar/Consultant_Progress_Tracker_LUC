// Visual helpers for the redesigned Meeting Tracker. Everything here is pure
// and framework-agnostic so it can be shared across components.

import { alpha } from '@mui/material/styles';
import {
    Videocam as VideocamIcon,
    DirectionsCar as DirectionsCarIcon,
    Business as BusinessIcon,
    School as SchoolIcon,
} from '@mui/icons-material';
import { LEAD_STAGES, getLeadStageColor } from './constants';

// Deterministic hash → hue so the same name always gets the same avatar.
const hashHue = (name = '') => {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = (h * 31 + name.charCodeAt(i)) % 360;
    }
    return h;
};

export const avatarColor = (name) => {
    const h = hashHue(name);
    return {
        bg: `hsl(${h}, 55%, 92%)`,
        fg: `hsl(${h}, 45%, 32%)`,
    };
};

export const initials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Status pill palette — derived from LEAD_STAGES colors in constants.js so
// any new lead stage automatically gets a matching pill/board-column.
export const getStatusPalette = (status) => {
    const base = getLeadStageColor(status);
    return {
        bg: alpha(base, 0.14),
        fg: base,
        dot: base,
    };
};

// Meeting mode → icon + tint. Aligns with the MODE_ICONS used across the
// app; centralized here so cards / table / drawer stay consistent.
export const MODE_META = {
    Zoom: { Icon: VideocamIcon, color: '#4f46e5' },
    'Out Meeting': { Icon: DirectionsCarIcon, color: '#7c3aed' },
    'Office Meeting': { Icon: BusinessIcon, color: '#16a34a' },
    'Student Meeting': { Icon: SchoolIcon, color: '#ea580c' },
};

export const formatDDMMYYYY = (dateLike) => {
    if (!dateLike) return '';
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
};

// Short id badge — last 4 chars of the Mongo ObjectId.
export const shortId = (id) => {
    if (!id) return '';
    return String(id).slice(-4);
};

// All status values. Pulled from LEAD_STAGES so any enum change flows through.
export const ALL_STATUSES = LEAD_STAGES
    .map((s) => s.value)
    .filter((v) => v !== 'Meeting Scheduled');

// Board-specific ordering: Admission and Awaiting Confirmation pinned to the
// front, then the rest in their natural LEAD_STAGES order.
const BOARD_LEAD = ['Admission', 'Awaiting Confirmation'];
export const BOARD_STATUS_ORDER = [
    ...BOARD_LEAD.filter((s) => ALL_STATUSES.includes(s)),
    ...ALL_STATUSES.filter((s) => !BOARD_LEAD.includes(s)),
];

// Statuses treated as "follow-up" for the KPI card — loose mapping of our
// real funnel stages to the design's "Warm + Awaiting" concept.
export const FOLLOW_UP_STATUSES = [
    'Warm',
    'Hot',
    'Offer Sent',
    'Awaiting Confirmation',
];

// Statuses counted as successful conversions for the Conversion KPI.
// CIF is post-admission paperwork, not a fresh closed admission, so it's
// excluded — admin verified that "X admissions" should only count rows at
// status='Admission'. Bundling them inflated the conversion rate (a TL
// with 4 CIFs and 1 Admission across 10 meetings was showing 50%/5
// admissions when it should be 10%/1 admission).
export const CONVERSION_STATUSES = ['Admission'];
