// Skillhub Institute — schedule workbook upload (Timetable → Upload Schedule).
//
// Two layers: the pure parser, and the endpoint (multer + per-teacher replace).
// The load-bearing spec is "re-upload replaces ONLY the teachers in the file" —
// that's what makes it safe to hand a bulk import to the branch login.

const express = require('express');
const request = require('supertest');
const multer = require('multer');
const XLSX = require('xlsx');
const {
    startInMemoryMongo,
    stopInMemoryMongo,
    clearAllCollections,
    makeAdmin,
    makeSkillhub,
} = require('../exports/_setup');

const Teacher = require('../../models/Teacher');
const TimetableEntry = require('../../models/TimetableEntry');
require('../../models/Student');
const { parseScheduleWorkbook } = require('../../services/institute/scheduleParser');
const c = require('../../controllers/instituteController');

const INSTITUTE_USER = makeSkillhub({ organization: 'skillhub_institute' });
const TRAINING_USER = makeSkillhub({ organization: 'skillhub_training' });

const upload = multer({ storage: multer.memoryStorage() });

function makeApp(user) {
    const app = express();
    app.use((req, _res, next) => { req.user = user; next(); });
    app.post('/timetable/import', upload.single('file'), c.importTimetable);
    app.use((err, _req, res, _next) => res.status(500).json({ success: false, message: err.message }));
    return app;
}
const app = makeApp(INSTITUTE_USER);

// One sheet per teacher, mirroring the teachers' real layout.
const HEADER = ['Day', 'Time', 'Grade / Student', 'Year', 'Subject', 'Curriculum'];
function workbook(sheets) {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), name);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const FAHAD = [
    ['Monday', '12.30 pm - 1.30 pm', 'Grade 9', 9, 'Maths', 'CBSE'],
    ['Tuesday', '5 pm - 6 pm', 'Deneth / Mohd. Thekkil', 10, 'Physics', 'IGCSE'],
];
const REHANA = [['Wednesday', '9 am - 10 am', 'Grade 8', 8, 'English', 'CBSE']];

const post = (buf, { dryRun, as = app, filename = 'schedule.xlsx' } = {}) =>
    request(as).post('/timetable/import').field('dryRun', String(dryRun)).attach('file', buf, filename);

beforeAll(async () => { await startInMemoryMongo(); });
afterAll(async () => { await stopInMemoryMongo(); });
beforeEach(async () => { await clearAllCollections(); });

