// Org-aware hourly-tracker config.
// Mirrors server/utils/hourlyConstants.js so the UI slot list / activity list
// matches the shapes the backend accepts.

import { ORGANIZATIONS } from './constants';

const LUC_SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    // lunch 1:00 – 2:00 (UI-only gap)
    { id: 's1400', lbl: '2:00', end: '3:00', mins: 60 },
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];

const SKILLHUB_SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    { id: 's1300', lbl: '1:00', end: '2:00', mins: 60 },
    // lunch 2:00 – 3:00 (UI-only gap)
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];

// Lunch-gap metadata — rendered as a UI-only block between working slots.
const LUC_LUNCH = { lbl: '1:00 – 2:00 PM', note: 'Lunch Break' };
const SKILLHUB_LUNCH = { lbl: '2:00 – 3:00 PM', note: 'Lunch Break' };

// Activity types with display metadata. Colors loosely follow the LUC palette
// so the grid feels familiar to Skillhub users switching over.
const LUC_ACTIVITIES = [
    { slug: 'call', label: 'Call', color: '#2563eb', allowsDuration: false, hasCount: true },
    { slug: 'followup', label: 'Follow-up', color: '#0891b2', allowsDuration: false, hasCount: true },
    { slug: 'call_followup', label: 'Call + Follow-up', color: '#0d9488', allowsDuration: false, hasCount: true },
    { slug: 'noshow', label: 'Operations', color: '#dc2626', allowsDuration: false, hasCount: false },
    { slug: 'drip', label: 'Drip', color: '#d97706', allowsDuration: false, hasCount: false },
    { slug: 'meeting', label: 'Offline Meeting', color: '#16a34a', allowsDuration: true, hasCount: false },
    { slug: 'zoom', label: 'Zoom Meeting', color: '#4f46e5', allowsDuration: true, hasCount: false },
    { slug: 'outmeet', label: 'Out Meeting', color: '#7c3aed', allowsDuration: true, hasCount: false },
    { slug: 'teammeet', label: 'Team Meeting', color: '#0d9488', allowsDuration: true, hasCount: false },
    { slug: 'tlmeet', label: "TL's Meeting", color: '#be185d', allowsDuration: true, hasCount: false },
];

const SKILLHUB_ACTIVITIES = [
    { slug: 'sh_call', label: 'Calling', color: '#2563eb', allowsDuration: false, hasCount: true },
    { slug: 'sh_followup_admission', label: 'Follow up — Admission', color: '#0891b2', allowsDuration: false, hasCount: true },
    { slug: 'sh_schedule', label: 'Schedule', color: '#4f46e5', allowsDuration: false, hasCount: false },
    { slug: 'sh_break', label: 'Break', color: '#64748b', allowsDuration: false, hasCount: false },
    { slug: 'sh_demo_meeting', label: 'Demo Meeting', color: '#16a34a', allowsDuration: true, hasCount: false },
    { slug: 'sh_meeting', label: 'Meeting', color: '#0d9488', allowsDuration: true, hasCount: false },
    { slug: 'sh_payment_followup', label: 'Payment Follow-up', color: '#7c3aed', allowsDuration: false, hasCount: true },
    { slug: 'sh_operations', label: 'Operations', color: '#dc2626', allowsDuration: false, hasCount: false },
];

// Merged indexable map so any activity slug (LUC or Skillhub) can be looked up
// in one place — useful when an admin is viewing mixed-org data.
const ACTIVITY_LOOKUP = [...LUC_ACTIVITIES, ...SKILLHUB_ACTIVITIES].reduce(
    (acc, a) => {
        acc[a.slug] = a;
        return acc;
    },
    {}
);

export const isSkillhubOrg = (org) =>
    org === ORGANIZATIONS.SKILLHUB_TRAINING ||
    org === ORGANIZATIONS.SKILLHUB_INSTITUTE;

export const getSlotsForOrg = (org) =>
    isSkillhubOrg(org) ? SKILLHUB_SLOTS : LUC_SLOTS;

export const getActivitiesForOrg = (org) =>
    isSkillhubOrg(org) ? SKILLHUB_ACTIVITIES : LUC_ACTIVITIES;

export const getLunchGapForOrg = (org) =>
    isSkillhubOrg(org) ? SKILLHUB_LUNCH : LUC_LUNCH;

export const getActivityMeta = (slug) =>
    ACTIVITY_LOOKUP[slug] || { slug, label: slug, color: '#64748b' };

export const getActivityLabel = (slug) => getActivityMeta(slug).label;
export const getActivityColor = (slug) => getActivityMeta(slug).color;

// Resolve the view org for the tracker page:
// - admin uses the global admin scope
// - others use their own user.organization
export const resolveViewOrg = (user, adminScope) => {
    if (user?.role === 'admin') return adminScope || 'luc';
    return user?.organization || 'luc';
};
