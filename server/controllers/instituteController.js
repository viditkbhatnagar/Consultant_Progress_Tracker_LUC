// Skillhub Institute — Teachers, Timetable, and Attendance.
// The whole feature is scoped to `skillhub_institute`. Access: admin (sees
// everything) or a `skillhub` branch login whose own organization IS the
// institute. Training logins and LUC roles are rejected. All queries are
// pinned to the institute org; creates stamp it.
const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const TimetableEntry = require('../models/TimetableEntry');
const Attendance = require('../models/Attendance');
const TestRecord = require('../models/TestRecord');
const InstituteEnrollment = require('../models/InstituteEnrollment');
const Student = require('../models/Student');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');
const { subjectOptions, subjectMatchCondition } = require('../config/instituteSubjects');
const { upcomingBirthdays } = require('../services/birthdayNotifier');
const { parseScheduleWorkbook } = require('../services/institute/scheduleParser');
const { emitToOrg } = require('../services/realtime');

const INSTITUTE = ORG_SKILLHUB_INSTITUTE;

// Gate: admin always; skillhub only if their org is the institute.
function assertInstitute(req, res) {
    const u = req.user;
    if (u.role === 'admin') return true;
    if (u.role === 'skillhub' && u.organization === INSTITUTE) return true;
    res.status(403).json({ success: false, message: 'Restricted to Skillhub Institute.' });
    return false;
}

const emit = (event, payload) => emitToOrg(INSTITUTE, event, payload);

// ── Teachers ─────────────────────────────────────────────────────────────
exports.getTeachers = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const filter = { organization: INSTITUTE };
        if (req.query.active === 'true') filter.isActive = true;
        const teachers = await Teacher.find(filter).sort({ name: 1 }).lean();
        res.status(200).json({ success: true, count: teachers.length, data: teachers });
    } catch (error) {
        next(error);
    }
};

exports.createTeacher = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { name, subjects } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Teacher name is required' });
        }
        const doc = await Teacher.create({
            organization: INSTITUTE,
            name: name.trim(),
            subjects: Array.isArray(subjects) ? subjects.filter(Boolean) : [],
            createdBy: req.user._id,
        });
        emit('institute:teacher', { id: String(doc._id) });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        next(error);
    }
};

exports.updateTeacher = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const teacher = await Teacher.findOne({ _id: req.params.id, organization: INSTITUTE });
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
        const { name, subjects, isActive } = req.body;
        if (name !== undefined) teacher.name = name.trim();
        if (Array.isArray(subjects)) teacher.subjects = subjects.filter(Boolean);
        if (isActive !== undefined) teacher.isActive = !!isActive;
        await teacher.save();
        emit('institute:teacher', { id: String(teacher._id) });
        res.status(200).json({ success: true, data: teacher });
    } catch (error) {
        next(error);
    }
};

exports.deleteTeacher = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const teacher = await Teacher.findOne({ _id: req.params.id, organization: INSTITUTE });
        if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
        // Soft delete — timetable rows denormalize teacherName, so history survives.
        teacher.isActive = false;
        await teacher.save();
        emit('institute:teacher', { id: String(teacher._id) });
        res.status(200).json({ success: true, data: { id: String(teacher._id) } });
    } catch (error) {
        next(error);
    }
};

// ── Timetable ────────────────────────────────────────────────────────────
exports.getTimetable = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const filter = { organization: INSTITUTE };
        if (req.query.teacher) filter.teacher = req.query.teacher;
        if (req.query.gradeOrYear) filter.gradeOrYear = req.query.gradeOrYear;
        const entries = await TimetableEntry.find(filter)
            .sort({ dayOfWeek: 1, startMinutes: 1 })
            .lean();
        res.status(200).json({ success: true, count: entries.length, data: entries });
    } catch (error) {
        next(error);
    }
};

