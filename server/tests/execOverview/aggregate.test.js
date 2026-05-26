// Integration specs for the manual-entry Executive Overview aggregator.
// Uses mongodb-memory-server (same setup pattern as Export Center tests).
//
// Verifies: team-detail per-month structure with auto totals + % Rev,
// Executive Overview KPI/team/consultant/program roll-ups, AGI is
// excluded from Total Admissions but tracked in its own column,
// and team_lead scope guard on getTeamDetail.

const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
} = require('../exports/_setup');

require('../../models/User');
require('../../models/Consultant');
require('../../models/TeamMonthlyEntry');

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

async function seed() {
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
    // Two months entered:
    //  Jan — Elizabeth target=110k achieved=208k, knights_mba=4, dba=3
    //        Swetha   target=130k achieved=209k, ssm_mba=2, ssm_bba=2, knights_mba=3, dba=1
    //  Feb — Elizabeth target=110k achieved=100k, agi=4, knights_mba=2, knights_bba=2
    await insertRaw('TeamMonthlyEntry', [
        {
            organization: 'luc', teamLead: tonyId, consultant: elizabethId,
            consultantName: 'Elizabeth', year: 2025, month: 1,
            monthlyTarget: 110000, achievedRevenue: 208000,
            knights_mba: 4, dba: 3,
        },
        {
            organization: 'luc', teamLead: tonyId, consultant: sweethaId,
            consultantName: 'Swetha', year: 2025, month: 1,
            monthlyTarget: 130000, achievedRevenue: 209000,
            ssm_mba: 2, ssm_bba: 2, knights_mba: 3, dba: 1,
        },
        {
            organization: 'luc', teamLead: tonyId, consultant: elizabethId,
            consultantName: 'Elizabeth', year: 2025, month: 2,
            monthlyTarget: 110000, achievedRevenue: 100000,
            agi: 4, knights_mba: 2, knights_bba: 2,
        },
    ]);
}

describe('getTeamDetail', () => {
    test('returns 12 monthly blocks with members + computed totals', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        expect(out.months).toHaveLength(12);
        expect(out.teamLead.name).toBe('Tony');

        // January: both consultants present, totals sum correctly.
        const jan = out.months[0];
        expect(jan.members.map((m) => m.consultantName).sort()).toEqual(['Elizabeth', 'Swetha']);

        const elizabethJan = jan.members.find((m) => m.consultantName === 'Elizabeth');
        // % Rev = 208000 / 110000.
        expect(elizabethJan.percentRevenue).toBeCloseTo(208000 / 110000, 4);
        // Total Admissions = sum of program columns = 4 (knights_mba) + 3 (dba) = 7.
        expect(elizabethJan.totalAdmissions).toBe(7);

        expect(jan.teamTotal.monthlyTarget).toBe(110000 + 130000);
        expect(jan.teamTotal.achievedRevenue).toBe(208000 + 209000);
        expect(jan.teamTotal.totalAdmissions).toBe(7 + 8); // Swetha: 2+2+3+1=8
    });

    test('AGI counts in its column but never in totalAdmissions', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        const feb = out.months[1];
        const elizabethFeb = feb.members.find((m) => m.consultantName === 'Elizabeth');
        // Feb: knights_mba=2 + knights_bba=2 = 4 (agi=4 stays out of total).
        expect(elizabethFeb.totalAdmissions).toBe(4);
        expect(elizabethFeb.buckets['AGI']).toBe(4);
        expect(elizabethFeb.buckets['KNIGHTS MBA']).toBe(2);
    });

    test('months without entries show zero-valued placeholder rows', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        const may = out.months[4]; // index 4 = May
        // Both consultants still listed.
        expect(may.members.map((m) => m.consultantName).sort()).toEqual(['Elizabeth', 'Swetha']);
        // Everything zero.
        expect(may.teamTotal.monthlyTarget).toBe(0);
        expect(may.teamTotal.achievedRevenue).toBe(0);
        expect(may.teamTotal.totalAdmissions).toBe(0);
    });

    test('YTD strip sums all months', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        // Jan target=240k + Feb target=110k = 350k.
        expect(out.ytd.target).toBe(350000);
        // Jan achieved=417k + Feb achieved=100k = 517k.
        expect(out.ytd.achieved).toBe(517000);
        expect(out.ytd.percent).toBeCloseTo(517000 / 350000, 4);
    });

    test('404 on unknown team lead', async () => {
        await expect(
            getTeamDetail({ teamLeadId: new mongoose.Types.ObjectId(), year: 2025 })
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('403 when team lead is not LUC', async () => {
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

describe('getExecutiveOverview', () => {
    test('rolls up KPI totals across all teams', async () => {
        await seed();
        const out = await getExecutiveOverview({ year: 2025 });
        expect(out.year).toBe(2025);
        expect(out.kpi.ytdTarget).toBe(240000 + 110000);
        expect(out.kpi.ytdAchieved).toBe(417000 + 100000);
    });

    test('program × month matrix uses bucket slugs server-side and excludes AGI from grand total', async () => {
        await seed();
        const out = await getExecutiveOverview({ year: 2025 });
        const agi = out.programs.find((p) => p.program === 'AGI');
        expect(agi.isAgi).toBe(true);
        expect(agi.ytdTotal).toBe(4);
        expect(agi.share).toBeNull();

        // Grand total YTD = sum of all program buckets (excluding AGI/AGI Std).
        // Jan: knights_mba=4+3=7, dba=3+1=4, ssm_mba=2, ssm_bba=2 → 15
        // Feb: knights_mba=2, knights_bba=2 → 4
        // Grand = 19.
        expect(out.programGrandTotal.ytdTotal).toBe(19);
    });

    test('teamsMtd assigns status based on threshold', async () => {
        await seed();
        const out = await getExecutiveOverview({ year: 2025 });
        const tony = out.teamsMtd.find((t) => String(t.id) === String(tonyId));
        expect(tony).toBeTruthy();
        expect(['On Track', 'Behind']).toContain(tony.status);
    });
});
