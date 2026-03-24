const express = require('express');
const {
    getConsultants,
    getDayActivities,
    upsertSlot,
    clearSlot,
    clearDay,
    getMonthActivities,
    getDayAdmissions,
    upsertAdmission,
    getMonthAdmissions,
} = require('../controllers/hourlyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication (any role)
router.use(protect);

router.get('/consultants', getConsultants);
router.get('/day', getDayActivities);
router.put('/slot', upsertSlot);
router.delete('/slot', clearSlot);
router.delete('/day', clearDay);
router.get('/month', getMonthActivities);
router.get('/admissions', getDayAdmissions);
router.put('/admissions', upsertAdmission);
router.get('/admissions/month', getMonthAdmissions);

module.exports = router;