// Parse a raw time string ("12.30 pm - 1.30 pm", "5 pm to 6 pm") into
// minutes-from-midnight of the start time, best-effort, for stable ordering.
function parseStartMinutes(time) {
    if (!time) return null;
    const m = String(time).match(/(\d{1,2})[.:]?(\d{2})?\s*(am|pm)/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3].toLowerCase();
    if (ap === 'pm' && hh !== 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return hh * 60 + mm;
}
exports.parseStartMinutes = parseStartMinutes;

exports.createTimetableEntry = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const b = req.body;
        if (!b.teacher || !b.dayOfWeek || !b.time) {
            return res.status(400).json({ success: false, message: 'teacher, dayOfWeek and time are required' });
        }
        const teacher = await Teacher.findOne({ _id: b.teacher, organization: INSTITUTE }).lean();
        if (!teacher) return res.status(400).json({ success: false, message: 'Unknown teacher' });
        const doc = await TimetableEntry.create({
            organization: INSTITUTE,
            teacher: teacher._id,
            teacherName: teacher.name,
            dayOfWeek: b.dayOfWeek,
            time: String(b.time).trim(),
            startMinutes: parseStartMinutes(b.time),
            gradeOrYear: b.gradeOrYear || '',
            curriculum: b.curriculum || '',
            subject: b.subject || '',
            studentLabel: b.studentLabel || '',
            students: Array.isArray(b.students) ? b.students : [],
            createdBy: req.user._id,
        });
        emit('institute:timetable', { id: String(doc._id) });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        next(error);
    }
};

exports.updateTimetableEntry = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const entry = await TimetableEntry.findOne({ _id: req.params.id, organization: INSTITUTE });
        if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
        const b = req.body;
        if (b.teacher && String(b.teacher) !== String(entry.teacher)) {
            const t = await Teacher.findOne({ _id: b.teacher, organization: INSTITUTE }).lean();
            if (!t) return res.status(400).json({ success: false, message: 'Unknown teacher' });
            entry.teacher = t._id;
            entry.teacherName = t.name;
        }
        ['dayOfWeek', 'gradeOrYear', 'curriculum', 'subject', 'studentLabel'].forEach((f) => {
            if (b[f] !== undefined) entry[f] = b[f];
        });
        if (b.time !== undefined) {
            entry.time = String(b.time).trim();
            entry.startMinutes = parseStartMinutes(b.time);
        }
        if (Array.isArray(b.students)) entry.students = b.students;
        await entry.save();
        emit('institute:timetable', { id: String(entry._id) });
        res.status(200).json({ success: true, data: entry });
    } catch (error) {
        next(error);
    }
};

exports.deleteTimetableEntry = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const entry = await TimetableEntry.findOneAndDelete({ _id: req.params.id, organization: INSTITUTE });
        if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
        emit('institute:timetable', { id: String(entry._id) });
        res.status(200).json({ success: true, data: { id: String(entry._id) } });
    } catch (error) {
        next(error);
    }
};

