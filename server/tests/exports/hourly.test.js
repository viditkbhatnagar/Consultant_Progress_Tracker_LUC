// Hourly pivot spec — covers the flat-vs-array shape normalization (plan
// §13.3). Fixture has both legacy single-activity docs AND multi-activity
// `activities[]` docs to exercise the `_items` $cond path.

const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
    makeAdmin,
} = require('./_setup');

require('../../models/HourlyActivity');
const builder = require('../../services/exports/pivots/hourly');
const mongoose = require('mongoose');

beforeAll(async () => {
    await startInMemoryMongo();
});
afterAll(async () => {
    await stopInMemoryMongo();
});

const C1 = new mongoose.Types.ObjectId();
const C2 = new mongoose.Types.ObjectId();

const FIXTURE = [
    // Flat shape (legacy LUC docs).
    { consultant: C1, organization: 'luc', date: '2026-04-15', slotId: 's0930', activityType: 'call',     count: 4, duration: 60, activities: [] },
    { consultant: C1, organization: 'luc', date: '2026-04-15', slotId: 's1030', activityType: 'followup', count: 3, duration: 60, activities: [] },
    { consultant: C2, organization: 'luc', date: '2026-04-15', slotId: 's0930', activityType: 'call',     count: 2, duration: 60, activities: [] },
    { consultant: C2, organization: 'luc', date: '2026-04-15', slotId: 's1030', activityType: 'meeting',  count: 1, duration: 60, activities: [] },

    // Array shape (Skillhub multi-activity in one slot). Two activities in
    // one doc — should expand into 2 rows post-unwind.
    {
        consultant: C1,
        organization: 'skillhub_training',
        date: '2026-04-16',
        slotId: 's1130',
        activityType: 'sh_call',
        count: 1,
        duration: 30,
        activities: [
            { activityType: 'sh_call',               count: 5, duration: 20 },
            { activityType: 'sh_followup_admission', count: 2, duration: 10 },
        ],
    },
];

beforeEach(async () => {
    await clearAllCollections();
    await insertRaw('HourlyActivity', FIXTURE);
});

const findRow = (totals, row) => totals.find((t) => t.row === row)?.value ?? 0;

describe('Hourly pivot — activityType normalizer', () => {
    test('LUC orgScope: flat docs count by activityType normally', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'activityType',
            agg: 'count',
        });
        expect(findRow(r.rowTotals, 'call')).toBe(2);
        expect(findRow(r.rowTotals, 'followup')).toBe(1);
        expect(findRow(r.rowTotals, 'meeting')).toBe(1);
        expect(r.grandTotal).toBe(4);
    });

    test('Skillhub orgScope: activities[] expands into one row per activity', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'skillhub_training',
            filters: {},
            rowDim: 'activityType',
            agg: 'count',
        });
        // The single doc has two entries in activities[] — sh_call AND
        // sh_followup_admission. The doc-level activityType ('sh_call') is
        // ignored once activities[] is non-empty.
        expect(findRow(r.rowTotals, 'sh_call')).toBe(1);
        expect(findRow(r.rowTotals, 'sh_followup_admission')).toBe(1);
        expect(r.grandTotal).toBe(2);
    });

    test('agg=sum, measure=sumCount uses normalized count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'skillhub_training',
            filters: {},
            rowDim: 'activityType',
            measure: 'sumCount',
            agg: 'sum',
        });
        // sh_call: 5 (from activities[0]). sh_followup_admission: 2.
        expect(findRow(r.rowTotals, 'sh_call')).toBe(5);
        expect(findRow(r.rowTotals, 'sh_followup_admission')).toBe(2);
        expect(r.grandTotal).toBe(7);
    });

    test('agg=sum, measure=duration uses normalized duration', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'skillhub_training',
            filters: {},
            rowDim: 'activityType',
            measure: 'duration',
            agg: 'sum',
        });
        expect(findRow(r.rowTotals, 'sh_call')).toBe(20);
        expect(findRow(r.rowTotals, 'sh_followup_admission')).toBe(10);
        expect(r.grandTotal).toBe(30);
    });

    test('rowDim=slotId, colDim=activityType yields a heatmap-style matrix', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'slotId',
            colDim: 'activityType',
            agg: 'count',
        });
        const cell = (row, col) => r.cells.find((x) => x.row === row && x.col === col)?.value ?? 0;
        expect(cell('s0930', 'call')).toBe(2);
        expect(cell('s1030', 'followup')).toBe(1);
        expect(cell('s1030', 'meeting')).toBe(1);
        expect(r.grandTotal).toBe(4);
    });

    test('agg=avg is rejected for hourly (only count + sum supported)', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                rowDim: 'activityType',
                measure: 'sumCount',
                agg: 'avg',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
