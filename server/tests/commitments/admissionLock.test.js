// Specs for the admission-close invariants on updateCommitment.
//
// Two rules, both reachable from several UI routes (inline status popover,
// inline lead-stage popover, detail drawer, edit dialog) and from raw API
// calls — so they are enforced server-side, not just in the popover handler:
//   1. leadStage='Admission' + status='achieved' auto-closes the admission.
//      The predicate merges the patch over the STORED doc, so EITHER edit
//      order trips it.
//   2. Once closed, the status is locked at 'achieved' — otherwise a row can
//      end up admissionClosed=true next to status='missed', which every
//      "achieved || admissionClosed" aggregate then counts inconsistently.

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    makeAdmin,
} = require('../exports/_setup');

const Commitment = require('../../models/Commitment');
const { updateCommitment } = require('../../controllers/commitmentController');

const admin = makeAdmin();

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { ...admin, id: admin._id.toString() }; next(); });
    app.put('/commitments/:id', updateCommitment);
    app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));
    return app;
}
const app = makeApp();

const baseRow = {
    organization: 'luc',
    consultantName: 'Aisha',
    teamName: 'Team A',
    commitmentMade: 'Close MBA',
    dayCommitted: 'Monday',
    weekNumber: 30,
    year: 2026,
    weekStartDate: new Date('2026-07-20'),
    weekEndDate: new Date('2026-07-26'),
    commitmentDate: new Date('2026-07-20'),
};

const seed = async (overrides) => {
    const doc = await Commitment.create({
        ...baseRow,
        teamLead: new mongoose.Types.ObjectId(),
        ...overrides,
    });
    return doc;
};

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

describe('auto-close fires on either edit order', () => {
    test('status → achieved on an Admission row closes the admission', async () => {
        const row = await seed({ leadStage: 'Admission', status: 'pending' });
        const res = await request(app).put(`/commitments/${row._id}`).send({ status: 'achieved' });
        expect(res.status).toBe(200);
        const after = await Commitment.findById(row._id);
        expect(after.admissionClosed).toBe(true);
        expect(after.status).toBe('achieved');
    });

    test('leadStage → Admission on an already-achieved row also closes it', async () => {
        // This is the ordering the inline lead-stage popover can hit, which is
        // why the confirmation is shared by both popovers on the client.
        const row = await seed({ leadStage: 'Hot', status: 'achieved' });
        const res = await request(app).put(`/commitments/${row._id}`).send({ leadStage: 'Admission' });
        expect(res.status).toBe(200);
        const after = await Commitment.findById(row._id);
        expect(after.admissionClosed).toBe(true);
    });

    test('status → achieved on a NON-Admission row does not close anything', async () => {
        const row = await seed({ leadStage: 'Hot', status: 'pending' });
        const res = await request(app).put(`/commitments/${row._id}`).send({ status: 'achieved' });
        expect(res.status).toBe(200);
        const after = await Commitment.findById(row._id);
        expect(after.admissionClosed).toBe(false);
        expect(after.status).toBe('achieved');
    });
});

describe('a closed admission stays achieved', () => {
    test('rejects a status change away from achieved', async () => {
        const row = await seed({ leadStage: 'Admission', status: 'achieved', admissionClosed: true });
        const res = await request(app).put(`/commitments/${row._id}`).send({ status: 'missed' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/closed/i);
        const after = await Commitment.findById(row._id);
        expect(after.status).toBe('achieved');
    });

    test('still allows unrelated edits on a closed admission', async () => {
        const row = await seed({ leadStage: 'Admission', status: 'achieved', admissionClosed: true });
        const res = await request(app)
            .put(`/commitments/${row._id}`)
            .send({ conversionProbability: 90 });
        expect(res.status).toBe(200);
        const after = await Commitment.findById(row._id);
        expect(after.conversionProbability).toBe(90);
        expect(after.status).toBe('achieved');
    });

    test('re-sending status=achieved on a closed admission is a no-op, not an error', async () => {
        const row = await seed({ leadStage: 'Admission', status: 'achieved', admissionClosed: true });
        const res = await request(app).put(`/commitments/${row._id}`).send({ status: 'achieved' });
        expect(res.status).toBe(200);
    });

    test('still refuses to reopen a closed admission', async () => {
        const row = await seed({ leadStage: 'Admission', status: 'achieved', admissionClosed: true });
        const res = await request(app).put(`/commitments/${row._id}`).send({ admissionClosed: false });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/irreversible/i);
    });
});
