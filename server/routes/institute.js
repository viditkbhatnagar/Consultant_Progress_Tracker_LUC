const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/instituteController');

const router = express.Router();

// Schedule workbook upload — held in memory; the controller parses the buffer
// and never writes it to disk. 8MB is far above any real schedule sheet.
// `files: 1` + `fields` caps stop a multipart body from carrying unbounded
// extra parts alongside the workbook.
const scheduleUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 10, parts: 15 },
    fileFilter: (_req, file, cb) => {
        // Parsing arbitrary bytes with SheetJS is the risky part; keep the
        // surface to spreadsheet uploads. Content-type varies by browser/OS,
        // so the extension is the reliable check.
        if (/\.(xlsx|xlsm|xls|csv)$/i.test(file.originalname || '')) return cb(null, true);
        const err = new Error('Please upload an Excel file (.xlsx, .xls or .csv).');
        err.code = 'INVALID_FILE_TYPE';
        return cb(err);
    },
});

// Parsing a workbook is CPU-heavy and each apply writes many rows — cap it so
// one account can't pin the single Node process.
const importLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user && req.user._id ? req.user._id.toString() : req.ip || 'anon'),
    message: { success: false, message: 'Too many uploads — please wait a minute and try again.' },
});

// Turn multer's own errors into the app's response shape. Without this an
// oversized or wrong-type file surfaces as an opaque HTTP 500.
const uploadSchedule = (req, res, next) =>
    scheduleUpload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, message: 'That file is larger than 8MB.' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Upload rejected: ${err.message}` });
        }
        return next(err);
    });

// Skillhub Institute — Teachers, Timetable, Attendance. Route-gated to admin +
// skillhub; the controller further restricts skillhub logins to the Institute
// branch and scopes every query to skillhub_institute.
router.use(protect);
router.use(authorize('admin', 'skillhub'));

// Teachers
router.route('/teachers').get(c.getTeachers).post(c.createTeacher);
router.route('/teachers/:id').put(c.updateTeacher).delete(c.deleteTeacher);

// Timetable (specific /timetable/import before the generic /timetable/:id)
router.post('/timetable/import', importLimiter, uploadSchedule, c.importTimetable);
router.route('/timetable').get(c.getTimetable).post(c.createTimetableEntry);
router.route('/timetable/:id').put(c.updateTimetableEntry).delete(c.deleteTimetableEntry);

// Attendance (specific routes before the generic list)
// Institute students — source for the "add to class" picker, so added rows can
// carry a real Student ref instead of an unlinked free-typed name.
router.get('/students', c.getInstituteStudents);

router.get('/attendance/meta', c.getAttendanceMeta);
router.route('/attendance/roster')
    .get(c.getRoster)
    .post(c.addRosterStudent)
    .delete(c.removeRosterStudent);
// /attendance/entry cancels one mark; /attendance/student removes the student
// from the whole grade/year. Both must precede the generic /attendance route.
router.delete('/attendance/entry', c.deleteAttendanceEntry);
router.delete('/attendance/student', c.deleteAttendanceStudent);
router.route('/attendance').get(c.getAttendance).post(c.markAttendance);

// Tests (specific /tests/meta before the generic /tests/:id)
router.get('/tests/meta', c.getTestMeta);
router.route('/tests').get(c.getTests).post(c.createTests);
router.route('/tests/:id').put(c.updateTest).delete(c.deleteTest);

module.exports = router;