// Bulk import a schedule workbook (one sheet per teacher). Two modes:
//   • dryRun=true  → parse + report only, nothing written (the preview step)
//   • dryRun=false → apply, replacing ONLY the teachers present in the file
//
// Per-teacher scoping is what makes this safe to hand to the branch: uploading
// one teacher's sheet can never wipe another teacher's schedule. Teachers in
// the file are created if new (and re-activated if previously deactivated).
exports.importTimetable = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        if (!req.file || !req.file.buffer || !req.file.buffer.length) {
            return res.status(400).json({ success: false, message: 'Please choose an Excel file to upload.' });
        }
        // Multipart fields arrive as strings.
        const dryRun = String(req.body?.dryRun ?? '') === 'true';

        let parsed;
        try {
            parsed = parseScheduleWorkbook(req.file.buffer);
        } catch (e) {
            if (e.userFacing) return res.status(400).json({ success: false, message: e.message });
            throw e;
        }
        const { teachers, timetable, warnings } = parsed;

        // Link student names to Student docs: exact normalized name, else a
        // unique first-name hit. Unmatched names still import as plain text
        // (studentLabel), they just don't carry a ref — same as the roster.
        const lcName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const studentDocs = await Student.find({ organization: INSTITUTE }).select('studentName').lean();
        const byFull = new Map();
        const byFirst = new Map();
        for (const s of studentDocs) {
            const full = lcName(s.studentName);
            if (!full) continue;
            byFull.set(full, s._id);
            const first = full.split(' ')[0];
            if (!byFirst.has(first)) byFirst.set(first, []);
            byFirst.get(first).push(s._id);
        }
        const resolveStudent = (nameStr) => {
            const key = lcName(nameStr);
            if (!key) return null;
            if (byFull.has(key)) return byFull.get(key);
            const hits = byFirst.get(key.split(' ')[0]);
            return hits && hits.length === 1 ? hits[0] : null;
        };

        const unmatched = new Set();
        for (const row of timetable) {
            row.students = [];
            for (const nm of row.studentNames || []) {
                const id = resolveStudent(nm);
                if (id) row.students.push(id);
                else if (nm) unmatched.add(nm);
            }
        }

        const uniqSorted = (arr) =>
            [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

        // Existing teacher docs for this org, matched case-insensitively.
        const existingTeachers = await Teacher.find({ organization: INSTITUTE }).lean();
        const teacherByName = new Map(existingTeachers.map((t) => [lcName(t.name), t]));
        const matchedIds = teachers
            .map((t) => teacherByName.get(lcName(t.name)))
            .filter(Boolean)
            .map((t) => t._id);
        const replacingSessions = matchedIds.length
            ? await TimetableEntry.countDocuments({ organization: INSTITUTE, teacher: { $in: matchedIds } })
            : 0;

        const summary = {
            teachers: teachers.map((t) => ({
                name: t.name,
                sessions: t.sessions,
                subjects: t.subjects,
                isNew: !teacherByName.has(lcName(t.name)),
            })),
            totalSessions: timetable.length,
            grades: uniqSorted(timetable.map((r) => r.gradeOrYear)),
            subjects: uniqSorted(timetable.map((r) => r.subject)),
            unmatchedStudents: [...unmatched].sort((a, b) => a.localeCompare(b)),
            warnings,
            replacingSessions,
        };

        if (dryRun) {
            return res.status(200).json({ success: true, data: { ...summary, applied: false } });
        }

        // Rows grouped by teacher. Two sheets whose names normalize to the same
        // key (e.g. "Fahad" and "fahad ") are ONE teacher — grouping by key and
        // then iterating the keys means such a teacher is processed exactly
        // once, instead of the second pass deleting what the first inserted.
        const bySheet = new Map();
        for (const row of timetable) {
            const key = lcName(row.teacherName);
            if (!bySheet.has(key)) bySheet.set(key, { name: row.teacherName, rows: [], subjects: new Set() });
            const bucket = bySheet.get(key);
            bucket.rows.push(row);
            if (row.subject) bucket.subjects.add(row.subject);
        }

        // Validate EVERY row before writing anything. Without this a bad row in
        // the last teacher's sheet would 500 after earlier teachers had already
        // been replaced — the client would say "Import failed" while part of
        // the timetable was already overwritten. Fail the whole upload up front.
        const invalid = [];
        for (const [, bucket] of bySheet) {
            for (const r of bucket.rows) {
                const probe = new TimetableEntry({
                    organization: INSTITUTE,
                    teacher: new mongoose.Types.ObjectId(), // real id assigned below
                    teacherName: bucket.name,
                    dayOfWeek: r.dayOfWeek,
                    time: r.time,
                    startMinutes: r.startMinutes,
                    gradeOrYear: r.gradeOrYear,
                    curriculum: r.curriculum,
                    subject: r.subject,
                    studentLabel: r.studentLabel,
                    students: r.students,
                });
                const err = probe.validateSync();
                if (err) {
                    invalid.push(`${bucket.name} — ${r.dayOfWeek} ${r.time || '(no time)'}: ${Object.values(err.errors || {})[0]?.message || 'invalid row'}`);
                }
            }
        }
        if (invalid.length) {
            return res.status(400).json({
                success: false,
                message: `Nothing was imported. ${invalid.length} row(s) are incomplete: ${invalid.slice(0, 5).join('; ')}${invalid.length > 5 ? '…' : ''}`,
            });
        }

        // Apply, one teacher at a time. Order matters: capture the old rows,
        // insert the new ones, THEN delete the old. A failure mid-way leaves
        // duplicates (visible + fixable) rather than deleting a teacher's
        // schedule with nothing to replace it.
        const appliedTeachers = [];
        let inserted = 0;
        try {
        for (const [key, bucket] of bySheet) {
            const t = { name: bucket.name, subjects: [...bucket.subjects] };
            const rows = bucket.rows;
            if (!rows.length) continue;

            let teacherDoc = teacherByName.get(key);
            if (teacherDoc) {
                // Union subjects so manual additions aren't lost, and revive a
                // teacher who was deactivated but is clearly teaching again.
                const merged = uniqSorted([...(teacherDoc.subjects || []), ...t.subjects]);
                await Teacher.updateOne(
                    { _id: teacherDoc._id, organization: INSTITUTE },
                    { $set: { subjects: merged, isActive: true } }
                );
            } else {
                teacherDoc = await Teacher.create({
                    organization: INSTITUTE,
                    name: t.name,
                    subjects: t.subjects,
                    createdBy: req.user._id,
                });
                teacherByName.set(key, teacherDoc);
            }

            const oldIds = await TimetableEntry.find({
                organization: INSTITUTE,
                teacher: teacherDoc._id,
            }).distinct('_id');

            const docs = rows.map((r) => ({
                organization: INSTITUTE,
                teacher: teacherDoc._id,
                teacherName: teacherDoc.name,
                dayOfWeek: r.dayOfWeek,
                time: r.time,
                startMinutes: r.startMinutes,
                gradeOrYear: r.gradeOrYear,
                curriculum: r.curriculum,
                subject: r.subject,
                studentLabel: r.studentLabel,
                students: r.students,
                createdBy: req.user._id,
            }));
            await TimetableEntry.insertMany(docs);
            inserted += docs.length;

            if (oldIds.length) {
                await TimetableEntry.deleteMany({ organization: INSTITUTE, _id: { $in: oldIds } });
            }
            appliedTeachers.push(teacherDoc.name);
        }
        } catch (writeErr) {
            // Pre-validation makes this unlikely, but if a write still fails
            // partway, say exactly whose schedule already changed — reporting a
            // flat "import failed" after a partial replace is how people end up
            // re-uploading and silently keeping a half-applied timetable.
            emit('institute:timetable', { imported: inserted, partial: true });
            return res.status(500).json({
                success: false,
                message: appliedTeachers.length
                    ? `Import stopped partway. Already updated: ${appliedTeachers.join(', ')}. Other teachers are unchanged — re-upload to finish. (${writeErr.message})`
                    : `Import failed, nothing was changed. (${writeErr.message})`,
            });
        }

        emit('institute:timetable', { imported: inserted });
        res.status(200).json({ success: true, data: { ...summary, applied: true, inserted } });
    } catch (error) {
        next(error);
    }
};

