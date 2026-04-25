// Cell-for-cell assertions against the four reference-workbook pivots
// (`student_database_2026-04-22.xlsx`). 66-row anonymized fixture lives at
// fixtures/students_2026-04-22.json. Plan §12 Phase 2 acceptance gate.

const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    loadFixture,
    insertRaw,
    makeAdmin,
    makeTeamLead,
    makeManager,
    makeSkillhub,
} = require('./_setup');

require('../../models/Student'); // register
const builder = require('../../services/exports/pivots/students');

beforeAll(async () => {
    await startInMemoryMongo();
});

afterAll(async () => {
    await stopInMemoryMongo();
});

beforeEach(async () => {
    await clearAllCollections();
    const rows = loadFixture('students_2026-04-22.json');
    await insertRaw('Student', rows);
});

const ADMIN_LUC_FILTERS = { endDate: '2026-04-22' };

function cellValue(cells, row, col) {
    const c = cells.find((x) => String(x.row) === row && String(x.col || '') === col);
    return c ? c.value : 0;
}

function rowTotal(result, row) {
    return result.rowTotals.find((t) => t.row === row)?.value ?? 0;
}

describe('Students pivot — reference workbook 2026-04-22 (66 rows, LUC)', () => {
    test('Sheet1: rowDim=consultantName, agg=sum, measure=admissionFeePaid', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: ADMIN_LUC_FILTERS,
            rowDim: 'consultantName',
            colDim: undefined,
            measure: 'admissionFeePaid',
            agg: 'sum',
        });

        // Per-consultant totals from the anonymized fixture (alphabetized
        // → Consultant 001..025; same regen will produce the same IDs).
        // Grand total 172070 AED is invariant across anonymization.
        const expected = {
            'Consultant 001': 1575,
            'Consultant 002': 4000,
            'Consultant 003': 6500,
            'Consultant 004': 7150,
            'Consultant 005': 4000,
            'Consultant 006': 11420,
            'Consultant 007': 1500,
            'Consultant 008': 12750,
            'Consultant 009': 18099,
            'Consultant 010': 1499,
            'Consultant 011': 1575,
            'Consultant 012': 4758,
            'Consultant 013': 1500,
            'Consultant 014': 6500,
            'Consultant 015': 14700,
            'Consultant 016': 2000,
            'Consultant 017': 7100,
            'Consultant 018': 17499,
            'Consultant 019': 8000,
            'Consultant 020': 2500,
            'Consultant 021': 7000,
            'Consultant 022': 14823,
            'Consultant 023': 6999,
            'Consultant 024': 2998,
            'Consultant 025': 5625,
        };

        for (const [name, val] of Object.entries(expected)) {
            expect(rowTotal(r, name)).toBe(val);
        }
        expect(r.grandTotal).toBe(172070);
        expect(r.rowOrder.filter((x) => x).length).toBe(25);
    });

    test('Sheet2: rowDim=source, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: ADMIN_LUC_FILTERS,
            rowDim: 'source',
            colDim: undefined,
            agg: 'count',
        });

        const expected = {
            'Alumni': 4,
            'Facebook': 13,
            'Google Ads': 27,
            'Instagram': 1,
            'Old Crm': 1,
            'Reference': 14,
            'Re-Registration': 2,
            'Seo': 2,
            'Whatsapp': 2,
        };
        for (const [src, val] of Object.entries(expected)) {
            expect(rowTotal(r, src)).toBe(val);
        }
        expect(r.grandTotal).toBe(66);
    });

    test('Sheet3: rowDim=university, colDim=program, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: ADMIN_LUC_FILTERS,
            rowDim: 'university',
            colDim: 'program',
            agg: 'count',
        });

        // Spot-checks against Sheet3 (rows are universities, cols are programs).
        // Sheet3 row "Knights College": MBA=18, BSc=5, OTHM + BSC=14, etc.
        expect(cellValue(r.cells, 'Knights College', 'MBA')).toBe(18);
        expect(cellValue(r.cells, 'Knights College', 'BSc')).toBe(5);
        expect(cellValue(r.cells, 'Knights College', 'OTHM + BSC')).toBe(14);
        expect(cellValue(r.cells, 'Knights College', 'BSc OTHM Extended Level 5')).toBe(1);
        expect(cellValue(r.cells, 'Knights College', 'MBA + Premium')).toBe(1);
        expect(cellValue(r.cells, 'Knights College', 'MBA Premium')).toBe(3);
        expect(cellValue(r.cells, 'Swiss School of Management (SSM)', 'BBA')).toBe(7);
        expect(cellValue(r.cells, 'Swiss School of Management (SSM)', 'DBA')).toBe(6);
        expect(cellValue(r.cells, 'Swiss School of Management (SSM)', 'MBA')).toBe(5);
        expect(cellValue(r.cells, 'Swiss School of Management (SSM)', 'MBA Premium')).toBe(1);
        expect(cellValue(r.cells, 'Swiss School of Management (SSM)', 'OTHM + BBA')).toBe(3);
        expect(cellValue(r.cells, 'CMBS', 'MBA')).toBe(1);
        expect(cellValue(r.cells, 'OTHM', 'OTHM + BBA')).toBe(1);

        // Row totals (per university).
        expect(rowTotal(r, 'Knights College')).toBe(42);
        expect(rowTotal(r, 'Swiss School of Management (SSM)')).toBe(22);
        expect(rowTotal(r, 'CMBS')).toBe(1);
        expect(rowTotal(r, 'OTHM')).toBe(1);

        // Column totals.
        const colTotal = (col) => r.colTotals.find((t) => t.col === col)?.value ?? 0;
        expect(colTotal('BBA')).toBe(7);
        expect(colTotal('BSc')).toBe(5);
        expect(colTotal('BSc OTHM Extended Level 5')).toBe(1);
        expect(colTotal('DBA')).toBe(6);
        expect(colTotal('MBA')).toBe(24);
        expect(colTotal('MBA + Premium')).toBe(1);
        expect(colTotal('MBA Premium')).toBe(4);
        expect(colTotal('OTHM + BBA')).toBe(4);
        expect(colTotal('OTHM + BSC')).toBe(14);

        expect(r.grandTotal).toBe(66);
    });

    test('Sheet4: rowDim=campaignName, colDim=source, agg=count', async () => {
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'luc',
            filters: ADMIN_LUC_FILTERS,
            rowDim: 'campaignName',
            colDim: 'source',
            agg: 'count',
        });

        // Column totals match Sheet2's source distribution exactly — the
        // grand total along the bottom of Sheet4.
        const colTotal = (col) => r.colTotals.find((t) => t.col === col)?.value ?? 0;
        expect(colTotal('Alumni')).toBe(4);
        expect(colTotal('Facebook')).toBe(13);
        expect(colTotal('Google Ads')).toBe(27);
        expect(colTotal('Instagram')).toBe(1);
        expect(colTotal('Old Crm')).toBe(1);
        expect(colTotal('Reference')).toBe(14);
        expect(colTotal('Re-Registration')).toBe(2);
        expect(colTotal('Seo')).toBe(2);
        expect(colTotal('Whatsapp')).toBe(2);

        expect(r.grandTotal).toBe(66);

        // Spot-check a couple of campaign-source rows from Sheet4.
        // "REFERENCE" campaign was Reference-source-only.
        expect(cellValue(r.cells, 'REFERENCE', 'Reference')).toBeGreaterThan(0);
    });
});

