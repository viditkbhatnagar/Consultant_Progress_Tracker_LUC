const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { exportPivotLimiter } = require('../middleware/exportRateLimit');
const {
    getRaw,
    getPivot,
    getDimensions,
    runTemplate,
    listTemplates,
    listSavedTemplates,
    createSavedTemplate,
    deleteSavedTemplate,
} = require('../controllers/exportController');

router.use(protect);

// Specific routes BEFORE any /:id-style routes (none today, but follow the
// project convention).
router.post('/raw', getRaw);
router.post('/pivot', exportPivotLimiter, getPivot);
router.get('/dimensions/:dataset', getDimensions);
// Specific routes BEFORE /template/:templateId (Express matches in order).
router.get('/templates', listTemplates);
router.post('/template/:templateId', exportPivotLimiter, runTemplate);

router.route('/saved-templates').get(listSavedTemplates).post(createSavedTemplate);
router.delete('/saved-templates/:id', deleteSavedTemplate);

module.exports = router;