// ── Attendance ───────────────────────────────────────────────────────────
// Distinct grade/year + subject values (for the marking dropdowns), sourced
// from both attendance history and the timetable.
exports.getAttendanceMeta = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        // Grades stay data-derived (they grow organically), but subjects come
        // from the canonical list — deriving them from `distinct('subject')`
        // is what let duplicates and the retired CHRM into the picker.
        const [grades, tGrades] = await Promise.all([
            Attendance.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
            TimetableEntry.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
        ]);
        const uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
        res.status(200).json({
            success: true,
            data: { gradesOrYears: uniq([...grades, ...tGrades]), subjects: subjectOptions() },
        });
    } catch (error) {
        next(error);
    }
};

// Roster for a grade/year: distinct students that have appeared in its
// attendance OR test history (name + optional Student ref). Unioned so a grade
// that has only sat a test still has a roster for the next test/attendance.
//
// When `subject` is supplied the roster is scoped to that subject. Without it
// the roster was grade-wide, so a student added under (Year 13, Biology) then
// showed up under every other Year 13 subject — a student must only appear in
// the subjects they actually attend; adding them elsewhere is a manual action.
exports.getRoster = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject } = req.query;
        if (!gradeOrYear) return res.status(400).json({ success: false, message: 'gradeOrYear is required' });
        const match = { organization: INSTITUTE, gradeOrYear };
        if (subject) match.subject = subjectMatchCondition(subject);
        const groupStage = [
            { $match: match },
            { $group: { _id: '$studentName', student: { $first: '$student' } } },
        ];
        // Enrollments are the durable class list; attendance/test history is
        // unioned in so classes that predate enrollments still have a roster.
        const [attRows, testRows, enrolled] = await Promise.all([
            Attendance.aggregate(groupStage),
            TestRecord.aggregate(groupStage),
            InstituteEnrollment.find(match).select('studentName student').lean(),
        ]);
        const byName = new Map();
        for (const r of [...attRows, ...testRows]) {
            if (!r._id) continue;
            const existing = byName.get(r._id);
            // Prefer a linked Student ref if either source has one.
            byName.set(r._id, { studentName: r._id, student: existing?.student || r.student || null });
        }
        for (const e of enrolled) {
            if (!e.studentName) continue;
            const existing = byName.get(e.studentName);
            byName.set(e.studentName, {
                studentName: e.studentName,
                student: existing?.student || e.student || null,
            });
        }
        const roster = [...byName.values()].sort((a, b) => a.studentName.localeCompare(b.studentName));
        res.status(200).json({ success: true, data: roster });
    } catch (error) {
        next(error);
    }
};

