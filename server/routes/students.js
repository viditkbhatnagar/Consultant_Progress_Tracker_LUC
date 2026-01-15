const express = require('express');
const {
    getStudents,
    getStudent,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentStats,
} = require('../controllers/studentController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Stats route (must be before /:id to prevent conflict)
router.get('/stats', authorize('admin', 'team_lead'), getStudentStats);

router
    .route('/')
    .get(authorize('admin', 'team_lead'), getStudents)
    .post(authorize('admin', 'team_lead'), createStudent);

router
    .route('/:id')
    .get(authorize('admin', 'team_lead'), getStudent)
    .put(authorize('admin', 'team_lead'), updateStudent)
    .delete(authorize('admin', 'team_lead'), deleteStudent);

module.exports = router;
