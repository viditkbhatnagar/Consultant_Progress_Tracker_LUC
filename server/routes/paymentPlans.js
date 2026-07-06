const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const {
    getPaymentPlans,
    createPaymentPlan,
    updatePaymentPlan,
    deletePaymentPlan,
} = require('../controllers/paymentPlanController');

const router = express.Router();

// LUC-only feature. Both admin and team_lead reach it (the tab lives on the
// Tier Fight page they both already access); per-team scoping is enforced in
// the controller via buildScopeFilter / canAccessDoc.
router.use(protect);
router.use(orgGate('luc'));

router
    .route('/')
    .get(authorize('admin', 'team_lead'), getPaymentPlans)
    .post(authorize('admin', 'team_lead'), createPaymentPlan);

router
    .route('/:id')
    .put(authorize('admin', 'team_lead'), updatePaymentPlan)
    .delete(authorize('admin', 'team_lead'), deletePaymentPlan);

module.exports = router;
