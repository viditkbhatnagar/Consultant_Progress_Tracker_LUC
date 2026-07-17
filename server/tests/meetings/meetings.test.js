// Meeting Tracker specs — cover the Skillhub-branch rollout: org scoping,
// the Institute-only `demoDoneBy` field, and the LUC `program` requirement.
//
// The `program` specs matter: the schema rule is `required: [lucOnly, ...]`,
// and mongoose runs update validators with QUERY context, so `this.organization`
// is undefined and the rule silently passes on findByIdAndUpdate. The update
// path is therefore guarded in the controller — these specs pin both halves so
// a refactor can't quietly drop LUC's requirement again.

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    insertRaw,
    makeTeamLead,
    makeSkillhub,
} = require('../exports/_setup');

require('../../models/User');
require('../../models/Meeting');
const {
    getMeetings,
    createMeeting,
    updateMeeting,
} = require('../../controllers/meetingController');

const LUC_TL = new mongoose.Types.ObjectId();
const INST_USER = new mongoose.Types.ObjectId();

// Mirrors the production middleware order (protect → authorize → handler).
// The role gate lives in routes/meetings.js; these specs drive the handlers
// directly with an already-authenticated req.user.
function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.user = { ...user, id: user._id.toString() };
        next();
    });
    app.get('/api/meetings', getMeetings);
    app.post('/api/meetings', createMeeting);
    app.put('/api/meetings/:id', updateMeeting);
    app.use((err, _req, res, _next) =>
        res
            .status(err.name === 'ValidationError' ? 400 : 500)
            .json({ success: false, message: err.message })
    );
    return app;
}

const lucApp = () => makeApp(makeTeamLead({ teamLeadId: LUC_TL, organization: 'luc' }));
const instituteApp = () =>
    makeApp(makeSkillhub({ teamLeadId: INST_USER, organization: 'skillhub_institute' }));

const baseBody = {
    studentName: 'Aarav Sharma',
    meetingDate: '2026-07-10',
    mode: 'Office Meeting',
    status: 'Warm',
    consultantName: 'Fatima',
};

beforeAll(async () => {
    await startInMemoryMongo();
});
afterAll(async () => {
    await stopInMemoryMongo();
});
beforeEach(async () => {
    await clearAllCollections();
    // denormalizeNames resolves teamLeadName from a real User doc.
    await insertRaw('User', [
        { _id: LUC_TL, name: 'Test TL', email: 'tl@luc.test', role: 'team_lead', organization: 'luc' },
        { _id: INST_USER, name: 'Institute Branch', email: 'institute@skillhub.test', role: 'skillhub', organization: 'skillhub_institute' },
    ]);
});

describe('Skillhub Institute meetings', () => {
    test('an Institute branch login can log a meeting with no program, and demoDoneBy persists', async () => {
        const res = await request(instituteApp())
            .post('/api/meetings')
            .send({ ...baseBody, demoDoneBy: 'Fahad', remarks: 'Trial class done' });

        expect(res.status).toBe(201);
        expect(res.body.data.organization).toBe('skillhub_institute');
        expect(res.body.data.demoDoneBy).toBe('Fahad');
        // Ownership comes from the token, never the body.
        expect(String(res.body.data.teamLead)).toBe(INST_USER.toString());
        expect(res.body.data.teamLeadName).toBe('Institute Branch');
    });

    test('a Skillhub login cannot plant another org or owner via the body', async () => {
        const res = await request(instituteApp())
            .post('/api/meetings')
            .send({ ...baseBody, organization: 'luc', teamLead: LUC_TL.toString() });

        expect(res.status).toBe(201);
        expect(res.body.data.organization).toBe('skillhub_institute');
        expect(String(res.body.data.teamLead)).toBe(INST_USER.toString());
    });

    test('reads are scoped to the caller’s branch — LUC meetings stay invisible', async () => {
        await insertRaw('Meeting', [
            { organization: 'luc', teamLead: LUC_TL, teamLeadName: 'Test TL', studentName: 'LUC Student', program: 'MBA', mode: 'Zoom', status: 'Hot', consultantName: 'Aisha', meetingDate: '2026-07-09' },
            { organization: 'skillhub_institute', teamLead: INST_USER, teamLeadName: 'Institute Branch', studentName: 'Institute Student', mode: 'Office Meeting', status: 'Warm', consultantName: 'Fatima', meetingDate: '2026-07-09', demoDoneBy: 'Fahad' },
        ]);

        const res = await request(instituteApp()).get('/api/meetings?limit=100');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].studentName).toBe('Institute Student');
    });

    test('demoDoneBy can be updated on an existing Institute meeting', async () => {
        const created = await request(instituteApp())
            .post('/api/meetings')
            .send({ ...baseBody, demoDoneBy: 'Fahad' });

        const res = await request(instituteApp())
            .put(`/api/meetings/${created.body.data._id}`)
            .send({ demoDoneBy: 'Rehana' });

        expect(res.status).toBe(200);
        expect(res.body.data.demoDoneBy).toBe('Rehana');
    });
});

describe('LUC program requirement is unchanged', () => {
    test('creating a LUC meeting without a program is still rejected', async () => {
        const res = await request(lucApp()).post('/api/meetings').send(baseBody);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/program is required/i);
    });

    test('clearing program on an existing LUC meeting is rejected', async () => {
        const created = await request(lucApp())
            .post('/api/meetings')
            .send({ ...baseBody, program: 'MBA' });
        expect(created.status).toBe(201);

        const res = await request(lucApp())
            .put(`/api/meetings/${created.body.data._id}`)
            .send({ program: '' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/program is required/i);
    });

    test('an unrelated LUC update that omits program still succeeds', async () => {
        const created = await request(lucApp())
            .post('/api/meetings')
            .send({ ...baseBody, program: 'MBA' });

        const res = await request(lucApp())
            .put(`/api/meetings/${created.body.data._id}`)
            .send({ remarks: 'Rescheduled' });

        expect(res.status).toBe(200);
        expect(res.body.data.remarks).toBe('Rescheduled');
        expect(res.body.data.program).toBe('MBA');
    });
});
