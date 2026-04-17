// LUC slots — 9:30–7:30 with a 1:00–2:00 lunch gap (UI only, no DB slot)
const SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    // lunch 1:00–2:00 (UI only)
    { id: 's1400', lbl: '2:00', end: '3:00', mins: 60 },
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];

// Skillhub slots — same 9:30–7:30 range but the lunch gap is 2:00–3:00,
// so the 1:00–2:00 hour becomes a working slot (id 's1300') and the 's1400'
// id is dropped (replaced by the lunch gap).
const SKILLHUB_SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    { id: 's1300', lbl: '1:00', end: '2:00', mins: 60 },
    // lunch 2:00–3:00 (UI only)
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];

const SLOT_IDS = SLOTS.map((s) => s.id);
const SKILLHUB_SLOT_IDS = SKILLHUB_SLOTS.map((s) => s.id);
const ALL_SLOT_IDS = [...new Set([...SLOT_IDS, ...SKILLHUB_SLOT_IDS])];

// Activity types
const LUC_ACTIVITY_TYPES = [
    'call',
    'followup',
    'call_followup',
    'noshow',
    'drip',
    'meeting',
    'zoom',
    'outmeet',
    'teammeet',
    'tlmeet',
];

const SKILLHUB_ACTIVITY_TYPES = [
    'sh_call',
    'sh_followup_admission',
    'sh_schedule',
    'sh_break',
    'sh_demo_meeting',
    'sh_meeting',
    'sh_payment_followup',
    'sh_operations',
];

const ALL_ACTIVITY_TYPES = [...LUC_ACTIVITY_TYPES, ...SKILLHUB_ACTIVITY_TYPES];

// Resolve the slot list for a given organization
function getSlotsForOrg(org) {
    if (org === 'skillhub_training' || org === 'skillhub_institute') {
        return SKILLHUB_SLOTS;
    }
    return SLOTS;
}

// Given a starting slot and a duration in minutes, returns the slot IDs that
// should be marked as continuation (excluding the starting slot). Respects the
// org's slot list so Skillhub's 1:00 → 3:00 meeting properly skips the lunch
// gap between slots.
function getContinuationSlots(startSlotId, durationMins, org) {
    const slots = getSlotsForOrg(org);
    const cont = [];
    let idx = slots.findIndex((s) => s.id === startSlotId);
    if (idx === -1) return cont;

    let remaining = durationMins - slots[idx].mins;
    idx++;

    while (remaining > 0 && idx < slots.length) {
        cont.push(slots[idx].id);
        remaining -= slots[idx].mins;
        idx++;
    }

    return cont;
}

module.exports = {
    SLOTS,
    SLOT_IDS,
    SKILLHUB_SLOTS,
    SKILLHUB_SLOT_IDS,
    ALL_SLOT_IDS,
    LUC_ACTIVITY_TYPES,
    SKILLHUB_ACTIVITY_TYPES,
    ALL_ACTIVITY_TYPES,
    getSlotsForOrg,
    getContinuationSlots,
};
