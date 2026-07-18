// Skillhub Institute — Test Tracker specs. Covers the org gate, the bulk
// save-by-key upsert (re-recording a session cleans up rather than
// duplicating), filter correctness, and single-row edit/delete. Drives the
// controller handlers directly with an authenticated req.user, mirroring the
// meetings suite.

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    makeAdmin,
    makeSkillhub,
} = require('../exports/_setup');

require('../../models/TestRecord');
require('../../models/Attendance');
require('../../models/TimetableEntry');
const c = require('../../controllers/instituteController');

const INSTITUTE_USER = makeSkillhub({ organization: 'skillhub_institute' });
const TRAINING_USER = makeSkillhub({ organization: 'skillhub_training' });

// Mirrors routes/institute.js: protect → authorize('admin','skillhub') →
// handler. The controller's own assertInstitute further restricts skillhub to
// the Institute branch, so we drive the handlers with a set req.user.
function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get('/tests/meta', c.getTestMeta);
    app.get('/tests', c.getTests);
    app.post('/tests', c.createTests);
    app.put('/tests/:id', c.updateTest);
    app.delete('/tests/:id', c.deleteTest);
    app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));
    return app;
}

const app = makeApp(INSTITUTE_USER);

const session = {
    date: '2026-07-13',
    gradeOrYear: 'Grade 9',
    curriculum: 'IGCSE',
    subject: 'Maths',
    testTopic: 'Algebra',
    maxMarks: 20,
    teacherName: 'Fahad',
    entries: [
        { studentName: 'Aarav', marksObtained: 18 },
        { studentName: 'Meera', marksObtained: 15 },
        { studentName: 'Zoya', marksObtained: '' }, // blank → skipped
    ],
};

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

describe('Test Tracker — access', () => {
    test('a Training login is rejected (Institute-only)', async () => {
        const res = await request(makeApp(TRAINING_USER)).post('/tests').send(session);
        expect(res.status).toBe(403);
    });

    test('admin is allowed', async () => {
        const res = await request(makeApp(makeAdmin())).post('/tests').send(session);
        expect(res.status).toBe(200);
    });
});

describe('Test Tracker — bulk save', () => {
    test('records one row per student with a mark; blanks are skipped', async () => {
        const res = await request(app).post('/tests').send(session);
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        const list = await request(app).get('/tests');
        expect(list.body.data).toHaveLength(2);
        const names = list.body.data.map((r) => r.studentName).sort();
        expect(names).toEqual(['Aarav', 'Meera']);
        expect(list.body.data.every((r) => r.organization === 'skillhub_institute')).toBe(true);
    });

    test('re-recording upserts per student — corrects the mark, preserves others, no duplicates', async () => {
        await request(app).post('/tests').send(session);
        // Same key: correct Aarav's mark and add Zoya. Meera (not resubmitted)
        // must be preserved, not wiped.
        await request(app).post('/tests').send({
            ...session,
            entries: [
                { studentName: 'Aarav', marksObtained: 20 },
                { studentName: 'Zoya', marksObtained: 12 },
            ],
        });
        const list = await request(app).get('/tests');
        expect(list.body.data).toHaveLength(3);
        const aaravRows = list.body.data.filter((r) => r.studentName === 'Aarav');
        expect(aaravRows).toHaveLength(1); // upserted, not duplicated
        expect(aaravRows[0].marksObtained).toBe(20);
        expect(list.body.data.find((r) => r.studentName === 'Meera').marksObtained).toBe(15);
        expect(list.body.data.find((r) => r.studentName === 'Zoya').marksObtained).toBe(12);
    });

    test('a different topic on the same day coexists (separate key)', async () => {
        await request(app).post('/tests').send(session);
        await request(app).post('/tests').send({ ...session, testTopic: 'Geometry', entries: [{ studentName: 'Aarav', marksObtained: 10 }] });
        const list = await request(app).get('/tests');
        expect(list.body.data).toHaveLength(3);
        const topics = [...new Set(list.body.data.map((r) => r.testTopic))].sort();
        expect(topics).toEqual(['Algebra', 'Geometry']);
    });

    test('negative and whitespace-only marks are skipped (schema min:0 enforced on the bulk path)', async () => {
        const res = await request(app).post('/tests').send({
            ...session,
            testTopic: 'Edge',
            entries: [
                { studentName: 'Neg', marksObtained: -5 },
                { studentName: 'Ws', marksObtained: '  ' },
                { studentName: 'Ok', marksObtained: 7 },
            ],
        });
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        const list = await request(app).get('/tests');
        expect(list.body.data).toHaveLength(1);
        expect(list.body.data[0].studentName).toBe('Ok');
        expect(list.body.data[0].marksObtained).toBe(7);
    });

    test('a negative maxMarks is stored as null (unset), not a negative denominator', async () => {
        await request(app).post('/tests').send({ ...session, maxMarks: -5, entries: [{ studentName: 'Aarav', marksObtained: 9 }] });
        const list = await request(app).get('/tests');
        expect(list.body.data[0].maxMarks).toBeNull();
    });
});

describe('Test Tracker — filters', () => {
    beforeEach(async () => {
        await request(app).post('/tests').send(session);
        await request(app).post('/tests').send({
            ...session, subject: 'Science', testTopic: 'Cells', teacherName: 'Rehana',
            entries: [{ studentName: 'Aarav', marksObtained: 9 }],
        });
    });

    test('filters by subject', async () => {
        const res = await request(app).get('/tests?subject=Science');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].subject).toBe('Science');
    });

    test('filters by teacherName', async () => {
        const res = await request(app).get('/tests?teacherName=Rehana');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].teacherName).toBe('Rehana');
    });

    test('filters by a date range', async () => {
        const inRange = await request(app).get('/tests?startDate=2026-07-01&endDate=2026-07-31');
        expect(inRange.body.data.length).toBe(3);
        const outOfRange = await request(app).get('/tests?startDate=2026-08-01&endDate=2026-08-31');
        expect(outOfRange.body.data.length).toBe(0);
    });

    test('meta surfaces distinct grades and subjects', async () => {
        const res = await request(app).get('/tests/meta');
        expect(res.body.data.gradesOrYears).toContain('Grade 9');
        expect(res.body.data.subjects.sort()).toEqual(['Maths', 'Science']);
    });

    test('an unparseable date param is a 400, not a 404', async () => {
        const res = await request(app).get('/tests?date=notadate');
        expect(res.status).toBe(400);
    });
});

describe('Test Tracker — edit & delete', () => {
    test('edit corrects a single mark; delete removes the row', async () => {
        await request(app).post('/tests').send(session);
        const list = await request(app).get('/tests');
        const row = list.body.data.find((r) => r.studentName === 'Aarav');

        const edited = await request(app).put(`/tests/${row._id}`).send({ marksObtained: 19 });
        expect(edited.status).toBe(200);
        expect(edited.body.data.marksObtained).toBe(19);

        const del = await request(app).delete(`/tests/${row._id}`);
        expect(del.status).toBe(200);
        const after = await request(app).get('/tests');
        expect(after.body.data).toHaveLength(1);
    });
});
