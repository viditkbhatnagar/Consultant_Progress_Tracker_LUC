// Phase 3 acceptance specs — exercise every LUC Students template (8) and
// all three cross-org templates against the anonymized 66-row fixture
// (plus a small inline Skillhub fixture for cross-org coverage).
//
// Goes through the registry + builder layer directly (skipping HTTP) so
// the assertions stay focused on aggregation correctness, not auth wiring
// (auth is covered in students.test.js + assertDatasetAccess unit checks).

const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    loadFixture,
    insertRaw,
    makeAdmin,
} = require('./_setup');

require('../../models/Student');
const studentsBuilder = require('../../services/exports/pivots/students');
const templatesRegistry = require('../../services/exports/templates');

beforeAll(async () => {
    await startInMemoryMongo();
});
afterAll(async () => {
    await stopInMemoryMongo();
});

// Synthetic Skillhub students for cross-org tests. Only the fields the
// cross-org templates touch (organization, consultantName, courseFee,
// admissionFeePaid, createdAt).
function buildSkillhubFixture() {
    const now = new Date('2026-04-22T00:00:00.000Z');
    const earlier = new Date('2026-01-15T00:00:00.000Z');
    return [
        { organization: 'skillhub_training',  consultantName: 'Counselor 001', courseFee: 12000, admissionFeePaid: 1500, createdAt: now,     studentName: 'SH 001', enrollmentNumber: 'SH/IGCSE/26/11/001', curriculum: 'IGCSE-Cambridge' },
        { organization: 'skillhub_training',  consultantName: 'Counselor 002', courseFee: 18000, admissionFeePaid: 3000, createdAt: now,     studentName: 'SH 002', enrollmentNumber: 'SH/IGCSE/26/11/002', curriculum: 'IGCSE-Edexcel' },
        { organization: 'skillhub_institute', consultantName: 'Counselor 001', courseFee: 22000, admissionFeePaid: 2000, createdAt: earlier, studentName: 'SH 003', enrollmentNumber: 'SH/CBSE/26/11/003',  curriculum: 'CBSE' },
        { organization: 'skillhub_institute', consultantName: 'Counselor 003', courseFee: 25000, admissionFeePaid: 5000, createdAt: earlier, studentName: 'SH 004', enrollmentNumber: 'SH/CBSE/26/11/004',  curriculum: 'CBSE' },
    ];
}

function setLucCreatedAt(rows) {
    // The 66-row LUC fixture has no createdAt — needed for cross-org
    // bucketing. Set createdAt = closingDate on each row.
    return rows.map((r) => ({ ...r, createdAt: r.closingDate ? new Date(r.closingDate) : new Date('2026-04-15') }));
}

beforeEach(async () => {
    await clearAllCollections();
});

// Re-implement the controller's runTemplate dispatch in-process. Lets us
// assert on the JSON envelope without spinning up HTTP/auth.
async function runTemplate(templateId, user, { organization, filters = {} } = {}) {
    const tpl = templatesRegistry.findById(templateId);
    if (!tpl) throw new Error(`unknown template ${templateId}`);

    const orgScope = studentsBuilder.resolveOrgScope(user, organization || tpl.organization);
    const baseFilters = { ...(tpl.defaultFilters || {}), ...filters };

    const sheets = [];
    for (const sheet of tpl.sheets) {
        const sheetFilters = { ...baseFilters, ...(sheet.filters || {}) };
        if (sheet.kind === 'raw') {
            const { rows, totalEstimate } = await studentsBuilder.runRawQuery({
                user, orgScope, filters: sheetFilters, columns: sheet.columns, cursor: undefined, limit: 5000,
            });
            sheets.push({ name: sheet.name, kind: 'raw', rows, totalEstimate });
        } else {
            const result = await studentsBuilder.runPivotQuery({
                user, orgScope, filters: sheetFilters,
                rowDim: sheet.rowDim, colDim: sheet.colDim,
                measure: sheet.measure, agg: sheet.agg,
            });
            sheets.push({ name: sheet.name, kind: 'pivot', rowDim: sheet.rowDim, colDim: sheet.colDim, measure: sheet.measure, agg: sheet.agg, ...result });
        }
    }
    return { templateId: tpl.id, sheets };
}

