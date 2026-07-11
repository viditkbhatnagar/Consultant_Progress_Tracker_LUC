const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/instituteController');

const router = express.Router();

// Skillhub Institute — Teachers, Timetable, Attendance. Route-gated to admin +
// skillhub; the controller further restricts skillhub logins to the Institute
// branch and scopes every query to skillhub_institute.
router.use(protect);
router.use(authorize('admin', 'skillhub'));

// Teachers
router.route('/teachers').get(c.getTeachers).post(c.createTeacher);
router.route('/teachers/:id').put(c.updateTeacher).delete(c.deleteTeacher);

// Timetable
router.route('/timetable').get(c.getTimetable).post(c.createTimetableEntry);
router.route('/timetable/:id').put(c.updateTimetableEntry).delete(c.deleteTimetableEntry);

// Attendance (specific reads before the generic list)
router.get('/attendance/meta', c.getAttendanceMeta);
router.get('/attendance/roster', c.getRoster);
router.route('/attendance').get(c.getAttendance).post(c.markAttendance);

module.exports = router;