// Upcoming student birthdays. The daily job posts a notification on the day
// (and the day before), but that leaves nothing to see in between — this backs
// the panel so the branch can look ahead and know the reminders are armed.
exports.getUpcomingBirthdays = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const days = Math.min(Math.max(parseInt(req.query.days, 10) || 45, 1), 365);
        const data = await upcomingBirthdays({ days, organization: INSTITUTE });
        res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        next(error);
    }
};

// Institute students, for the "add to class" picker. Returned so the caller
// can attach a real Student ref instead of a free-typed name (which is what
// makes rows show as "(unlinked)"). Grade labels are inconsistent in the
// admissions data ("g11", "grade 11", "G11") so they're returned verbatim for
// display and the user chooses — we never auto-match on them.
exports.getInstituteStudents = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const students = await Student.find({ organization: INSTITUTE })
            .select('studentName yearOrGrade subjects curriculum curriculumSlug studentStatus')
            .sort({ studentName: 1 })
            .lean();
        res.status(200).json({ success: true, count: students.length, data: students });
    } catch (error) {
        next(error);
    }
};

// Add a student to a class list. Idempotent — re-adding the same student is a
// no-op rather than a duplicate row. This is what makes "Add" stick even
// before the student has ever been marked.
exports.addRosterStudent = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject, studentName, student } = req.body;
        if (!gradeOrYear || !studentName || !String(studentName).trim()) {
            return res.status(400).json({ success: false, message: 'gradeOrYear and studentName are required' });
        }
        if (!subject) {
            return res.status(400).json({ success: false, message: 'subject is required — a student belongs to one subject at a time' });
        }
        const name = String(studentName).trim();
        const doc = await InstituteEnrollment.findOneAndUpdate(
            { organization: INSTITUTE, gradeOrYear, subject, studentName: name },
            { $setOnInsert: { organization: INSTITUTE, gradeOrYear, subject, studentName: name, student: student || null, addedBy: req.user._id } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        emit('institute:attendance', { gradeOrYear, subject, studentName: name });
        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        next(error);
    }
};

// Take a student off a class list.
//
// With `subject`: just that subject. WITHOUT `subject`: the whole grade/year —
// "remove this student from Grade 10" has to mean every subject, otherwise the
// call would only match rows whose subject is literally blank and appear to do
// nothing at all.
//
// It clears enrollments, attendance AND test records for that scope. The roster
// is the union of all three, so leaving any one behind puts the student
// straight back on the list — which is exactly why a student who landed in the
// wrong grade via a stray test result could never be deleted.
exports.removeRosterStudent = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject, studentName } = req.body;
        if (!gradeOrYear || !studentName) {
            return res.status(400).json({ success: false, message: 'gradeOrYear and studentName are required' });
        }
        const scope = { organization: INSTITUTE, gradeOrYear, studentName };
        if (subject) scope.subject = subjectMatchCondition(subject);
        const [enrollRes, attRes, testRes] = await Promise.all([
            InstituteEnrollment.deleteMany(scope),
            Attendance.deleteMany(scope),
            TestRecord.deleteMany(scope),
        ]);
        emit('institute:attendance', { gradeOrYear, subject: subject || '', studentName });
        res.status(200).json({
            success: true,
            data: {
                removed: enrollRes.deletedCount,
                marksRemoved: attRes.deletedCount,
                testsRemoved: testRes.deletedCount,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Existing attendance for a (grade/year, subject, date) key.
exports.getAttendance = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject, date, startDate, endDate, studentName } = req.query;
        const filter = { organization: INSTITUTE };
        if (gradeOrYear) filter.gradeOrYear = gradeOrYear;
        if (subject) filter.subject = subjectMatchCondition(subject);
        if (studentName) filter.studentName = studentName;
        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setUTCDate(next.getUTCDate() + 1);
            filter.date = { $gte: d, $lt: next };
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) {
                const e = new Date(endDate);
                e.setUTCHours(23, 59, 59, 999);
                filter.date.$lte = e;
            }
        }
        const rows = await Attendance.find(filter).sort({ date: -1, studentName: 1 }).lean();
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        next(error);
    }
};

