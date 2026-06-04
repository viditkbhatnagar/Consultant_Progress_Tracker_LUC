// Unit tests for the Hourly Tracker "team-lead self-consultant" guard.
//
// A team lead has a Consultant doc named after themselves (their personal-sales
// row). Those self-consultants must be hidden from the Hourly Tracker — grid,
// AI analysis, and leaderboards — without deleting them. The guard identifies
// them by matching the consultant's name to its OWN team lead's name
// (case-insensitive, trimmed). See hourlyController + fixTeamLeadSelfConsultants.js.

const {
    isTeamLeadSelfConsultant,
    excludeSelfConsultants,
} = require('../../controllers/hourlyController');

// Minimal populated-consultant shape: { name, teamLead: { name } }.
const consultant = (name, leadName) => ({
    name,
    teamLead: leadName === undefined ? null : { name: leadName },
});

describe('isTeamLeadSelfConsultant', () => {
    test('flags a consultant whose name equals its team lead name', () => {
        expect(isTeamLeadSelfConsultant(consultant('Tony', 'Tony'))).toBe(true);
    });

    test('match is case-insensitive and trims whitespace', () => {
        expect(isTeamLeadSelfConsultant(consultant('  tony ', 'TONY'))).toBe(true);
        expect(isTeamLeadSelfConsultant(consultant('Manoj', '  manoj'))).toBe(true);
    });

    test('keeps a normal consultant on the lead team', () => {
        expect(isTeamLeadSelfConsultant(consultant('Elizabeth', 'Tony'))).toBe(false);
    });

    test('keeps a consultant who shares a name with a DIFFERENT lead', () => {
        // "Tony" works under lead "Manoj" — not a self-consultant of Manoj.
        expect(isTeamLeadSelfConsultant(consultant('Tony', 'Manoj'))).toBe(false);
    });

    test('treats unpopulated / ownerless teamLead as a normal consultant', () => {
        expect(isTeamLeadSelfConsultant(consultant('Tony', undefined))).toBe(false);
        expect(isTeamLeadSelfConsultant({ name: 'Tony', teamLead: {} })).toBe(false);
        expect(isTeamLeadSelfConsultant({ name: 'Tony' })).toBe(false);
    });

    test('handles a missing consultant name safely', () => {
        expect(isTeamLeadSelfConsultant({ teamLead: { name: 'Tony' } })).toBe(false);
        expect(isTeamLeadSelfConsultant(null)).toBe(false);
    });
});

describe('excludeSelfConsultants', () => {
    test('removes only the self-consultant rows, preserving order', () => {
        const list = [
            consultant('Tony', 'Tony'),       // self -> drop
            consultant('Elizabeth', 'Tony'),  // keep
            consultant('Manoj', 'Manoj'),     // self -> drop
            consultant('Shahal', 'Manoj'),    // keep
            consultant('Tony', 'Manoj'),      // shares name with another lead -> keep
        ];
        const result = excludeSelfConsultants(list);
        expect(result.map((c) => c.name)).toEqual(['Elizabeth', 'Shahal', 'Tony']);
    });

    test('returns an empty list when every row is a self-consultant', () => {
        const list = [consultant('Tony', 'Tony'), consultant('Manoj', 'Manoj')];
        expect(excludeSelfConsultants(list)).toEqual([]);
    });

    test('returns the list unchanged when there are no self-consultants', () => {
        const list = [consultant('Elizabeth', 'Tony'), consultant('Shahal', 'Manoj')];
        expect(excludeSelfConsultants(list)).toHaveLength(2);
    });
});