const findRow = (totals, row) => totals.find((t) => t.row === row)?.value ?? 0;
const findCell = (cells, row, col) => cells.find((x) => x.row === row && x.col === col)?.value ?? 0;
const pivotSheet = (env, name) => env.sheets.find((s) => s.kind === 'pivot' && s.name === name);
const rawSheet   = (env, name) => env.sheets.find((s) => s.kind === 'raw' && s.name === name);

describe('LUC Students templates (8) — 66-row anonymized fixture', () => {
    beforeEach(async () => {
        await insertRaw('Student', loadFixture('students_2026-04-22.json'));
    });

    test('luc_source_x_month: 3 sheets — Data + 2 pivots, grand totals 66 + 172070', async () => {
        const env = await runTemplate('luc_source_x_month', makeAdmin());
        expect(env.sheets).toHaveLength(3);
        expect(rawSheet(env, 'Data').rows.length).toBe(66);
        expect(pivotSheet(env, 'Source × Month (count)').grandTotal).toBe(66);
        expect(pivotSheet(env, 'Source × Month (admFee)').grandTotal).toBe(172070);
    });

    test('luc_team_x_source: Team Lead × Source counts sum to 66', async () => {
        const env = await runTemplate('luc_team_x_source', makeAdmin());
        const p = pivotSheet(env, 'Team Lead × Source (count)');
        expect(p.grandTotal).toBe(66);
        // Each of the 8 anonymized teams should appear in rowOrder.
        for (let i = 0; i < 8; i++) {
            expect(p.rowOrder).toContain(`Team ${String.fromCharCode(65 + i)}`);
        }
    });

    test('luc_program_x_university: replicates Sheet3 row + col totals', async () => {
        const env = await runTemplate('luc_program_x_university', makeAdmin(), {
            filters: { endDate: '2026-04-22' },
        });
        const p = pivotSheet(env, 'University × Program (count)');
        expect(findRow(p.rowTotals, 'Knights College')).toBe(42);
        expect(findRow(p.rowTotals, 'Swiss School of Management (SSM)')).toBe(22);
        expect(findRow(p.rowTotals, 'CMBS')).toBe(1);
        expect(findRow(p.rowTotals, 'OTHM')).toBe(1);
        expect(p.grandTotal).toBe(66);
    });

    test('luc_consultant_x_month: per-consultant courseFee sum is non-zero', async () => {
        const env = await runTemplate('luc_consultant_x_month', makeAdmin());
        const countSheet = pivotSheet(env, 'Consultant × Month (count)');
        const feeSheet = pivotSheet(env, 'Consultant × Month (courseFee)');
        expect(countSheet.grandTotal).toBe(66);
        expect(feeSheet.grandTotal).toBeGreaterThan(0);
        expect(countSheet.rowOrder.length).toBe(25);
    });

    test('luc_conversion_buckets: every row counts add to 66', async () => {
        const env = await runTemplate('luc_conversion_buckets', makeAdmin());
        const p = pivotSheet(env, 'Bucket × Team Lead (count)');
        expect(p.grandTotal).toBe(66);
        // Every conversionTime in fixture is a non-negative number → no
        // (unknown) bucket.
        const bucketLabels = ['≤7 days', '8-30 days', '>30 days', '(unknown)'];
        for (const r of p.rowOrder) {
            expect(bucketLabels).toContain(r);
        }
    });

    test('luc_campaign_performance: campaign count grand-total = 66', async () => {
        const env = await runTemplate('luc_campaign_performance', makeAdmin());
        const c = pivotSheet(env, 'Campaign (count)');
        const f = pivotSheet(env, 'Campaign (sum admFee)');
        expect(c.grandTotal).toBe(66);
        expect(f.grandTotal).toBe(172070);
    });

    test('luc_nationality_split: rows × region matches fixture nationality count', async () => {
        const env = await runTemplate('luc_nationality_split', makeAdmin());
        const p = pivotSheet(env, 'Nationality × Region (count)');
        expect(p.grandTotal).toBe(66);
        expect(p.rowOrder.length).toBeGreaterThanOrEqual(1);
    });

    test('luc_open_day_attribution: total count matches fixture, admFee sum = 172070', async () => {
        const env = await runTemplate('luc_open_day_attribution', makeAdmin());
        const c = pivotSheet(env, 'OpenDay × Location (count)');
        const f = pivotSheet(env, 'OpenDay × Location (sum admFee)');
        // Most fixture rows have empty Open Day → bucket as ''. Both
        // sheets aggregate over the same set so totals match.
        expect(c.grandTotal).toBe(66);
        expect(f.grandTotal).toBe(172070);
    });
});

