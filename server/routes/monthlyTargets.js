const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const {
    listTargets,
    bulkUpsert,
    upsertOne,
    deleteOne,
} = require('../controllers/monthlyTargetController');

const router = express.Router();

router.use(protect);
router.use(orgGate('luc'));

router.get('/', authorize('admin', 'team_lead'), listTargets);
router.post('/bulk', authorize('admin', 'team_lead'), bulkUpsert);
router.put('/', authorize('admin', 'team_lead'), upsertOne);
router.delete('/:id', authorize('admin'), deleteOne);

module.exports = router;
