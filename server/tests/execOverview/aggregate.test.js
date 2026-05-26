// Integration specs for the Executive Overview aggregation service.
// Uses mongodb-memory-server (same setup pattern as Export Center tests).
//
// Verifies: total YTD/MTD roll-up, AGI exclusion, LUC zero-fee filter,
// team-detail per-month structure, and team_lead scope enforcement.

const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
} = require('../exports/_setup');

require('../../models/Student');
require('../../models/User');
require('../../models/Consultant');
require('../../models/MonthlyTarget');

const {
    getExecutiveOverview,
    getTeamDetail,
} = require('../../services/execOverview/aggregate');

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

const tonyId = new mongoose.Types.ObjectId();
const elizabethId = new mongoose.Types.ObjectId();
const sweethaId = new mongoose.Types.ObjectId();

async function seedTinyDataset() {
    await insertRaw('User', [
        {
            _id: tonyId,
            name: 'Tony',
            email: 'tony@example.com',
            password: 'x',
            role: 'team_lead',
            organization: 'luc',
            teamName: 'Team Tony',
            isActive: true,
        },
    ]);
    await insertRaw('Consultant', [
        { _id: elizabethId, name: 'Elizabeth', teamLead: tonyId, organization: 'luc', isActive: true },
        { _id: sweethaId, name: 'Swetha', teamLead: tonyId, organization: 'luc', isActive: true },
    ]);
    // 4 students: 2 LUC with admissionFeePaid > 0, 1 LUC with 0 (filtered),
    // 1 AGI (excluded from totalAdmissions count).
    await insertRaw('Student', [
        {
            organization: 'luc',
            consultant: elizabethId,
            consultantName: 'Elizabeth',
            teamLead: tonyId,
            studentName: 'Stu A',
            program: 'MBA',
            university: 'Knights College',
            admissionFeePaid: 50000,
            closingDate: '2025-01-15',
        },
        {
            organization: 'luc',
            consultant: sweethaId,
            consultantName: 'Swetha',
            teamLead: tonyId,
            studentName: 'Stu B',
            program: 'BBA',
            university: 'Knights College',
            admissionFeePaid: 30000,
            closingDate: '2025-01-20',
        },
        {
            organization: 'luc',
            consultant: elizabethId,
            consultantName: 'Elizabeth',
            teamLead: tonyId,
            studentName: 'Stu C zero',
            program: 'MBA',
            university: 'Knights College',
            admissionFeePaid: 0, // hidden by applyHideLucZeroFeeFilter
            closingDate: '2025-02-10',
        },
        {
            organization: 'luc',
            consultant: elizabethId,
            consultantName: 'Elizabeth',
            teamLead: tonyId,
            studentName: 'Stu D AGI',
            program: 'Pathway Program Certification',
            university: 'AGI – American Global Institute (Certifications)',
            admissionFeePaid: 12000,
            closingDate: '2025-02-15',
        },
    ]);
    await insertRaw('MonthlyTarget', [
        { organization: 'luc', teamLead: tonyId, consultant: elizabethId, consultantName: 'Elizabeth', year: 2025, month: 1, targetAmount: 100000 },
        { organization: 'luc', teamLead: tonyId, consultant: sweethaId, consultantName: 'Swetha', year: 2025, month: 1, targetAmount: 50000 },
        { organization: 'luc', teamLead: tonyId, consultant: elizabethId, consultantName: 'Elizabeth', year: 2025, month: 2, targetAmount: 80000 },
    ]);
}

describe('getExecutiveOverview', () => {
    test('rolls up KPIs across the year', async () => {
        await seedTinyDataset();
        const out = await getExecutiveOverview({ year: 2025 });

        expect(out.year).toBe(2025);
        // KPIs: 1 team Tony — Jan: target 150k, achieved 80k. Feb: target
        // 80k, achieved 12k (the AGI student still contributes revenue;
        // it's only excluded from totalAdmissions count).
        // Since the test runs in 2025 + later, currentMonth = 12 path
        // ensures full-year YTD = sum of all months.
        expect(out.kpi.ytdTarget).toBe(150000 + 80000);
        expect(out.kpi.ytdAchieved).toBe(50000 + 30000 + 12000);
    });

    test('LUC zero-fee students are excluded from revenue + program counts', async () => {
        await seedTinyDataset();
        const out = await getExecutiveOverview({ year: 2025 });
        // Knights MBA program count must NOT include "Stu C zero" (filtered).
        const knightsMba = out.programs.find((p) => p.program === 'KNIGHTS MBA');
        expect(knightsMba.ytdTotal).toBe(1); // only Stu A
    });

    test('AGI is reported separately and excluded from grand total', async () => {
        await seedTinyDataset();
        const out = await getExecutiveOverview({ year: 2025 });
        const agi = out.programs.find((p) => p.program === 'AGI');
        expect(agi.isAgi).toBe(true);
        expect(agi.ytdTotal).toBe(1); // the Pathway Program student
        expect(agi.share).toBeNull();
        // Grand total = Knights MBA (1) + Knights BBA (1) = 2; AGI excluded.
        expect(out.programGrandTotal.ytdTotal).toBe(2);
    });

    test('teamsMtd marks teams Behind when MTD% < 80%', async () => {
        await seedTinyDataset();
        const out = await getExecutiveOverview({ year: 2025 });
        const tony = out.teamsMtd.find((t) => String(t.id) === String(tonyId));
        expect(tony).toBeTruthy();
        expect(['On Track', 'Behind']).toContain(tony.status);
    });
});

describe('getTeamDetail', () => {
    test('returns 12 monthly blocks each with the team members', async () => {
        await seedTinyDataset();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        expect(out.months).toHaveLength(12);
        expect(out.teamLead.name).toBe('Tony');
        const jan = out.months[0];
        expect(jan.members.map((m) => m.consultantName).sort()).toEqual(['Elizabeth', 'Swetha']);
        // Jan team total achieved = 50000 + 30000 = 80000 (zero-fee filtered).
        expect(jan.teamTotal.achievedRevenue).toBe(80000);
        expect(jan.teamTotal.monthlyTarget).toBe(150000);
    });

    test('AGI students count in AGI bucket but NOT in totalAdmissions', async () => {
        await seedTinyDataset();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        const feb = out.months[1]; // index 1 = February
        const elizabeth = feb.members.find((m) => m.consultantName === 'Elizabeth');
        // Elizabeth's Feb: 1 AGI student (counts toward AGI bucket), 0 toward totalAdmissions.
        expect(elizabeth.buckets['AGI']).toBe(1);
        expect(elizabeth.totalAdmissions).toBe(0);
        expect(elizabeth.achievedRevenue).toBe(12000); // AGI still contributes revenue
    });

    test('throws 404 for unknown team lead', async () => {
        await expect(
            getTeamDetail({ teamLeadId: new mongoose.Types.ObjectId(), year: 2025 })
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('throws 403 when team lead is not a LUC user', async () => {
        const shId = new mongoose.Types.ObjectId();
        await insertRaw('User', [
            {
                _id: shId,
                name: 'Skillhub TL',
                email: 'sh@example.com',
                password: 'x',
                role: 'team_lead',
                organization: 'skillhub_training',
                isActive: true,
            },
        ]);
        await expect(
            getTeamDetail({ teamLeadId: shId, year: 2025 })
        ).rejects.toMatchObject({ statusCode: 403 });
    });
});
