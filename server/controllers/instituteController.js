// Skillhub Institute — Teachers, Timetable, and Attendance.
// The whole feature is scoped to `skillhub_institute`. Access: admin (sees
// everything) or a `skillhub` branch login whose own organization IS the
// institute. Training logins and LUC roles are rejected. All queries are
// pinned to the institute org; creates stamp it.
const Teacher = require('../models/Teacher');
const TimetableEntry = require('../models/TimetableEntry');
const Attendance = require('../models/Attendance');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');
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

// ── Attendance ───────────────────────────────────────────────────────────
// Distinct grade/year + subject values (for the marking dropdowns), sourced
// from both attendance history and the timetable.
exports.getAttendanceMeta = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const [grades, subjects] = await Promise.all([
            Attendance.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
            Attendance.distinct('subject', { organization: INSTITUTE, subject: { $nin: [null, ''] } }),
        ]);
        const [tGrades, tSubjects] = await Promise.all([
            TimetableEntry.distinct('gradeOrYear', { organization: INSTITUTE, gradeOrYear: { $nin: [null, ''] } }),
            TimetableEntry.distinct('subject', { organization: INSTITUTE, subject: { $nin: [null, ''] } }),
        ]);
        const uniq = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
        res.status(200).json({
            success: true,
            data: { gradesOrYears: uniq([...grades, ...tGrades]), subjects: uniq([...subjects, ...tSubjects]) },
        });
    } catch (error) {
        next(error);
    }
};

// Roster for a grade/year: distinct students that have appeared in its
// attendance history (name + optional Student ref).
exports.getRoster = async (req, res, next) => {
    try {
        if (!assertInstitute(req, res)) return;
        const { gradeOrYear } = req.query;
        if (!gradeOrYear) return res.status(400).json({ success: false, message: 'gradeOrYear is required' });
        const rows = await Attendance.aggregate([
            { $match: { organization: INSTITUTE, gradeOrYear } },
            { $group: { _id: '$studentName', student: { $first: '$student' } } },
            { $sort: { _id: 1 } },
        ]);
        const roster = rows.map((r) => ({ studentName: r._id, student: r.student || null }));
        res.status(200).json({ success: true, data: roster });
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
        if (subject) filter.subject = subject;
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
        await Attendance.deleteMany({
            organization: INSTITUTE,
            gradeOrYear,
            subject: subject || '',
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
        emit('institute:attendance', { gradeOrYear, subject: subject || '', date: dayStart });
        res.status(200).json({ success: true, count: inserted.length, data: inserted });
    } catch (error) {
        next(error);
    }
};
