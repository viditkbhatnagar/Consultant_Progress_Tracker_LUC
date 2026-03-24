const SLOTS = [
    { id: 's0930', lbl: '9:30', end: '10:30', mins: 60 },
    { id: 's1030', lbl: '10:30', end: '11:30', mins: 60 },
    { id: 's1130', lbl: '11:30', end: '12:30', mins: 60 },
    { id: 's1230', lbl: '12:30', end: '1:00', mins: 30 },
    // lunch is UI-only, not stored in DB
    { id: 's1400', lbl: '2:00', end: '3:00', mins: 60 },
    { id: 's1500', lbl: '3:00', end: '4:00', mins: 60 },
    { id: 's1600', lbl: '4:00', end: '5:00', mins: 60 },
    { id: 's1700', lbl: '5:00', end: '6:00', mins: 60 },
    { id: 's1800', lbl: '6:00', end: '7:00', mins: 60 },
    { id: 's1900', lbl: '7:00', end: '7:30', mins: 30 },
];

const SLOT_IDS = SLOTS.map((s) => s.id);

/**
 * Given a starting slot and a duration in minutes, returns the slot IDs
 * that should be marked as continuation (excluding the starting slot).
 */
function getContinuationSlots(startSlotId, durationMins) {
    const cont = [];
    let idx = SLOTS.findIndex((s) => s.id === startSlotId);
    if (idx === -1) return cont;

    let remaining = durationMins - SLOTS[idx].mins;
    idx++;

    while (remaining > 0 && idx < SLOTS.length) {
        cont.push(SLOTS[idx].id);
        remaining -= SLOTS[idx].mins;
        idx++;
    }

    return cont;
}

module.exports = { SLOTS, SLOT_IDS, getContinuationSlots };
