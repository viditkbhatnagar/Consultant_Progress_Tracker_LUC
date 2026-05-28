// Controller-level specs for team-entry upserts. Guards the production
// bug where consultantName appeared in BOTH $set and $setOnInsert, making
// every cell save throw "Updating the path 'consultantName' would create a
// conflict at 'consultantName'".

const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
    makeAdmin,
} = require('../exports/_setup');

require('../../models/User');
require('../../models/Consultant');
require('../../models/TeamMonthlyEntry');
const TeamMonthlyEntry = require('../../models/TeamMonthlyEntry');
const controller = require('../../controllers/teamEntryController');

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

// Minimal Express res double capturing status + json.
function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
}

const tonyId = new mongoose.Types.ObjectId();
const elizabethId = new mongoose.Types.ObjectId();

async function seedTeam() {
    await insertRaw('User', [{
        _id: tonyId, name: 'Tony', email: 't@x.com', password: 'x',
        role: 'team_lead', organization: 'luc', teamName: 'Team Tony', isActive: true,
    }]);
    await insertRaw('Consultant', [{
        _id: elizabethId, name: 'Elizabeth', teamLead: tonyId, organization: 'luc', isActive: true,
    }]);
}

describe('upsertEntry', () => {
    test('inserts a new entry without a consultantName conflict', async () => {
        await seedTeam();
        const req = {
            user: makeAdmin(),
            body: {
                consultant: String(elizabethId), teamLead: String(tonyId),
                year: 2026, month: 1, achievedRevenue: 208000, ssm_mba: 4, knights_mba: 10,
            },
        };
        const res = mockRes();
        await controller.upsertEntry(req, res, (e) => { throw e; });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.consultantName).toBe('Elizabeth');
        expect(res.body.data.achievedRevenue).toBe(208000);
        expect(res.body.data.ssm_mba).toBe(4);
    });

    test('updates an existing entry (second upsert) without conflict', async () => {
        await seedTeam();
        const base = {
            consultant: String(elizabethId), teamLead: String(tonyId), year: 2026, month: 1,
        };
        const mk = () => ({ user: makeAdmin(), body: { ...base } });

        let res = mockRes();
        await controller.upsertEntry({ ...mk(), body: { ...base, achievedRevenue: 100000 } }, res, (e) => { throw e; });
        expect(res.statusCode).toBe(200);

        res = mockRes();
        await controller.upsertEntry({ ...mk(), body: { ...base, achievedRevenue: 150000, dba: 3 } }, res, (e) => { throw e; });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.achievedRevenue).toBe(150000);
        expect(res.body.data.dba).toBe(3);

        const count = await TeamMonthlyEntry.countDocuments({ consultant: elizabethId, year: 2026, month: 1 });
        expect(count).toBe(1); // upsert, not duplicate
    });
});

describe('bulkUpsert', () => {
    test('bulk inserts rows without conflict', async () => {
        await seedTeam();
        const req = {
            user: makeAdmin(),
            body: {
                rows: [
                    { consultant: String(elizabethId), teamLead: String(tonyId), year: 2026, month: 1, achievedRevenue: 208000 },
                    { consultant: String(elizabethId), teamLead: String(tonyId), year: 2026, month: 2, achievedRevenue: 100000 },
                ],
            },
        };
        const res = mockRes();
        await controller.bulkUpsert(req, res, (e) => { throw e; });
        expect(res.statusCode).toBe(200);
        expect(res.body.data.upserted).toBe(2);
        expect(res.body.data.errors).toHaveLength(0);

        const jan = await TeamMonthlyEntry.findOne({ consultant: elizabethId, month: 1 }).lean();
        expect(jan.consultantName).toBe('Elizabeth');
        expect(jan.achievedRevenue).toBe(208000);
    });
});
