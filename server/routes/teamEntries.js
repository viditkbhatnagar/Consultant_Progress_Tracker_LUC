const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const {
    listEntries,
    upsertEntry,
    bulkUpsert,
    deleteEntry,
    getBucketMeta,
} = require('../controllers/teamEntryController');

const router = express.Router();

router.use(protect);
router.use(orgGate('luc'));

router.get('/meta', authorize('admin', 'team_lead'), getBucketMeta);
router.get('/', authorize('admin', 'team_lead'), listEntries);
router.post('/bulk', authorize('admin', 'team_lead'), bulkUpsert);
router.put('/', authorize('admin', 'team_lead'), upsertEntry);
router.delete('/:id', authorize('admin'), deleteEntry);

module.exports = router;
