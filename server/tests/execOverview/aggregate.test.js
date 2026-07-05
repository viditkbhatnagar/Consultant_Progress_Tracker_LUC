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
    getConsultantPerformance,
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
            agi: 4, khda: 5, knights_mba: 2, knights_bba: 2,
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

    test('AGI and KHDA count in their columns but never in totalAdmissions', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        const feb = out.months[1];
        const elizabethFeb = feb.members.find((m) => m.consultantName === 'Elizabeth');
        // Feb: knights_mba=2 + knights_bba=2 = 4 (agi=4 and khda=5 stay out of total).
        expect(elizabethFeb.totalAdmissions).toBe(4);
        expect(elizabethFeb.buckets['AGI']).toBe(4);
        expect(elizabethFeb.buckets['KHDA']).toBe(5);
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

    test('program × month matrix excludes AGI and KHDA from grand total', async () => {
        await seed();
        const out = await getExecutiveOverview({ year: 2025 });
        const agi = out.programs.find((p) => p.program === 'AGI');
        expect(agi.isAgi).toBe(true);
        expect(agi.excludedFromTotal).toBe(true);
        expect(agi.ytdTotal).toBe(4);
        expect(agi.share).toBeNull();

        // KHDA is tracked in its own column but excluded from the grand total.
        const khda = out.programs.find((p) => p.program === 'KHDA');
        expect(khda.excludedFromTotal).toBe(true);
        expect(khda.isAgi).toBe(false);
        expect(khda.ytdTotal).toBe(5);
        expect(khda.share).toBeNull();

        // Grand total YTD = sum of program buckets only (AGI + KHDA excluded).
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

describe('getTeamDetail — memberWiseRevenue + consolidatedAdmissions', () => {
    test('memberWiseRevenue: per-member monthly achieved + YTD rows', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        expect(out.memberWiseRevenue).toBeTruthy();
        const eliz = out.memberWiseRevenue.members.find((m) => m.consultantName === 'Elizabeth');
        // Jan 208000, Feb 100000, rest 0.
        expect(eliz.monthly[0]).toBe(208000);
        expect(eliz.monthly[1]).toBe(100000);
        expect(eliz.monthly[2]).toBe(0);
        expect(eliz.ytdAchieved).toBe(308000);
        expect(eliz.ytdTarget).toBe(220000); // 110k + 110k
        expect(eliz.ytdPercent).toBeCloseTo(308000 / 220000, 4);
    });

    test('consolidatedAdmissions: KHDA + AGI listed first but excluded from Total Admissions', async () => {
        await seed();
        const out = await getTeamDetail({ teamLeadId: tonyId, year: 2025 });
        const ca = out.consolidatedAdmissions;
        // Excluded buckets come first, KHDA before AGI.
        expect(ca.rows[0].program).toBe('KHDA');
        expect(ca.rows[0].excludedFromTotal).toBe(true);
        expect(ca.rows[0].isAgi).toBe(false);
        expect(ca.rows[1].program).toBe('AGI');
        // KHDA total = 5 (Feb), tracked in its own column.
        const khda = ca.rows.find((r) => r.program === 'KHDA');
        expect(khda.total).toBe(5);
        // KNIGHTS MBA total = Jan 4+3=7 + Feb 2 = 9.
        const km = ca.rows.find((r) => r.program === 'KNIGHTS MBA');
        expect(km.total).toBe(9);
        // AGI total = 4 (Feb).
        const agi = ca.rows.find((r) => r.program === 'AGI');
        expect(agi.total).toBe(4);
        expect(agi.excludedFromTotal).toBe(true);
        // Total Admissions Jan = 7 (Eliz) + 8 (Swetha) = 15; Feb = 4 (AGI + KHDA excluded).
        expect(ca.totalAdmissions.monthly[0]).toBe(15);
        expect(ca.totalAdmissions.monthly[1]).toBe(4);
        expect(ca.totalAdmissions.total).toBe(19);
    });
});

describe('getConsultantPerformance', () => {
    const harshaId = new mongoose.Types.ObjectId();

    async function seedPerf() {
        await seed(); // Tony + Elizabeth(110k) + Swetha(130k) entries for 2025
        // Add a team-lead self-consultant row (should be EXCLUDED) and a
        // sub-90k consultant (Category B).
        await insertRaw('Consultant', [
            { _id: harshaId, name: 'Harsha', teamLead: tonyId, organization: 'luc', isActive: true },
            // Team-lead self row: name matches the lead 'Tony'.
            { name: 'Tony', teamLead: tonyId, organization: 'luc', isActive: true },
        ]);
        await insertRaw('TeamMonthlyEntry', [
            {
                organization: 'luc', teamLead: tonyId, consultant: harshaId,
                consultantName: 'Harsha', year: 2025, month: 1,
                monthlyTarget: 70000, achievedRevenue: 80000,
            },
        ]);
    }

    test('splits Category A (>=100k) / B (<100k) by representative monthly target', async () => {
        await seedPerf();
        const out = await getConsultantPerformance({ year: 2025 });
        const aNames = out.categoryA.map((r) => r.name).sort();
        const bNames = out.categoryB.map((r) => r.name).sort();
        expect(aNames).toEqual(['Elizabeth', 'Swetha']); // 110k, 130k
        expect(bNames).toEqual(['Harsha']);              // 70k
    });

    test('excludes the team-lead self-consultant row', async () => {
        await seedPerf();
        const out = await getConsultantPerformance({ year: 2025 });
        const allNames = [...out.categoryA, ...out.categoryB].map((r) => r.name);
        expect(allNames).not.toContain('Tony');
        expect(out.activeCount).toBe(3); // Elizabeth, Swetha, Harsha
    });

    test('ranks each category by YTD% desc and returns top-5 lists', async () => {
        await seedPerf();
        const out = await getConsultantPerformance({ year: 2025 });
        // Category A sorted by ytdPercent desc → ranks assigned 1..n.
        expect(out.categoryA[0].rank).toBe(1);
        for (let i = 1; i < out.categoryA.length; i++) {
            expect(out.categoryA[i - 1].ytdPercent).toBeGreaterThanOrEqual(out.categoryA[i].ytdPercent);
        }
        expect(out.top5Ytd.length).toBeLessThanOrEqual(5);
        expect(out.top5Mtd.length).toBeLessThanOrEqual(5);
    });
});
