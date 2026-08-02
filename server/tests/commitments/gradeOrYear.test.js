// Skillhub Institute demos carry the student's grade/year (Commitment.
// gradeOrYear). It's a plain passthrough field, but pin the round-trip so a
// future controller refactor (e.g. an allow-list) can't silently drop it.

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

const seed = (overrides = {}) => Commitment.create({
    organization: 'skillhub_institute',
    teamLead: new mongoose.Types.ObjectId(),
    teamName: 'Skillhub Institute',
    consultantName: 'Ayisha',
    studentName: 'Wahaj Mohammad',
    commitmentMade: 'attended math demo',
    dayCommitted: 'Friday',
    weekNumber: 31,
    year: 2026,
    weekStartDate: new Date('2026-07-27'),
    weekEndDate: new Date('2026-08-02'),
    commitmentDate: new Date('2026-07-31'),
    leadStage: 'Offer Sent',
    ...overrides,
});

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

test('gradeOrYear persists on create', async () => {
    const doc = await seed({ gradeOrYear: 'Grade 9' });
    const found = await Commitment.findById(doc._id);
    expect(found.gradeOrYear).toBe('Grade 9');
});

test('gradeOrYear round-trips through an update', async () => {
    const doc = await seed({ gradeOrYear: 'Grade 9' });
    const res = await request(app).put(`/commitments/${doc._id}`).send({ gradeOrYear: 'Year 10' });
    expect(res.status).toBe(200);
    const after = await Commitment.findById(doc._id);
    expect(after.gradeOrYear).toBe('Year 10');
});

test('gradeOrYear defaults to empty string when never set', async () => {
    const doc = await seed();
    const found = await Commitment.findById(doc._id);
    expect(found.gradeOrYear).toBe('');
});