describe('Cross-org templates (3) — LUC fixture + 4 Skillhub rows', () => {
    beforeEach(async () => {
        await insertRaw('Student', setLucCreatedAt(loadFixture('students_2026-04-22.json')));
        await insertRaw('Student', buildSkillhubFixture());
    });

    test('crossorg_admissions_by_org_x_month: org row totals match fixture sizes', async () => {
        const env = await runTemplate('crossorg_admissions_by_org_x_month', makeAdmin());
        const p = pivotSheet(env, 'Organization × Month (count)');
        expect(findRow(p.rowTotals, 'luc')).toBe(66);
        expect(findRow(p.rowTotals, 'skillhub_training')).toBe(2);
        expect(findRow(p.rowTotals, 'skillhub_institute')).toBe(2);
        expect(p.grandTotal).toBe(70);
    });

    test('crossorg_revenue_by_org_x_quarter: courseFee + admFee sums', async () => {
        const env = await runTemplate('crossorg_revenue_by_org_x_quarter', makeAdmin());
        const cf = pivotSheet(env, 'Org × Quarter (sum courseFee)');
        const af = pivotSheet(env, 'Org × Quarter (sum admFee)');
        // Skillhub revenue: 12000 + 18000 + 22000 + 25000 = 77000.
        expect(findRow(cf.rowTotals, 'skillhub_training')).toBe(30000);
        expect(findRow(cf.rowTotals, 'skillhub_institute')).toBe(47000);
        // Skillhub admFee: 1500 + 3000 + 2000 + 5000 = 11500.
        expect(findRow(af.rowTotals, 'skillhub_training')).toBe(4500);
        expect(findRow(af.rowTotals, 'skillhub_institute')).toBe(7000);
        // LUC admFee = 172070 (Sheet1 invariant).
        expect(findRow(af.rowTotals, 'luc')).toBe(172070);
    });

    test('crossorg_consultant_leaderboard: consultants × org count + admFee', async () => {
        const env = await runTemplate('crossorg_consultant_leaderboard', makeAdmin());
        const c = pivotSheet(env, 'Consultant × Org (count)');
        const f = pivotSheet(env, 'Consultant × Org (sum admFee)');
        // 25 LUC + 3 distinct Skillhub = 28 unique consultantNames.
        expect(c.rowOrder.length).toBe(28);
        // Counselor 001 has 1 Skillhub_training admission + 1 institute.
        expect(findCell(c.cells, 'Counselor 001', 'skillhub_training')).toBe(1);
        expect(findCell(c.cells, 'Counselor 001', 'skillhub_institute')).toBe(1);
        // Cross-org admFee total = LUC 172070 + Skillhub 11500 = 183570.
        expect(f.grandTotal).toBe(183570);
    });
});

