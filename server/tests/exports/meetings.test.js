// Meetings pivot spec — synthetic 8-doc fixture across two modes/teams.

const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
    makeAdmin,
    makeTeamLead,
} = require('./_setup');

require('../../models/Meeting');
const builder = require('../../services/exports/pivots/meetings');
const mongoose = require('mongoose');

beforeAll(async () => {
    await startInMemoryMongo();
});
afterAll(async () => {
    await stopInMemoryMongo();
});

const TL_A = new mongoose.Types.ObjectId();
const TL_B = new mongoose.Types.ObjectId();

const FIXTURE = [
    { teamLead: TL_A, organization: 'luc', mode: 'Zoom',           status: 'Admission', program: 'MBA', studentName: 'S1', teamLeadName: 'Aisha', consultantName: 'X', meetingDate: '2026-04-14' },
    { teamLead: TL_A, organization: 'luc', mode: 'Zoom',           status: 'Hot',       program: 'MBA', studentName: 'S2', teamLeadName: 'Aisha', consultantName: 'X', meetingDate: '2026-04-15' },
    { teamLead: TL_A, organization: 'luc', mode: 'Office Meeting', status: 'Cold',      program: 'BBA', studentName: 'S3', teamLeadName: 'Aisha', consultantName: 'Y', meetingDate: '2026-04-15' },
    { teamLead: TL_A, organization: 'luc', mode: 'Out Meeting',    status: 'Warm',      program: 'BSc', studentName: 'S4', teamLeadName: 'Aisha', consultantName: 'Y', meetingDate: '2026-04-16' },
    { teamLead: TL_B, organization: 'luc', mode: 'Zoom',           status: 'Admission', program: 'MBA', studentName: 'S5', teamLeadName: 'Bilal', consultantName: 'Z', meetingDate: '2026-04-14' },
    { teamLead: TL_B, organization: 'luc', mode: 'Office Meeting', status: 'Hot',       program: 'DBA', studentName: 'S6', teamLeadName: 'Bilal', consultantName: 'Z', meetingDate: '2026-04-15' },
    { teamLead: TL_B, organization: 'luc', mode: 'Office Meeting', status: 'Lost',      program: 'BBA', studentName: 'S7', teamLeadName: 'Bilal', consultantName: 'Z', meetingDate: '2026-04-15' },
    { teamLead: TL_B, organization: 'luc', mode: 'Student Meeting',status: 'Cold',      program: 'MBA', studentName: 'S8', teamLeadName: 'Bilal', consultantName: 'Z', meetingDate: '2026-04-17' },
];

beforeEach(async () => {
    await clearAllCollections();
    await insertRaw('Meeting', FIXTURE);
});

const findRow = (totals, row) => totals.find((t) => t.row === row)?.value ?? 0;

describe('Meetings pivot', () => {
    test('rowDim=mode, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'mode',
            agg: 'count',
        });
        expect(findRow(r.rowTotals, 'Zoom')).toBe(3);
        expect(findRow(r.rowTotals, 'Office Meeting')).toBe(3);
        expect(findRow(r.rowTotals, 'Out Meeting')).toBe(1);
        expect(findRow(r.rowTotals, 'Student Meeting')).toBe(1);
        expect(r.grandTotal).toBe(8);
    });

    test('rowDim=mode, colDim=status, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'mode',
            colDim: 'status',
            agg: 'count',
        });
        const cell = (row, col) => r.cells.find((x) => x.row === row && x.col === col)?.value ?? 0;
        expect(cell('Zoom', 'Admission')).toBe(2);
        expect(cell('Zoom', 'Hot')).toBe(1);
        expect(cell('Office Meeting', 'Cold')).toBe(1);
        expect(cell('Office Meeting', 'Hot')).toBe(1);
        expect(cell('Office Meeting', 'Lost')).toBe(1);
    });

    test('team_lead is scoped to own team via teamLead FK', async () => {
        const tl = makeTeamLead({ teamLeadId: TL_B });
        const r = await builder.runPivotQuery({
            user: tl,
            orgScope: 'luc',
            filters: {},
            rowDim: 'mode',
            agg: 'count',
        });
        expect(r.grandTotal).toBe(4);
        expect(findRow(r.rowTotals, 'Zoom')).toBe(1);
        expect(findRow(r.rowTotals, 'Office Meeting')).toBe(2);
        expect(findRow(r.rowTotals, 'Student Meeting')).toBe(1);
    });

    test('agg=sum is rejected — meetings only supports count', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                rowDim: 'mode',
                measure: 'count',
                agg: 'sum',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
