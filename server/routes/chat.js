const express = require('express');
const { protect } = require('../middleware/auth');
const {
    streamChat,
    listConversations,
    getConversation,
    deleteConversation,
} = require('../controllers/chatController');

const router = express.Router();

// All chat endpoints require auth but NOT a role check — every
// authenticated user can query anything via chat per product decision.
router.use(protect);

router.post('/stream', streamChat);
router.get('/conversations', listConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

module.exports = router;
