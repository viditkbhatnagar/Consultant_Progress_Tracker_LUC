// Student birthday reminders — the branch asked to be told, on the morning of
// (and the day before), that a student has a birthday so they can wish them.
// These specs pin the month/day matching (the birth YEAR must be ignored),
// the idempotency that lets the daily cron retry safely, and the org scoping.

const mongoose = require('mongoose');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
} = require('../exports/_setup');

const Student = require('../../models/Student');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const {
    runBirthdayNotifications,
    findBirthdays,
    localDateParts,
    addDays,
    ageTurning,
} = require('../../services/birthdayNotifier');

const INSTITUTE = 'skillhub_institute';

// 14 Jun 2026, 09:00 Dubai — a fixed "now" so the specs never depend on the
// day they run.
const NOW = new Date('2026-06-14T05:00:00Z');

const makeStudent = (over = {}) => ({
    organization: INSTITUTE,
    studentName: 'Test Student',
    teamLead: new mongoose.Types.ObjectId(),
    sno: Math.floor(Math.random() * 100000),
    curriculum: 'CBSE',
    curriculumSlug: 'CBSE',
    ...over,
});

async function seedUsers() {
    await User.create([
        { name: 'Institute', email: 'inst@x.com', password: 'x1234567', role: 'skillhub', organization: INSTITUTE },
        { name: 'Admin', email: 'admin@x.com', password: 'x1234567', role: 'admin', organization: 'luc' },
        { name: 'Other TL', email: 'tl@x.com', password: 'x1234567', role: 'team_lead', organization: 'luc' },
    ]);
}

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

describe('date helpers', () => {
    test('localDateParts reads the Dubai calendar date, not UTC', () => {
        // 21:30 UTC on 13 Jun is already 01:30 on 14 Jun in Dubai (UTC+4).
        expect(localDateParts(new Date('2026-06-13T21:30:00Z')))
            .toEqual({ year: 2026, month: 6, day: 14 });
    });

    test('addDays rolls across a month end', () => {
        expect(addDays({ year: 2026, month: 6, day: 30 }, 1)).toEqual({ year: 2026, month: 7, day: 1 });
    });

    test('ageTurning uses the target year, not today', () => {
        expect(ageTurning(new Date('2009-06-14T00:00:00Z'), { year: 2026 })).toBe(17);
        expect(ageTurning(new Date('1800-01-01T00:00:00Z'), { year: 2026 })).toBeNull();
    });
});

describe('findBirthdays', () => {
    test('matches on month + day, ignoring the birth year', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Born 2009', dob: new Date('2009-06-14T00:00:00Z') }),
            makeStudent({ studentName: 'Born 2012', dob: new Date('2012-06-14T00:00:00Z') }),
            makeStudent({ studentName: 'Different day', dob: new Date('2010-06-15T00:00:00Z') }),
            makeStudent({ studentName: 'Same day other month', dob: new Date('2010-07-14T00:00:00Z') }),
        ]);
        const found = await findBirthdays({ year: 2026, month: 6, day: 14 });
        expect(found.map((s) => s.studentName).sort()).toEqual(['Born 2009', 'Born 2012']);
    });

    test('students without a dob are ignored', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'No dob' }),
            makeStudent({ studentName: 'Null dob', dob: null }),
        ]);
        expect(await findBirthdays({ year: 2026, month: 6, day: 14 })).toHaveLength(0);
    });

    test('other organizations are not matched', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'LUC kid', organization: 'luc', dob: new Date('2009-06-14T00:00:00Z') }),
        ]);
        expect(await findBirthdays({ year: 2026, month: 6, day: 14 })).toHaveLength(0);
    });
});

describe('runBirthdayNotifications', () => {
    beforeEach(seedUsers);

    test('notifies the Institute login and admins, but not unrelated team leads', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Aarav', yearOrGrade: 'Grade 9', dob: new Date('2009-06-14T00:00:00Z') }),
        ]);
        const res = await runBirthdayNotifications({ now: NOW });
        expect(res.today).toBe(1);

        const notes = await Notification.find({ type: 'student_birthday' }).lean();
        expect(notes).toHaveLength(2); // institute + admin, NOT the LUC team lead
        expect(notes[0].title).toBe('🎂 Birthday today — Aarav');
        expect(notes[0].message).toContain('Grade 9');
        expect(notes[0].message).toContain('turns 17');
        expect(notes[0].priority).toBe('high');
    });

    test('posts a separate heads-up for tomorrow', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Today Kid', dob: new Date('2009-06-14T00:00:00Z') }),
            makeStudent({ studentName: 'Tomorrow Kid', dob: new Date('2009-06-15T00:00:00Z') }),
        ]);
        const res = await runBirthdayNotifications({ now: NOW });
        expect(res.today).toBe(1);
        expect(res.tomorrow).toBe(1);

        const titles = (await Notification.find({ type: 'student_birthday' }).lean()).map((n) => n.title);
        expect(titles).toContain('🎂 Birthday today — Today Kid');
        expect(titles).toContain('🎂 Birthday tomorrow — Tomorrow Kid');
    });

    test('several birthdays on one day collapse into a single notification', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Alpha', dob: new Date('2009-06-14T00:00:00Z') }),
            makeStudent({ studentName: 'Beta', dob: new Date('2010-06-14T00:00:00Z') }),
        ]);
        await runBirthdayNotifications({ now: NOW });
        const notes = await Notification.find({ title: /birthdays today/ }).lean();
        expect(notes).toHaveLength(2); // one per recipient, not one per student
        expect(notes[0].title).toBe('🎂 2 birthdays today');
        expect(notes[0].message).toBe('Alpha (turns 17), Beta (turns 16)');
    });

    test('re-running the same day posts nothing extra (cron-safe)', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Aarav', dob: new Date('2009-06-14T00:00:00Z') }),
        ]);
        const first = await runBirthdayNotifications({ now: NOW });
        expect(first.created).toBe(2);
        const second = await runBirthdayNotifications({ now: NOW });
        expect(second.created).toBe(0);
        expect(await Notification.countDocuments({ type: 'student_birthday' })).toBe(2);
    });

    test('a day with no birthdays writes nothing', async () => {
        await Student.collection.insertMany([
            makeStudent({ studentName: 'Nobody', dob: new Date('2009-01-01T00:00:00Z') }),
        ]);
        const res = await runBirthdayNotifications({ now: NOW });
        expect(res.created).toBe(0);
        expect(await Notification.countDocuments()).toBe(0);
    });
});
