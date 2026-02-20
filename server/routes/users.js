const express = require('express');
const {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    permanentDeleteUser,
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
    .route('/team/:teamLeadId')
    .get(authorize('admin', 'team_lead'), getConsultantsByTeamLead);

router
    .route('/:id')
    .get(getUser)
    .put(updateUser)
    .delete(authorize('admin'), deleteUser);

router
    .route('/:id/permanent')
    .delete(authorize('admin'), permanentDeleteUser);

module.exports = router;
