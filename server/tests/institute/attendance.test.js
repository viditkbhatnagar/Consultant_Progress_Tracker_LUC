// Skillhub Institute — Attendance specs. Locks in the two bugs the branch
// reported:
//   1. a student added under one subject appeared under EVERY subject of that
//      grade, because the roster was derived grade-wide with no subject filter;
//   2. cancelling one wrong mark deleted the student's entire history for the
//      grade, because the only delete endpoint was "remove student".
// Also covers legacy-spelling tolerance ("Maths" rows still match "Math").

const express = require('express');
const request = require('supertest');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    makeSkillhub,
} = require('../exports/_setup');

require('../../models/Attendance');
require('../../models/TestRecord');
require('../../models/TimetableEntry');
const c = require('../../controllers/instituteController');

const INSTITUTE_USER = makeSkillhub({ organization: 'skillhub_institute' });
const TRAINING_USER = makeSkillhub({ organization: 'skillhub_training' });

function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get('/attendance/meta', c.getAttendanceMeta);
    app.get('/attendance/roster', c.getRoster);
    app.get('/attendance', c.getAttendance);
    app.post('/attendance', c.markAttendance);
    app.delete('/attendance/entry', c.deleteAttendanceEntry);
    app.delete('/attendance/student', c.deleteAttendanceStudent);
    app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));
    return app;
}
const app = makeApp(INSTITUTE_USER);

const mark = (over = {}) => ({
    date: '2026-07-07',
    gradeOrYear: 'Year 13',
    subject: 'Biology',
    entries: [{ studentName: 'Christiano', status: 'Present' }],
    ...over,
});

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

describe('Attendance — access', () => {
    test('a Training login is rejected (Institute-only)', async () => {
        const res = await request(makeApp(TRAINING_USER)).post('/attendance').send(mark());
        expect(res.status).toBe(403);
    });
});

describe('Attendance — roster is scoped to the subject (bug 1)', () => {
    beforeEach(async () => {
        // Christiano only does Biology; Mahi only does Chemistry. Same grade.
        await request(app).post('/attendance').send(mark());
        await request(app).post('/attendance').send(mark({
            subject: 'Chemistry',
            entries: [{ studentName: 'Mahi', status: 'Present' }],
        }));
    });

    test('a Biology student does NOT appear under Chemistry', async () => {
        const res = await request(app).get('/attendance/roster?gradeOrYear=Year 13&subject=Chemistry');
        const names = res.body.data.map((r) => r.studentName);
        expect(names).toContain('Mahi');
        expect(names).not.toContain('Christiano');
    });

    test('the Biology roster contains only the Biology student', async () => {
        const res = await request(app).get('/attendance/roster?gradeOrYear=Year 13&subject=Biology');
        const names = res.body.data.map((r) => r.studentName);
        expect(names).toEqual(['Christiano']);
    });

    test('omitting subject still returns the whole grade (report view)', async () => {
        const res = await request(app).get('/attendance/roster?gradeOrYear=Year 13');
        const names = res.body.data.map((r) => r.studentName).sort();
        expect(names).toEqual(['Christiano', 'Mahi']);
    });
});

describe('Attendance — cancel one entry (bug 2)', () => {
    beforeEach(async () => {
        // Mahi marked on two dates; the 7th is the mistake (no class that day).
        await request(app).post('/attendance').send(mark({
            date: '2026-07-06', entries: [{ studentName: 'Mahi', status: 'Present' }],
        }));
        await request(app).post('/attendance').send(mark({
            date: '2026-07-07', entries: [{ studentName: 'Mahi', status: 'Present' }],
        }));
    });

    test('removes only that date and keeps the rest of the history', async () => {
        const res = await request(app).delete('/attendance/entry')
            .send({ gradeOrYear: 'Year 13', subject: 'Biology', date: '2026-07-07', studentName: 'Mahi' });
        expect(res.status).toBe(200);
        expect(res.body.data.removed).toBe(1);

        const left = await request(app).get('/attendance?gradeOrYear=Year 13&studentName=Mahi');
        expect(left.body.data).toHaveLength(1);
        expect(new Date(left.body.data[0].date).toISOString().slice(0, 10)).toBe('2026-07-06');
    });

    test('the student stays on the roster after cancelling one mark', async () => {
        await request(app).delete('/attendance/entry')
            .send({ gradeOrYear: 'Year 13', subject: 'Biology', date: '2026-07-07', studentName: 'Mahi' });
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Year 13&subject=Biology');
        expect(roster.body.data.map((r) => r.studentName)).toContain('Mahi');
    });

    test('date is required — it must never fall back to deleting everything', async () => {
        const res = await request(app).delete('/attendance/entry')
            .send({ gradeOrYear: 'Year 13', subject: 'Biology', studentName: 'Mahi' });
        expect(res.status).toBe(400);
        const left = await request(app).get('/attendance?gradeOrYear=Year 13&studentName=Mahi');
        expect(left.body.data).toHaveLength(2);
    });

    test('remove-student still wipes the whole grade history (unchanged)', async () => {
        await request(app).delete('/attendance/student')
            .send({ gradeOrYear: 'Year 13', studentName: 'Mahi' });
        const left = await request(app).get('/attendance?gradeOrYear=Year 13&studentName=Mahi');
        expect(left.body.data).toHaveLength(0);
    });
});

describe('Attendance — legacy subject spellings still match', () => {
    test('a row stored as "Maths" is found when filtering by canonical "Math"', async () => {
        await request(app).post('/attendance').send(mark({
            subject: 'Maths', entries: [{ studentName: 'Aarav', status: 'Present' }],
        }));
        const res = await request(app).get('/attendance?gradeOrYear=Year 13&subject=Math');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].studentName).toBe('Aarav');
    });

    test('re-marking as "Math" replaces the legacy "Maths" row instead of duplicating', async () => {
        await request(app).post('/attendance').send(mark({
            subject: 'Maths', entries: [{ studentName: 'Aarav', status: 'Present' }],
        }));
        await request(app).post('/attendance').send(mark({
            subject: 'Math', entries: [{ studentName: 'Aarav', status: 'Absent' }],
        }));
        const res = await request(app).get('/attendance?gradeOrYear=Year 13&subject=Math');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].status).toBe('Absent');
        expect(res.body.data[0].subject).toBe('Math');
    });

    test('the roster is spelling-tolerant too', async () => {
        await request(app).post('/attendance').send(mark({
            subject: 'Maths', entries: [{ studentName: 'Aarav', status: 'Present' }],
        }));
        const res = await request(app).get('/attendance/roster?gradeOrYear=Year 13&subject=Math');
        expect(res.body.data.map((r) => r.studentName)).toEqual(['Aarav']);
    });
});