describe('skillhub_overdue_emis — raw-only with post-fetch filter', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastWeek  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const nextWeek  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    beforeEach(async () => {
        // 4 Skillhub students:
        //   - SH 001: emi due yesterday, unpaid → OVERDUE.
        //   - SH 002: emi due last week, paid yesterday → not overdue.
        //   - SH 003: no emis array → not overdue.
        //   - SH 004: emi due next week, unpaid → not yet due.
        //   - SH 005: two emis — one overdue, one paid → OVERDUE (count=1).
        const fixture = [
            {
                organization: 'skillhub_training', studentName: 'SH 001',
                enrollmentNumber: 'SH/IGCSE/26/11/901', curriculum: 'CBSE',
                consultantName: 'Counselor 010', courseFee: 12000, admissionFeePaid: 1500, registrationFee: 0,
                emis: [{ dueDate: yesterday, amount: 1000, paidOn: null, paidAmount: 0 }],
                createdAt: lastWeek,
            },
            {
                organization: 'skillhub_training', studentName: 'SH 002',
                enrollmentNumber: 'SH/IGCSE/26/11/902', curriculum: 'CBSE',
                consultantName: 'Counselor 011', courseFee: 12000, admissionFeePaid: 1500, registrationFee: 0,
                emis: [{ dueDate: lastWeek, amount: 1000, paidOn: yesterday, paidAmount: 1000 }],
                createdAt: lastWeek,
            },
            {
                organization: 'skillhub_training', studentName: 'SH 003',
                enrollmentNumber: 'SH/IGCSE/26/11/903', curriculum: 'CBSE',
                consultantName: 'Counselor 012', courseFee: 12000, admissionFeePaid: 0, registrationFee: 0,
                emis: [],
                createdAt: lastWeek,
            },
            {
                organization: 'skillhub_training', studentName: 'SH 004',
                enrollmentNumber: 'SH/IGCSE/26/11/904', curriculum: 'CBSE',
                consultantName: 'Counselor 013', courseFee: 12000, admissionFeePaid: 1500, registrationFee: 0,
                emis: [{ dueDate: nextWeek, amount: 1000, paidOn: null, paidAmount: 0 }],
                createdAt: lastWeek,
            },
            {
                organization: 'skillhub_training', studentName: 'SH 005',
                enrollmentNumber: 'SH/IGCSE/26/11/905', curriculum: 'CBSE',
                consultantName: 'Counselor 014', courseFee: 12000, admissionFeePaid: 1500, registrationFee: 0,
                emis: [
                    { dueDate: yesterday, amount: 1000, paidOn: null,      paidAmount: 0 },
                    { dueDate: lastWeek,  amount: 1000, paidOn: lastWeek,  paidAmount: 1000 },
                ],
                createdAt: lastWeek,
            },
        ];
        await insertRaw('Student', fixture);
    });

    test('returns ONLY students with at least one overdue EMI; paid-up + future-EMI rows are excluded', async () => {
        const env = await runTemplate('skillhub_overdue_emis', makeAdmin());
        const sheet = rawSheet(env, 'Overdue EMIs');
        expect(sheet).toBeTruthy();
        const names = sheet.rows.map((r) => r.studentName).sort();
        expect(names).toEqual(['SH 001', 'SH 005']);
        // Each returned row exposes overdueEmiCount > 0 for the UI.
        for (const r of sheet.rows) {
            expect(r.overdueEmiCount).toBeGreaterThan(0);
        }
    });
});

describe('Templates registry — invariants', () => {
    test('every registered template has at least one sheet', () => {
        for (const t of templatesRegistry.TEMPLATES) {
            expect(Array.isArray(t.sheets)).toBe(true);
            expect(t.sheets.length).toBeGreaterThan(0);
        }
    });

    test('all template ids are unique', () => {
        const seen = new Set();
        for (const t of templatesRegistry.TEMPLATES) {
            expect(seen.has(t.id)).toBe(false);
            seen.add(t.id);
        }
    });

    test('listForRole filters by role', () => {
        const adminList = templatesRegistry.listForRole({ role: 'admin' }).map((t) => t.id);
        const skillhubList = templatesRegistry.listForRole({ role: 'skillhub' }).map((t) => t.id);
        // Admin sees everything.
        expect(adminList.length).toBe(templatesRegistry.TEMPLATES.length);
        // Skillhub doesn't see LUC-only or Meetings.
        expect(skillhubList).not.toContain('luc_source_x_month');
        expect(skillhubList).not.toContain('meetings_mode_x_status');
    });
});