// Bulk mark: replace the attendance rows for (date, grade/year, subject) with
// the submitted set (one row per student). Idempotent per key.
exports.markAttendance = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { date, gradeOrYear, subject, curriculum, teacher, teacherName, entries } = req.body;
        if (!date || !gradeOrYear || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'date, gradeOrYear and entries[] are required' });
        }
        const day = new Date(date);
        if (Number.isNaN(day.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date' });
        }
        const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

        // Clear this exact key, then insert fresh — keeps re-marking clean.
        // The clear matches legacy spellings too (a day stored as "Maths" is
        // replaced when re-marked as "Math") so re-marking can't leave a
        // duplicate row behind; the insert below always writes the canonical.
        await Attendance.deleteMany({
            organization: INSTITUTE,
            gradeOrYear,
            subject: subject ? subjectMatchCondition(subject) : '',
            date: { $gte: dayStart, $lt: dayEnd },
        });

        const docs = entries
            .filter((e) => e && e.studentName && (e.status === 'Present' || e.status === 'Absent'))
            .map((e) => ({
                organization: INSTITUTE,
                date: dayStart,
                student: e.student || null,
                studentName: String(e.studentName).trim(),
                gradeOrYear,
                subject: subject || '',
                curriculum: curriculum || '',
                teacher: teacher || null,
                teacherName: teacherName || '',
                status: e.status,
                markedBy: req.user._id,
            }));
        const inserted = docs.length ? await Attendance.insertMany(docs) : [];

        // Marking a student also puts them on the class list, so a roster built
        // purely by marking (the old behaviour) stays intact and self-heals.
        if (docs.length && subject) {
            await InstituteEnrollment.bulkWrite(
                docs.map((d) => ({
                    updateOne: {
                        filter: { organization: INSTITUTE, gradeOrYear, subject, studentName: d.studentName },
                        update: {
                            $setOnInsert: {
                                organization: INSTITUTE, gradeOrYear, subject,
                                studentName: d.studentName, student: d.student || null, addedBy: req.user._id,
                            },
                        },
                        upsert: true,
                    },
                })),
                { ordered: false }
            ).catch(() => { /* enrollment is best-effort; the marks are already saved */ });
        }

        emit('institute:attendance', { gradeOrYear, subject: subject || '', date: dayStart });
        res.status(200).json({ success: true, count: inserted.length, data: inserted });
    } catch (error) {
        next(error);
    }
};

// Cancel ONE mark: the (grade/year, subject, date, student) row only.
// Used when a teacher marked a student on a day the class never ran. The
// student keeps every other record — and so stays on the roster — which is the
// difference from deleteAttendanceStudent below (that one wipes the lot).
exports.deleteAttendanceEntry = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject, date, studentName } = req.body;
        if (!gradeOrYear || !studentName || !date) {
            return res.status(400).json({
                success: false,
                message: 'gradeOrYear, studentName and date are required',
            });
        }
        const day = new Date(date);
        if (Number.isNaN(day.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date' });
        }
        const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

        const result = await Attendance.deleteMany({
            organization: INSTITUTE,
            gradeOrYear,
            subject: subject ? subjectMatchCondition(subject) : '',
            studentName,
            date: { $gte: dayStart, $lt: dayEnd },
        });
        emit('institute:attendance', { gradeOrYear, subject: subject || '', date: dayStart });
        res.status(200).json({ success: true, data: { removed: result.deletedCount } });
    } catch (error) {
        next(error);
    }
};

