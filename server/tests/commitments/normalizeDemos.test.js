// Unit specs for the Skillhub demo-slot normalizer, focused on the new
// per-demo `demoDoneBy` (Institute "Demo done by" teacher) passthrough and the
// existing done/scheduled invariants it must not regress.

const { normalizeDemos } = require('../../controllers/commitmentController');

describe('normalizeDemos — demoDoneBy passthrough', () => {
    test('persists a trimmed demoDoneBy per slot', () => {
        const res = normalizeDemos([
            { slot: 'Demo 1', scheduledAt: '2026-07-20T10:00:00Z', demoDoneBy: '  Fahad  ' },
        ]);
        expect(res.ok).toBe(true);
        expect(res.demos).toHaveLength(1);
        expect(res.demos[0].demoDoneBy).toBe('Fahad');
    });

    test('defaults demoDoneBy to an empty string when absent', () => {
        const res = normalizeDemos([{ slot: 'Demo 2', notes: 'call parent' }]);
        expect(res.demos[0].demoDoneBy).toBe('');
    });

    test('carries demoDoneBy across all four slots independently', () => {
        const res = normalizeDemos([
            { slot: 'Demo 1', demoDoneBy: 'Fahad' },
            { slot: 'Demo 2', demoDoneBy: 'Rehana' },
            { slot: 'Demo 3' },
        ]);
        const byslot = Object.fromEntries(res.demos.map((d) => [d.slot, d.demoDoneBy]));
        expect(byslot).toEqual({ 'Demo 1': 'Fahad', 'Demo 2': 'Rehana', 'Demo 3': '' });
    });

    test('a demo carrying only demoDoneBy still normalizes (no scheduled/notes needed)', () => {
        const res = normalizeDemos([{ slot: 'Demo 1', demoDoneBy: 'Fahad' }]);
        expect(res.ok).toBe(true);
        expect(res.demos[0].demoDoneBy).toBe('Fahad');
        expect(res.demos[0].done).toBe(false);
    });

    test('still rejects Done without a scheduled time (invariant preserved)', () => {
        const res = normalizeDemos([{ slot: 'Demo 1', done: true, demoDoneBy: 'Fahad' }]);
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/cannot be marked Done without a scheduled time/i);
    });
});
