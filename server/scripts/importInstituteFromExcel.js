/**
 * One-time import of the Skillhub Institute timetable + attendance from the two
 * Excel workbooks into the teachers / timetableentries / attendances collections.
 *
 *   node scripts/importInstituteFromExcel.js <schedule.xlsx> <attendance.xlsx> [--dry-run]
 *
 * --dry-run parses + reports counts and unmatched student names WITHOUT writing.
 * A real run clears existing skillhub_institute rows in those three collections
 * first (idempotent for this brand-new feature), then inserts fresh.
 *
 * Student names are matched to existing skillhub_institute Student docs (exact
 * normalized name, else unique first-name match); unmatched names are kept as
 * text and listed for reconciliation.
 *
 * Uses raw collections (no Mongoose models) so it can run with just xlsx +
 * mongoose on the path.
 */
require('dotenv').config({ path: process.env.ENV_PATH || undefined });
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const INSTITUTE = 'skillhub_institute';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const [schedulePath, attendancePath] = args.filter((a) => !a.startsWith('--'));

const norm = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
const lc = (s) => norm(s).toLowerCase();

function parseStartMinutes(time) {
    const m = String(time || '').match(/(\d{1,2})[.:]?(\d{2})?\s*(am|pm)/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3].toLowerCase();
    if (ap === 'pm' && hh !== 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return hh * 60 + mm;
}

const dayOf = (v) => {
    const d = lc(v);
    return DAYS.find((x) => x.toLowerCase() === d) || null;
};
const isCbse = (cur) => /cbse/i.test(cur || '');

// Grade/year label consistent across timetable + attendance so they link.
function gradeLabel(numOrText, curriculum) {
    const n = String(numOrText || '').match(/\d+/);
    if (!n) return norm(numOrText);
    return `${isCbse(curriculum) ? 'Grade' : 'Year'} ${n[0]}`;
}
function sheetGradeLabel(title) {
    const t = norm(title);
    let m = t.match(/^G\s*(\d+)$/i);
    if (m) return `Grade ${m[1]}`;
    m = t.match(/^Y\s*(\d+)$/i);
    if (m) return `Year ${m[1]}`;
    return t; // Neet, IELTS, English
}

// Extract candidate student names from a "Grade / Student" cell, dropping the
// grade token. "Deneth / Mohd. Thekkil" -> [Deneth, Mohd. Thekkil];
// "8 (Rishi, Annie and Tanushri)" -> [Rishi, Annie, Tanushri]; "12 / Taksheel"
// -> [Taksheel]; "Grade 9" -> [].
function studentsFromLabel(label) {
    let s = norm(label);
    const paren = s.match(/\(([^)]*)\)/);
    let names = [];
    if (paren) names = paren[1].split(/,|\band\b/i);
    else names = s.replace(/\bgrade\b/gi, '').split(/[/,]| and /i);
    return names
        .map((x) => norm(x).replace(/^\d+\s*/, '').trim())
        .filter((x) => x && !/^\d+$/.test(x) && !/^grade\s*\d*$/i.test(x));
}

// ── Parse the schedule workbook → teachers[] + timetable[] ─────────────────
function parseSchedule(path) {
    const wb = XLSX.readFile(path, { cellDates: true });
    const teachers = [];
    const timetable = [];
    for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
        if (!rows.length) continue;
        const header = (rows[0] || []).map(norm);
        const idx = (label) => header.findIndex((h) => lc(h) === lc(label));
        const iTime = idx('Time');
        const iGS = idx('Grade / Student') >= 0 ? idx('Grade / Student') : 2;
        const iYear = idx('Year') >= 0 ? idx('Year') : idx('Grade/Year');
        const iSubject = idx('Subject');
        const iCur = idx('Curriculum') >= 0 ? idx('Curriculum') : idx('Syllabus');
        const subjectsSet = new Set();
        let count = 0;
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const day = dayOf(row[0]);
            if (!day) continue;
            const time = norm(row[iTime >= 0 ? iTime : 1]);
            const gsLabel = norm(row[iGS]);
            const curriculum = iCur >= 0 ? norm(row[iCur]) : '';
            const subject = iSubject >= 0 ? norm(row[iSubject]) : '';
            const yearVal = iYear >= 0 ? row[iYear] : gsLabel;
            const gradeOrYear = gradeLabel(yearVal, curriculum);
            if (subject) subjectsSet.add(subject);
            timetable.push({
                teacherName: norm(name),
                dayOfWeek: day,
                time,
                startMinutes: parseStartMinutes(time),
                gradeOrYear,
                curriculum,
                subject,
                studentLabel: gsLabel,
                studentNames: studentsFromLabel(gsLabel),
            });
            count++;
        }
        teachers.push({ name: norm(name), subjects: [...subjectsSet], sessions: count });
    }
    return { teachers, timetable };
}