// Remove a student from a grade/year's attendance entirely (wrong-grade or
// discontinued students). Deletes all their attendance rows for that grade so
// they drop out of the roster. To cancel a single wrong mark use
// deleteAttendanceEntry instead.
exports.deleteAttendanceStudent = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, studentName } = req.body;
        if (!gradeOrYear || !studentName) {
            return res.status(400).json({ success: false, message: 'gradeOrYear and studentName are required' });
        }
        const result = await Attendance.deleteMany({ organization: INSTITUTE, gradeOrYear, studentName });
        // Drop their class-list membership too, otherwise they'd reappear on
        // the roster with no history behind them.
        await InstituteEnrollment.deleteMany({ organization: INSTITUTE, gradeOrYear, studentName });
        emit('institute:attendance', { gradeOrYear, studentName, removed: result.deletedCount });
        res.status(200).json({ success: true, data: { removed: result.deletedCount } });
    } catch (error) {
        next(error);
    }
};

// ── Tests ────────────────────────────────────────────────────────────────
// Coerce a marks value to a non-negative number, or null when blank/invalid.
// Handles whitespace ('  ' → null, not 0) and negatives (min:0 semantics),
// matching what row.save() would enforce — bulkWrite upserts skip validators.
function toNonNegativeNumber(v) {
    if (v === '' || v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) || n < 0 ? null : n;
}

// A bulkWrite that only tripped the unique index (duplicate concurrent save)
// is benign — the row already exists. Distinguish it from real failures.
function isAllDuplicateKeyError(err) {
    if (!err) return false;
    if (err.code === 11000) return true;
    const writeErrors = err.writeErrors || (err.result && err.result.writeErrors) || [];
    return writeErrors.length > 0 && writeErrors.every((w) => (w.code || (w.err && w.err.code)) === 11000);
}

// Weekly test tracker: marks per grade/subject with test topic + teacher.
// Distinct grade/year + subject values for the filter/entry dropdowns,
// unioned from test history and the timetable so brand-new grades appear.
exports.getTestMeta = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const [tGrades, ttGrades] = await Promise.all([
            TestRecord.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
            TimetableEntry.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
        ]);
        const uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
        res.status(200).json({
            success: true,
            data: { gradesOrYears: uniq([...tGrades, ...ttGrades]), subjects: subjectOptions() },
        });
    } catch (error) {
        next(error);
    }
};

// Filtered test list — by grade/year, subject, teacherName, studentName, and a
// single date or a date range. Mirrors getAttendance's filter handling.
exports.getTests = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear, subject, teacherName, studentName, date, startDate, endDate } = req.query;
        const filter = { organization: INSTITUTE };
        if (gradeOrYear) filter.gradeOrYear = gradeOrYear;
        if (subject) filter.subject = subjectMatchCondition(subject);
        if (teacherName) filter.teacherName = teacherName;
        if (studentName) filter.studentName = studentName;
        // Guard against unparseable date params — an Invalid Date would cast-
        // error and get mislabeled as a 404. Reject malformed input as 400.
        const parseDate = (v) => {
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? null : d;
        };
        if (date) {
            const d = parseDate(date);
            if (!d) return res.status(400).json({ success: false, message: 'Invalid date' });
            const nextDay = new Date(d);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            filter.date = { $gte: d, $lt: nextDay };
        } else if (startDate || endDate) {
            filter.date = {};
            if (startDate) {
                const s = parseDate(startDate);
                if (!s) return res.status(400).json({ success: false, message: 'Invalid startDate' });
                filter.date.$gte = s;
            }
            if (endDate) {
                const e = parseDate(endDate);
                if (!e) return res.status(400).json({ success: false, message: 'Invalid endDate' });
                e.setUTCHours(23, 59, 59, 999);
                filter.date.$lte = e;
            }
        }
        const rows = await TestRecord.find(filter).sort({ date: -1, studentName: 1 }).lean();
        res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        next(error);
    }
};

