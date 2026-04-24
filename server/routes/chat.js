const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
    streamChat,
    listConversations,
    getConversation,
    deleteConversation,
    transcribeAudio,
} = require('../controllers/chatController');
const { classify: classifyRoute } = require('../services/classifierService');

const router = express.Router();

// All chat endpoints require auth but NOT a role check — every
// authenticated user can query anything via chat per product decision.
router.use(protect);

// Audio upload is held in memory (no disk) and forwarded straight to
// OpenAI. 25 MB cap matches Whisper's hard limit; in practice voice
// clips are 100–500 KB so this is defensive.
const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/stream', streamChat);
router.post('/transcribe', audioUpload.single('audio'), transcribeAudio);
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

// Phase 5.3 — LLM fallback used by the client's classifyQuery when its
// keyword rules are ambiguous. Hot in-memory cache (1h TTL) keeps the
// typical repeat-query path free. Never throws; worst case returns
// route:'tracker' on transport error.
router.post('/classify', async (req, res) => {
    const q = (req.body && req.body.query) || '';
    if (typeof q !== 'string' || !q.trim()) {
        return res
            .status(400)
            .json({ success: false, message: 'query (string) is required' });
    }
    const { route, cached } = await classifyRoute(q);
    res.json({ success: true, route, cached });
});

module.exports = router;