// ── Parse the attendance workbook → attendance[] ───────────────────────────
function parseAttendance(path) {
    const wb = XLSX.readFile(path, { cellDates: true });
    const records = [];
    const perSheet = {};
    for (const name of wb.SheetNames) {
        const gradeOrYear = sheetGradeLabel(name);
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        // Find the header row: col A === 'Date'. Student names sit one row above,
        // from col C onward (col B is 'Subject').
        let hdr = rows.findIndex((r) => lc((r || [])[0]) === 'date');
        if (hdr < 0) { perSheet[name] = 0; continue; }
        const nameRow = rows[hdr - 1] || [];
        const studentCols = [];
        for (let c = 2; c < nameRow.length; c++) {
            const v = norm(nameRow[c]);
            const junk = ['name', 'subject', 'attendance', 'date', 'maths'].includes(lc(v))
                || /^column\s*\d+$/i.test(v) || /^\d+$/.test(v);
            if (v && !junk) studentCols.push({ c, name: v });
        }
        let n = 0;
        for (let r = hdr + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const dcell = row[0];
            const date = dcell instanceof Date ? dcell : null;
            if (!date || Number.isNaN(date.getTime())) continue;
            const subject = norm(row[1]);
            for (const sc of studentCols) {
                const st = lc(row[sc.c]);
                if (st === 'present' || st === 'absent') {
                    records.push({
                        date,
                        studentName: sc.name,
                        gradeOrYear,
                        subject,
                        status: st === 'present' ? 'Present' : 'Absent',
                    });
                    n++;
                }
            }
        }
        perSheet[name] = n;
    }
    return { records, perSheet };
}

(async () => {
    if (!schedulePath || !attendancePath) {
        console.error('Usage: node importInstituteFromExcel.js <schedule.xlsx> <attendance.xlsx> [--dry-run]');
        process.exit(1);
    }
    if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

    const { teachers, timetable } = parseSchedule(schedulePath);
    const { records: attendance, perSheet } = parseAttendance(attendancePath);

    console.log(`Parsed: ${teachers.length} teachers, ${timetable.length} timetable sessions, ${attendance.length} attendance marks`);
    console.log('Attendance per sheet:', JSON.stringify(perSheet));

    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    // Build a student name → _id map for skillhub_institute.
    const students = await db.collection('students')
        .find({ organization: INSTITUTE }).project({ studentName: 1 }).toArray();
    const byFull = new Map();
    const byFirst = new Map(); // first token -> [ids]
    for (const s of students) {
        const full = lc(s.studentName);
        byFull.set(full, s._id);
        const first = full.split(' ')[0];
        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push(s._id);
    }
    const resolve = (nameStr) => {
        const key = lc(nameStr);
        if (byFull.has(key)) return byFull.get(key);
        const first = key.split(' ')[0];
        const hits = byFirst.get(first);
        if (hits && hits.length === 1) return hits[0];
        return null;
    };

    // Resolve refs + collect unmatched names.
    const unmatched = new Set();
    for (const t of timetable) {
        t.students = [];
        for (const nm of t.studentNames) {
            const id = resolve(nm);
            if (id) t.students.push(id);
            else if (nm) unmatched.add(nm);
        }
    }
    let attMatched = 0;
    for (const a of attendance) {
        a.student = resolve(a.studentName);
        if (a.student) attMatched++;
        else unmatched.add(a.studentName);
    }
    console.log(`Institute students in DB: ${students.length}`);
    console.log(`Attendance marks linked to a Student: ${attMatched}/${attendance.length}`);
    console.log(`Unmatched names (${unmatched.size}): ${[...unmatched].sort().join(', ')}`);

    if (DRY) {
        console.log('\n[DRY RUN] No data written.');
        await mongoose.disconnect();
        return;
    }

    // Clear + insert (fresh import).
    await Promise.all([
        db.collection('teachers').deleteMany({ organization: INSTITUTE }),
        db.collection('timetableentries').deleteMany({ organization: INSTITUTE }),
        db.collection('attendances').deleteMany({ organization: INSTITUTE }),
    ]);

    const teacherDocs = teachers.map((t) => ({
        organization: INSTITUTE, name: t.name, subjects: t.subjects, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
    }));
    const insertedTeachers = await db.collection('teachers').insertMany(teacherDocs);
    const teacherIdByName = new Map();
    teacherDocs.forEach((t, i) => teacherIdByName.set(lc(t.name), insertedTeachers.insertedIds[i]));

    const ttDocs = timetable.map((e) => ({
        organization: INSTITUTE,
        teacher: teacherIdByName.get(lc(e.teacherName)) || null,
        teacherName: e.teacherName,
        dayOfWeek: e.dayOfWeek, time: e.time, startMinutes: e.startMinutes,
        gradeOrYear: e.gradeOrYear, curriculum: e.curriculum, subject: e.subject,
        studentLabel: e.studentLabel, students: e.students,
        createdAt: new Date(), updatedAt: new Date(),
    }));
    await db.collection('timetableentries').insertMany(ttDocs);

    const attDocs = attendance.map((a) => ({
        organization: INSTITUTE,
        date: new Date(Date.UTC(a.date.getUTCFullYear(), a.date.getUTCMonth(), a.date.getUTCDate())),
        student: a.student || null, studentName: a.studentName,
        gradeOrYear: a.gradeOrYear, subject: a.subject, curriculum: '',
        teacher: null, teacherName: '', status: a.status,
        createdAt: new Date(), updatedAt: new Date(),
    }));
    if (attDocs.length) await db.collection('attendances').insertMany(attDocs);

    console.log(`\nInserted: ${teacherDocs.length} teachers, ${ttDocs.length} timetable, ${attDocs.length} attendance.`);
    await mongoose.disconnect();
    console.log('Done.');
})().catch((e) => { console.error(e); process.exit(1); });
