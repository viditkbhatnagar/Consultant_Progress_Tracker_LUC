const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getActive, acknowledge } = require('../controllers/announcementController');

// All routes require auth. Org-scoping is done inline from req.user.
router.get('/active', protect, getActive);
router.post('/:id/ack', protect, acknowledge);

module.exports = router;
