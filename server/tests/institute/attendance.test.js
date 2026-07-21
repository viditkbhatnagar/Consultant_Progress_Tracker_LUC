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
require('../../models/InstituteEnrollment');
require('../../models/Student');
const c = require('../../controllers/instituteController');

const INSTITUTE_USER = makeSkillhub({ organization: 'skillhub_institute' });
const TRAINING_USER = makeSkillhub({ organization: 'skillhub_training' });

function makeApp(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.get('/attendance/meta', c.getAttendanceMeta);
    app.get('/attendance/roster', c.getRoster);
    app.post('/attendance/roster', c.addRosterStudent);
    app.delete('/attendance/roster', c.removeRosterStudent);
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

// The branch reported: "she's adding Aishwarya in Grade 11 Accountancy, saving
// it, but she cannot see it." Adding used to be local-only, and the roster was
// derived from marks, so an unmarked student was never persisted.
describe('Attendance — adding a student sticks without marking them', () => {
    const add = (over = {}) => ({
        gradeOrYear: 'Grade 11', subject: 'Accountancy', studentName: 'Aishwarya Aswani Kumar', ...over,
    });

    test('an added student appears on the roster before any mark exists', async () => {
        const res = await request(app).post('/attendance/roster').send(add());
        expect(res.status).toBe(201);
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(roster.body.data.map((r) => r.studentName)).toEqual(['Aishwarya Aswani Kumar']);
    });

    test('they survive a reload with no attendance rows written', async () => {
        await request(app).post('/attendance/roster').send(add());
        const marks = await request(app).get('/attendance?gradeOrYear=Grade 11&subject=Accountancy');
        expect(marks.body.data).toHaveLength(0); // nothing marked yet…
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(roster.body.data).toHaveLength(1); // …but still on the list
    });

    test('adding is per subject — they do not leak into another subject', async () => {
        await request(app).post('/attendance/roster').send(add());
        const other = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Economics');
        expect(other.body.data).toHaveLength(0);
    });

    test('re-adding the same student is idempotent', async () => {
        await request(app).post('/attendance/roster').send(add());
        await request(app).post('/attendance/roster').send(add());
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(roster.body.data).toHaveLength(1);
    });

    test('a linked student keeps its Student ref (so it is not "unlinked")', async () => {
        const studentId = new (require('mongoose').Types.ObjectId)();
        await request(app).post('/attendance/roster').send(add({ student: String(studentId) }));
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(String(roster.body.data[0].student)).toBe(String(studentId));
    });

    test('adding without a subject is rejected', async () => {
        const res = await request(app).post('/attendance/roster').send(add({ subject: '' }));
        expect(res.status).toBe(400);
    });

    test('marking a student also enrolls them, so the old flow self-heals', async () => {
        await request(app).post('/attendance').send(mark({
            gradeOrYear: 'Grade 11', subject: 'Accountancy',
            entries: [{ studentName: 'Zoya', status: 'Present' }],
        }));
        // Cancel the only mark — enrollment keeps her on the list.
        await request(app).delete('/attendance/entry')
            .send({ gradeOrYear: 'Grade 11', subject: 'Accountancy', date: '2026-07-07', studentName: 'Zoya' });
        const roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(roster.body.data.map((r) => r.studentName)).toContain('Zoya');
    });

    // A student can land on a grade's roster via a stray TEST record, not just
    // attendance. Removal has to clear that too or they can never be deleted —
    // which is exactly what the branch hit with a Grade 8 student stuck in
    // Grade 10 by one mis-entered test result.
    test('removing with NO subject clears the whole grade, including test records', async () => {
        const TestRecord = require('mongoose').model('TestRecord');
        await TestRecord.create({
            organization: 'skillhub_institute', date: new Date('2026-07-21'),
            studentName: 'Faizan', gradeOrYear: 'Grade 10', subject: 'biology', marksObtained: 5,
        });
        // Sourced purely from the test record — no attendance at all.
        let roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 10');
        expect(roster.body.data.map((r) => r.studentName)).toContain('Faizan');

        const res = await request(app).delete('/attendance/roster')
            .send({ gradeOrYear: 'Grade 10', studentName: 'Faizan' });
        expect(res.status).toBe(200);
        expect(res.body.data.testsRemoved).toBe(1);

        roster = await request(app).get('/attendance/roster?gradeOrYear=Grade 10');
        expect(roster.body.data.map((r) => r.studentName)).not.toContain('Faizan');
    });

    test('removing with no subject does not touch the student in OTHER grades', async () => {
        await request(app).post('/attendance/roster').send(add({ gradeOrYear: 'Grade 8', subject: 'Biology', studentName: 'Faizan' }));
        await request(app).post('/attendance/roster').send(add({ gradeOrYear: 'Grade 10', subject: 'Biology', studentName: 'Faizan' }));
        await request(app).delete('/attendance/roster').send({ gradeOrYear: 'Grade 10', studentName: 'Faizan' });
        const g8 = await request(app).get('/attendance/roster?gradeOrYear=Grade 8&subject=Biology');
        expect(g8.body.data.map((r) => r.studentName)).toEqual(['Faizan']);
    });

    test('removing from a subject clears the list entry and that subject only', async () => {
        await request(app).post('/attendance/roster').send(add());
        await request(app).post('/attendance/roster').send(add({ subject: 'Economics' }));
        await request(app).delete('/attendance/roster')
            .send({ gradeOrYear: 'Grade 11', subject: 'Accountancy', studentName: 'Aishwarya Aswani Kumar' });
        const gone = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Accountancy');
        expect(gone.body.data).toHaveLength(0);
        const kept = await request(app).get('/attendance/roster?gradeOrYear=Grade 11&subject=Economics');
        expect(kept.body.data).toHaveLength(1);
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