describe('parser', () => {
    test('reads one sheet per teacher into sessions', () => {
        const { teachers, timetable } = parseScheduleWorkbook(workbook({ Fahad: FAHAD, Rehana: REHANA }));
        expect(teachers.map((t) => t.name).sort()).toEqual(['Fahad', 'Rehana']);
        expect(timetable).toHaveLength(3);
        const mon = timetable.find((r) => r.dayOfWeek === 'Monday');
        expect(mon.teacherName).toBe('Fahad');
        expect(mon.gradeOrYear).toBe('Grade 9');       // CBSE → "Grade"
        expect(mon.startMinutes).toBe(12 * 60 + 30);   // 12.30 pm
    });

    test('IGCSE rows label the year, and student names come out of the label', () => {
        const { timetable } = parseScheduleWorkbook(workbook({ Fahad: FAHAD }));
        const tue = timetable.find((r) => r.dayOfWeek === 'Tuesday');
        expect(tue.gradeOrYear).toBe('Year 10');       // non-CBSE → "Year"
        expect(tue.studentNames).toEqual(['Deneth', 'Mohd. Thekkil']);
    });

    test('skips rows whose first column is not a weekday, and warns on empty sheets', () => {
        const { timetable, warnings } = parseScheduleWorkbook(
            workbook({
                Fahad: [['Weekly Schedule', '', '', '', '', ''], ...FAHAD, ['', '', '', '', '', '']],
                Summary: [],
            })
        );
        expect(timetable).toHaveLength(2);
        expect(warnings.join(' ')).toMatch(/Summary/);
    });

    test('canonicalizes subject spellings so imports do not reintroduce duplicates', () => {
        const { timetable } = parseScheduleWorkbook(
            workbook({ Fahad: [['Monday', '9 am - 10 am', 'Grade 9', 9, 'Mathematics', 'CBSE']] })
        );
        // Whatever the canonical spelling is, it must equal the one the pickers
        // use for the alias 'Maths' — i.e. both map to the same value.
        const { canonicalizeSubject } = require('../../config/instituteSubjects');
        expect(timetable[0].subject).toBe(canonicalizeSubject('Maths'));
    });

    // Excel merges the Day cell down each day's block, so continuation rows
    // arrive blank. Before this was handled the parser dropped them silently
    // and the per-teacher replace then DELETED those real sessions.
    test('merged Day cells: blank day rows inherit the day above', () => {
        const { timetable, warnings } = parseScheduleWorkbook(
            workbook({
                Fahad: [
                    ['Monday', '9 am - 10 am', 'Grade 9', 9, 'Maths', 'CBSE'],
                    ['', '10 am - 11 am', 'Grade 8', 8, 'Physics', 'CBSE'],
                    ['', '11 am - 12 pm', 'Grade 7', 7, 'Chemistry', 'CBSE'],
                    ['Tuesday', '9 am - 10 am', 'Grade 9', 9, 'Biology', 'CBSE'],
                ],
            })
        );
        expect(timetable).toHaveLength(4);
        expect(timetable.map((r) => r.dayOfWeek)).toEqual(['Monday', 'Monday', 'Monday', 'Tuesday']);
        expect(warnings).toEqual([]);
    });

    test('abbreviated and date-formatted day cells are understood', () => {
        const { timetable } = parseScheduleWorkbook(
            workbook({
                Fahad: [
                    ['Mon', '9 am - 10 am', 'Grade 9', 9, 'Maths', 'CBSE'],
                    ['Thurs', '10 am - 11 am', 'Grade 9', 9, 'Physics', 'CBSE'],
                    [new Date('2026-08-05T00:00:00Z'), '11 am - 12 pm', 'Grade 9', 9, 'Biology', 'CBSE'],
                ],
            })
        );
        expect(timetable.map((r) => r.dayOfWeek)).toEqual(['Monday', 'Thursday', 'Wednesday']);
    });

    test('a data row whose day cell is unreadable is REPORTED, never dropped silently', () => {
        const { timetable, warnings } = parseScheduleWorkbook(
            workbook({
                Fahad: [
                    ['Monday', '9 am - 10 am', 'Grade 9', 9, 'Maths', 'CBSE'],
                    ['whenever', '10 am - 11 am', 'Grade 8', 8, 'Physics', 'CBSE'],
                ],
            })
        );
        expect(timetable).toHaveLength(1);
        expect(warnings.join(' ')).toMatch(/Day column could not be read/i);
        expect(warnings.join(' ')).toMatch(/row 3/); // 1-based Excel row
    });

    test('rejects a file with no weekday rows anywhere', () => {
        expect(() => parseScheduleWorkbook(workbook({ Notes: [['hello', '', '', '', '', '']] })))
            .toThrow(/No sessions found/i);
    });

    test('rejects a non-workbook buffer', () => {
        expect(() => parseScheduleWorkbook(Buffer.from('not a spreadsheet'))).toThrow();
    });
});