// Bulk save one test session: upsert one row per student keyed on
// (date, grade/year, subject, testTopic, studentName). Upsert-per-student —
// NOT delete-then-insert — so re-recording a session only touches the
// students in the payload and never wipes marks the caller didn't resubmit.
// Remove a stray result with the per-row DELETE instead. Different topics on
// the same day are separate keys and coexist.
exports.createTests = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const {
            date, gradeOrYear, curriculum, subject, testTopic,
            maxMarks, teacher, teacherName, entries,
        } = req.body;
        if (!date || !gradeOrYear || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'date, gradeOrYear and entries[] are required' });
        }
        const day = new Date(date);
        if (Number.isNaN(day.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date' });
        }
        // Always store the day at UTC midnight so the exact-match upsert filter
        // is stable and single-day reads bucket correctly.
        const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
        // Optional denominator: '', null, NaN, or negative all mean "unset".
        const cappedMax = toNonNegativeNumber(maxMarks);
        const subj = subject || '';
        const topic = testTopic || '';

        // Only students with a real, non-negative numeric mark are recorded
        // (blank/whitespace/negative = skipped). bulkWrite upserts do NOT run
        // Mongoose validators, so this JS guard is what enforces the schema's
        // `min: 0` on the primary insert path — keep it in step with save().
        const ops = entries
            .map((e) => (e ? { e, mark: toNonNegativeNumber(e.marksObtained) } : null))
            .filter((x) => x && x.e.studentName && x.mark != null)
            .map(({ e, mark }) => {
                const studentName = String(e.studentName).trim();
                return {
                    updateOne: {
                        filter: { organization: INSTITUTE, date: dayStart, gradeOrYear, subject: subj, testTopic: topic, studentName },
                        update: {
                            $set: {
                                organization: INSTITUTE,
                                date: dayStart,
                                student: e.student || null,
                                studentName,
                                gradeOrYear,
                                curriculum: curriculum || '',
                                subject: subj,
                                testTopic: topic,
                                marksObtained: mark,
                                maxMarks: cappedMax,
                                teacher: teacher || null,
                                teacherName: teacherName || '',
                                markedBy: req.user._id,
                            },
                        },
                        upsert: true,
                    },
                };
            });
        if (ops.length) {
            try {
                // ordered:false so one racing duplicate doesn't abort the rest.
                await TestRecord.bulkWrite(ops, { ordered: false });
            } catch (e) {
                // A concurrent save for the same key trips the unique index
                // (E11000). The row already exists with the same payload, so
                // treat an all-duplicate-key failure as success; re-throw
                // anything else.
                if (!isAllDuplicateKeyError(e)) throw e;
            }
        }
        emit('institute:test', { gradeOrYear, subject: subj, date: dayStart });
        res.status(200).json({ success: true, count: ops.length });
    } catch (error) {
        next(error);
    }
};

// Edit a single test row (correct a mark, topic, subject, teacher, etc.).
exports.updateTest = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const row = await TestRecord.findOne({ _id: req.params.id, organization: INSTITUTE });
        if (!row) return res.status(404).json({ success: false, message: 'Test record not found' });
        const b = req.body;
        ['studentName', 'gradeOrYear', 'curriculum', 'subject', 'testTopic', 'teacherName'].forEach((f) => {
            if (b[f] !== undefined) row[f] = b[f];
        });
        if (b.marksObtained !== undefined) {
            const mark = toNonNegativeNumber(b.marksObtained);
            if (mark == null) return res.status(400).json({ success: false, message: 'Marks obtained must be a non-negative number' });
            row.marksObtained = mark;
        }
        if (b.maxMarks !== undefined) row.maxMarks = toNonNegativeNumber(b.maxMarks);
        if (b.teacher !== undefined) row.teacher = b.teacher || null;
        if (b.date !== undefined) {
            const d = new Date(b.date);
            if (!Number.isNaN(d.getTime())) {
                // Normalize to UTC midnight so an edited row stays in step with
                // the createTests upsert key (which stores dayStart).
                row.date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
            }
        }
        await row.save();
        emit('institute:test', { id: String(row._id) });
        res.status(200).json({ success: true, data: row });
    } catch (error) {
        next(error);
    }
};

exports.deleteTest = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const row = await TestRecord.findOneAndDelete({ _id: req.params.id, organization: INSTITUTE });
        if (!row) return res.status(404).json({ success: false, message: 'Test record not found' });
        emit('institute:test', { id: String(row._id) });
        res.status(200).json({ success: true, data: { id: String(row._id) } });
    } catch (error) {
        next(error);
    }
};
