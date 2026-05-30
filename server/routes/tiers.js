const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const orgGate = require('../middleware/orgGate');
const { getTiers } = require('../controllers/tierController');

const router = express.Router();

router.use(protect);
router.use(orgGate('luc'));

// Read: admin + team_lead (TL dashboards show the tier standings/image).
router.get('/', authorize('admin', 'team_lead'), getTiers);

module.exports = router;