describe('Students pivot — scope enforcement', () => {
    test('team_lead body-spoofing organization=skillhub_training is treated as LUC', async () => {
        const tlId = require('mongoose').Types.ObjectId.createFromTime(1);
        const tl = makeTeamLead({ teamLeadId: tlId });
        const orgScope = builder.resolveOrgScope(tl, 'skillhub_training');
        // Resolver hard-locks team_lead to LUC regardless of body input.
        expect(orgScope).toBe('luc');
    });

    test('admin orgScope=all returns count without organization filter', async () => {
        // Note: 'all' mode buckets dates on createdAt (plan §4); the fixture
        // is inserted via raw collection.insertMany which doesn't auto-fill
        // timestamps, so we run this test without a date filter and verify
        // the org filter is omitted (all 66 LUC fixture rows count).
        const r = await builder.runPivotQuery({
            user: makeAdmin(),
            orgScope: 'all',
            filters: {},
            rowDim: 'organization',
            agg: 'count',
        });
        expect(rowTotal(r, 'luc')).toBe(66);
        expect(r.grandTotal).toBe(66);
    });

    test('manager Export Center exception: organization=skillhub_training is honored', async () => {
        const m = makeManager();
        const orgScope = builder.resolveOrgScope(m, 'skillhub_training');
        expect(orgScope).toBe('skillhub_training');
    });

    test('skillhub user is locked to own organization', async () => {
        const sh = makeSkillhub({ organization: 'skillhub_institute' });
        // Even with body claiming training, resolver returns user.organization.
        // (assertDatasetAccess in the controller also guards this; the resolver
        // itself ignores body for skillhub.)
        const orgScope = builder.resolveOrgScope(sh, 'skillhub_training');
        expect(orgScope).toBe('skillhub_institute');
    });
});

describe('Students pivot — invalid configs return 400-flagged errors', () => {
    test('rowDim missing throws statusCode 400', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                agg: 'count',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('rowDim not in catalog (Skillhub-only dim on LUC scope) throws 400', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                rowDim: 'curriculum',
                agg: 'count',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('agg=sum requires a valid measure', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                rowDim: 'source',
                measure: 'definitelyNotAMeasure',
                agg: 'sum',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('unknown agg throws 400', async () => {
        await expect(
            builder.runPivotQuery({
                user: makeAdmin(),
                orgScope: 'luc',
                filters: {},
                rowDim: 'source',
                agg: 'medianish',
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});
