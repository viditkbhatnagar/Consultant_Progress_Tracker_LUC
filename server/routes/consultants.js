const express = require('express');
const {
    getConsultants,
    createConsultant,
    updateConsultant,
    deleteConsultant,
    permanentDeleteConsultant,
} = require('../controllers/consultantController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router
    .route('/')
    .get(authorize('admin', 'team_lead', 'manager', 'skillhub'), getConsultants)
    .post(authorize('admin', 'team_lead', 'skillhub'), createConsultant);

router
    .route('/:id')
    .put(authorize('admin', 'team_lead', 'skillhub'), updateConsultant)
    .delete(authorize('admin', 'team_lead', 'skillhub'), deleteConsultant);

router
    .route('/:id/permanent')
    .delete(authorize('admin'), permanentDeleteConsultant);

module.exports = router;
