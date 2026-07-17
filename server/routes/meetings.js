const express = require('express');
const {
    getMeetings,
    getMeetingStats,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getAIAnalysis,
} = require('../controllers/meetingController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// `skillhub` branch logins get the tracker too — every read/write below is
// org-scoped by buildScopeFilter/canAccessDoc, so a branch only ever sees
// its own meetings. Delete stays admin-only, as it is for LUC.
router
    .route('/')
    .get(authorize('admin', 'team_lead', 'skillhub'), getMeetings)
    .post(authorize('admin', 'team_lead', 'skillhub'), createMeeting);

// Specific routes BEFORE /:id so Express matches them correctly.
router.get('/stats', authorize('admin', 'team_lead', 'skillhub'), getMeetingStats);
// AI analysis stays LUC-shaped (and OpenAI-billed) — no Skillhub UI calls it,
// so don't widen the role list until one does.
router.get('/ai-analysis', authorize('admin', 'team_lead'), getAIAnalysis);

router
    .route('/:id')
    .get(authorize('admin', 'team_lead', 'skillhub'), getMeeting)
    .put(authorize('admin', 'team_lead', 'skillhub'), updateMeeting)
    .delete(authorize('admin'), deleteMeeting);

module.exports = router;
