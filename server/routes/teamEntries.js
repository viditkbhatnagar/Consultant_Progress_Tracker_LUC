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

// Reads stay open to team_lead so the future view-only TL experience
// can use the same endpoints. Mutations are admin-only — the dashboard
// is treated as a single source of truth maintained by the admin while
// the feature is still under development for team leads.
router.get('/meta', authorize('admin', 'team_lead'), getBucketMeta);
router.get('/', authorize('admin', 'team_lead'), listEntries);
router.post('/bulk', authorize('admin'), bulkUpsert);
router.put('/', authorize('admin'), upsertEntry);
router.delete('/:id', authorize('admin'), deleteEntry);

module.exports = router;
