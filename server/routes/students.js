const express = require('express');
const {
    getStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    activateStudent,
    changeStudentStatus,
    getStudentStats,
    getPrograms,
} = require('../controllers/studentController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Stats route (must be before /:id to prevent conflict)
router.get('/stats', authorize('admin', 'team_lead', 'manager', 'skillhub'), getStudentStats);

// Distinct program list for LUC Meeting Tracker dropdown (before /:id)
router.get('/programs', authorize('admin', 'team_lead'), getPrograms);

router
    .route('/')
    .get(authorize('admin', 'team_lead', 'manager', 'skillhub'), getStudents)
    .post(authorize('admin', 'team_lead', 'skillhub'), createStudent);

// Skillhub: transition New Admission → Active (before /:id catch-all)
router.patch('/:id/activate', authorize('admin', 'skillhub'), activateStudent);
// Skillhub: generic status transition (any pair of studentStatus values)
router.patch('/:id/status', authorize('admin', 'skillhub'), changeStudentStatus);

router
    .route('/:id')
    .get(authorize('admin', 'team_lead', 'manager', 'skillhub'), getStudent)
    .put(authorize('admin', 'team_lead', 'skillhub'), updateStudent)
    .delete(authorize('admin', 'team_lead', 'skillhub'), deleteStudent);

module.exports = router;