describe('import endpoint', () => {
    test('a Training login is rejected', async () => {
        const res = await post(workbook({ Fahad: FAHAD }), { dryRun: true, as: makeApp(TRAINING_USER) });
        expect(res.status).toBe(403);
    });

    test('missing file is a 400', async () => {
        const res = await request(app).post('/timetable/import').field('dryRun', 'true');
        expect(res.status).toBe(400);
    });

    test('dryRun previews and writes nothing', async () => {
        const res = await post(workbook({ Fahad: FAHAD, Rehana: REHANA }), { dryRun: true });
        expect(res.status).toBe(200);
        expect(res.body.data.applied).toBe(false);
        expect(res.body.data.totalSessions).toBe(3);
        expect(res.body.data.teachers).toHaveLength(2);
        expect(res.body.data.teachers.every((t) => t.isNew)).toBe(true);
        expect(await TimetableEntry.countDocuments()).toBe(0);
        expect(await Teacher.countDocuments()).toBe(0);
    });

    test('applying creates the teachers and their sessions', async () => {
        const res = await post(workbook({ Fahad: FAHAD, Rehana: REHANA }), { dryRun: false });
        expect(res.status).toBe(200);
        expect(res.body.data.applied).toBe(true);
        expect(res.body.data.inserted).toBe(3);

        const entries = await TimetableEntry.find({ organization: 'skillhub_institute' }).lean();
        expect(entries).toHaveLength(3);
        expect(entries.every((e) => e.teacher)).toBe(true);
        const teachers = await Teacher.find({ organization: 'skillhub_institute' }).lean();
        expect(teachers.map((t) => t.name).sort()).toEqual(['Fahad', 'Rehana']);
    });

    test('re-uploading ONE teacher replaces only that teacher, leaving others intact', async () => {
        await post(workbook({ Fahad: FAHAD, Rehana: REHANA }), { dryRun: false });
        const rehanaBefore = await TimetableEntry.find({ teacherName: 'Rehana' }).lean();
        expect(rehanaBefore).toHaveLength(1);

        // Fahad re-sends his sheet with a different, single session.
        const res = await post(
            workbook({ Fahad: [['Friday', '3 pm - 4 pm', 'Grade 7', 7, 'Chemistry', 'CBSE']] }),
            { dryRun: false }
        );
        expect(res.status).toBe(200);

        const fahadAfter = await TimetableEntry.find({ teacherName: 'Fahad' }).lean();
        expect(fahadAfter).toHaveLength(1);
        expect(fahadAfter[0].dayOfWeek).toBe('Friday');

        const rehanaAfter = await TimetableEntry.find({ teacherName: 'Rehana' }).lean();
        expect(rehanaAfter).toHaveLength(1);
        expect(String(rehanaAfter[0]._id)).toBe(String(rehanaBefore[0]._id)); // untouched
    });

    test('re-uploading reuses the teacher doc rather than duplicating it', async () => {
        await post(workbook({ Fahad: FAHAD }), { dryRun: false });
        const first = await Teacher.find({ name: 'Fahad' }).lean();
        await post(workbook({ Fahad: REHANA }), { dryRun: false });
        const second = await Teacher.find({ name: 'Fahad' }).lean();
        expect(second).toHaveLength(1);
        expect(String(second[0]._id)).toBe(String(first[0]._id));
        // Subjects union so a manually-added subject isn't lost on re-import.
        expect(second[0].subjects.length).toBeGreaterThanOrEqual(first[0].subjects.length);
    });

    test('a previously deactivated teacher is revived by an upload', async () => {
        await post(workbook({ Fahad: FAHAD }), { dryRun: false });
        await Teacher.updateOne({ name: 'Fahad' }, { $set: { isActive: false } });
        await post(workbook({ Fahad: FAHAD }), { dryRun: false });
        const t = await Teacher.findOne({ name: 'Fahad' }).lean();
        expect(t.isActive).toBe(true);
    });

    // Everything is validated before the first write. Otherwise a bad row in
    // the LAST teacher's sheet 500s after earlier teachers were already
    // replaced — "Import failed" on screen, half the timetable overwritten.
    test('an invalid row rejects the whole upload before anything is written', async () => {
        await post(workbook({ Rehana: REHANA }), { dryRun: false });
        const before = await TimetableEntry.countDocuments();

        const res = await post(
            workbook({
                Alpha: [['Monday', '9 am - 10 am', 'Grade 9', 9, 'Maths', 'CBSE']],
                Beta: [['Tuesday', '', 'Grade 8', 8, 'Physics', 'CBSE']], // time is required
            }),
            { dryRun: false }
        );

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/nothing was imported/i);
        // Alpha must NOT have been applied, and Rehana must be untouched.
        expect(await TimetableEntry.countDocuments({ teacherName: 'Alpha' })).toBe(0);
        expect(await TimetableEntry.countDocuments()).toBe(before);
    });

    test('two sheets whose names normalize alike collapse into one teacher', async () => {
        const res = await post(
            workbook({
                Fahad: [['Monday', '9 am - 10 am', 'Grade 9', 9, 'Maths', 'CBSE']],
                'fahad ': [['Tuesday', '10 am - 11 am', 'Grade 8', 8, 'Physics', 'CBSE']],
            }),
            { dryRun: false }
        );
        expect(res.status).toBe(200);
        const teachers = await Teacher.find({ organization: 'skillhub_institute' }).lean();
        expect(teachers).toHaveLength(1);
        // Both sheets' sessions survive — the second pass must not delete the first's.
        const entries = await TimetableEntry.find({}).lean();
        expect(entries).toHaveLength(2);
        expect(res.body.data.inserted).toBe(entries.length);
    });

    test('preview reports how many existing sessions would be replaced', async () => {
        await post(workbook({ Fahad: FAHAD }), { dryRun: false });
        const res = await post(workbook({ Fahad: REHANA }), { dryRun: true });
        expect(res.body.data.replacingSessions).toBe(2);
        expect(res.body.data.teachers[0].isNew).toBe(false);
    });
});

describe('admin access', () => {
    test('admin can import', async () => {
        const res = await post(workbook({ Fahad: FAHAD }), { dryRun: true, as: makeApp(makeAdmin()) });
        expect(res.status).toBe(200);
    });
});
