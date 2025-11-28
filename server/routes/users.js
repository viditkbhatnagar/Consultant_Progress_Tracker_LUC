const express = require('express');
const {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    getConsultantsByTeamLead,
} = require('../controllers/userController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router
    .route('/')
    .get(authorize('admin', 'team_lead'), getUsers);

router
    .route('/:id')
    .get(getUser)
    .put(updateUser)
    .delete(authorize('admin'), deleteUser);

router
    .route('/team/:teamLeadId')
    .get(authorize('admin', 'team_lead'), getConsultantsByTeamLead);

module.exports = router;
