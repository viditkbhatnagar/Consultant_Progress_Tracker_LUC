// Commitments pivot spec — synthetic 10-doc fixture covering achieved /
// missed / pending status spread across two consultants. No reference
// workbook for this dataset; assertions encode the expected aggregations.

const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
    makeAdmin,
    makeTeamLead,
    makeSkillhub,
} = require('./_setup');

require('../../models/Commitment');
const builder = require('../../services/exports/pivots/commitments');

beforeAll(async () => {
    await startInMemoryMongo();
});
afterAll(async () => {
    await stopInMemoryMongo();
});

const mongoose = require('mongoose');
const TL_A = new mongoose.Types.ObjectId();
const TL_B = new mongoose.Types.ObjectId();

const FIXTURE = [
    // Team A — 4 commitments, 2 achieved, 1 missed, 1 pending
    { teamLead: TL_A, organization: 'luc', consultantName: 'Aisha', teamName: 'Team A', status: 'achieved', leadStage: 'Admission', dayCommitted: 'Monday', admissionClosed: true,  closedAmount: 5000, conversionProbability: 90, achievementPercentage: 100, meetingsDone: 2, weekStartDate: '2026-04-13', commitmentDate: '2026-04-14', weekNumber: 16, year: 2026, commitmentMade: 'Close MBA' },
    { teamLead: TL_A, organization: 'luc', consultantName: 'Aisha', teamName: 'Team A', status: 'achieved', leadStage: 'Admission', dayCommitted: 'Tuesday', admissionClosed: true,  closedAmount: 7500, conversionProbability: 80, achievementPercentage: 100, meetingsDone: 1, weekStartDate: '2026-04-13', commitmentDate: '2026-04-15', weekNumber: 16, year: 2026, commitmentMade: 'Close BBA' },
    { teamLead: TL_A, organization: 'luc', consultantName: 'Bilal', teamName: 'Team A', status: 'missed',   leadStage: 'Lost',      dayCommitted: 'Wednesday', admissionClosed: false, closedAmount: 0,    conversionProbability: 30, achievementPercentage: 0,   meetingsDone: 0, weekStartDate: '2026-04-13', commitmentDate: '2026-04-16', weekNumber: 16, year: 2026, commitmentMade: 'Close BSc' },
    { teamLead: TL_A, organization: 'luc', consultantName: 'Bilal', teamName: 'Team A', status: 'pending',  leadStage: 'Hot',       dayCommitted: 'Thursday', admissionClosed: false, closedAmount: 0,    conversionProbability: 60, achievementPercentage: 0,   meetingsDone: 0, weekStartDate: '2026-04-13', commitmentDate: '2026-04-17', weekNumber: 16, year: 2026, commitmentMade: 'Follow up' },

    // Team B — 6 commitments, 3 achieved, 1 missed, 2 in_progress
    { teamLead: TL_B, organization: 'luc', consultantName: 'Carla', teamName: 'Team B', status: 'achieved',    leadStage: 'Admission', dayCommitted: 'Monday', admissionClosed: true,  closedAmount: 6000, conversionProbability: 70, achievementPercentage: 100, meetingsDone: 3, weekStartDate: '2026-04-13', commitmentDate: '2026-04-14', weekNumber: 16, year: 2026, commitmentMade: 'Close DBA' },
    { teamLead: TL_B, organization: 'luc', consultantName: 'Carla', teamName: 'Team B', status: 'achieved',    leadStage: 'Admission', dayCommitted: 'Tuesday', admissionClosed: true,  closedAmount: 4000, conversionProbability: 75, achievementPercentage: 100, meetingsDone: 1, weekStartDate: '2026-04-13', commitmentDate: '2026-04-15', weekNumber: 16, year: 2026, commitmentMade: 'Close MBA' },
    { teamLead: TL_B, organization: 'luc', consultantName: 'Carla', teamName: 'Team B', status: 'in_progress', leadStage: 'Warm',      dayCommitted: 'Wednesday', admissionClosed: false, closedAmount: 0,    conversionProbability: 40, achievementPercentage: 50,  meetingsDone: 1, weekStartDate: '2026-04-13', commitmentDate: '2026-04-16', weekNumber: 16, year: 2026, commitmentMade: 'Follow up' },
    { teamLead: TL_B, organization: 'luc', consultantName: 'Diego', teamName: 'Team B', status: 'in_progress', leadStage: 'Cold',      dayCommitted: 'Thursday', admissionClosed: false, closedAmount: 0,    conversionProbability: 20, achievementPercentage: 30,  meetingsDone: 0, weekStartDate: '2026-04-13', commitmentDate: '2026-04-17', weekNumber: 16, year: 2026, commitmentMade: 'Cold call' },
    { teamLead: TL_B, organization: 'luc', consultantName: 'Diego', teamName: 'Team B', status: 'achieved',    leadStage: 'Admission', dayCommitted: 'Friday', admissionClosed: true,  closedAmount: 9000, conversionProbability: 85, achievementPercentage: 100, meetingsDone: 2, weekStartDate: '2026-04-13', commitmentDate: '2026-04-18', weekNumber: 16, year: 2026, commitmentMade: 'Close BBA' },
    { teamLead: TL_B, organization: 'luc', consultantName: 'Diego', teamName: 'Team B', status: 'missed',      leadStage: 'Lost',      dayCommitted: 'Saturday', admissionClosed: false, closedAmount: 0,    conversionProbability: 10, achievementPercentage: 0,   meetingsDone: 0, weekStartDate: '2026-04-13', commitmentDate: '2026-04-19', weekNumber: 16, year: 2026, commitmentMade: 'Last shot' },
];

