const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    listOrphanCommitments,
    listOrphanStudents,
    listManualStudents,
    getCounts,
    pair,
} = require('../controllers/reconciliationController');

// Admin-only — pairing is sensitive (it can flip admissionClosed=true).
router.use(protect);
router.use(authorize('admin'));

router.get('/counts', getCounts);
router.get('/orphan-commitments', listOrphanCommitments);
router.get('/orphan-students', listOrphanStudents);
router.get('/manual-students', listManualStudents);
router.post('/pair', pair);

module.exports = router;