beforeEach(async () => {
    await clearAllCollections();
    await insertRaw('Commitment', FIXTURE);
});

const findRow = (totals, row) => totals.find((t) => t.row === row)?.value ?? 0;

describe('Commitments pivot', () => {
    test('rowDim=status, agg=count splits the 10 fixture rows into status buckets', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'status',
            agg: 'count',
        });
        expect(findRow(r.rowTotals, 'achieved')).toBe(5);
        expect(findRow(r.rowTotals, 'missed')).toBe(2);
        expect(findRow(r.rowTotals, 'pending')).toBe(1);
        expect(findRow(r.rowTotals, 'in_progress')).toBe(2);
        expect(r.grandTotal).toBe(10);
    });

    test('rowDim=teamName, colDim=status, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'teamName',
            colDim: 'status',
            agg: 'count',
        });
        const cell = (row, col) => r.cells.find((x) => x.row === row && x.col === col)?.value ?? 0;
        expect(cell('Team A', 'achieved')).toBe(2);
        expect(cell('Team A', 'missed')).toBe(1);
        expect(cell('Team A', 'pending')).toBe(1);
        expect(cell('Team B', 'achieved')).toBe(3);
        expect(cell('Team B', 'in_progress')).toBe(2);
        expect(cell('Team B', 'missed')).toBe(1);
        expect(findRow(r.rowTotals, 'Team A')).toBe(4);
        expect(findRow(r.rowTotals, 'Team B')).toBe(6);
    });

    test('rowDim=consultantName, agg=sum, measure=closedAmount', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'consultantName',
            measure: 'closedAmount',
            agg: 'sum',
        });
        expect(findRow(r.rowTotals, 'Aisha')).toBe(12500);
        expect(findRow(r.rowTotals, 'Bilal')).toBe(0);
        expect(findRow(r.rowTotals, 'Carla')).toBe(10000);
        expect(findRow(r.rowTotals, 'Diego')).toBe(9000);
        expect(r.grandTotal).toBe(31500);
    });

    test('rowDim=teamName, agg=avg, measure=achievementPercentage', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'teamName',
            measure: 'achievementPercentage',
            agg: 'avg',
        });
        // Team A: 100, 100, 0, 0 → 50.
        expect(findRow(r.rowTotals, 'Team A')).toBeCloseTo(50, 5);
        // Team B: 100, 100, 50, 30, 100, 0 → 380/6 ≈ 63.33.
        expect(findRow(r.rowTotals, 'Team B')).toBeCloseTo(380 / 6, 5);
    });

    test('team_lead is scoped to own team', async () => {
        const tl = makeTeamLead({ teamLeadId: TL_A });
        const r = await builder.runPivotQuery({
            user: tl,
            orgScope: 'luc',
            filters: {},
            rowDim: 'teamName',
            agg: 'count',
        });
        expect(findRow(r.rowTotals, 'Team A')).toBe(4);
        expect(findRow(r.rowTotals, 'Team B')).toBe(0);
        expect(r.grandTotal).toBe(4);
    });

    test('skillhub user is locked to own organization', async () => {
        const sh = makeSkillhub({ organization: 'skillhub_training' });
        const r = await builder.runPivotQuery({
            user: sh,
            orgScope: 'skillhub_training',
            filters: {},
            rowDim: 'status',
            agg: 'count',
        });
        // Fixture has zero skillhub_training docs.
        expect(r.grandTotal).toBe(0);
    });

    test('agg=count + colDim=admissionClosed lets the closed-admission funnel pivot pop', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: {},
            rowDim: 'status',
            colDim: 'admissionClosed',
            agg: 'count',
        });
        const cell = (row, col) => r.cells.find((x) => x.row === row && x.col === col)?.value ?? 0;
        expect(cell('achieved', 'true')).toBe(5);
        expect(cell('achieved', 'false')).toBe(0);
        expect(cell('missed', 'true')).toBe(0);
        expect(cell('missed', 'false')).toBe(2);
    });

    test('schema dedup: leadStage uses the 12-value LEAD_STAGES enum', () => {
        const Commitment = require('../../models/Commitment');
        const enumValues = Commitment.schema.path('leadStage').enumValues;
        expect(enumValues).toContain('Lost');
        expect(enumValues).toContain('Offer Sent');
        expect(enumValues).toContain('CIF');
        expect(enumValues).toContain('No Answer');
        expect(enumValues.length).toBe(12);
    });
});
