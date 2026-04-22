const ChatConversation = require('../models/ChatConversation');
const { streamTurn } = require('../services/chatService');

// Resolve (or create) a conversation for the current user.
const resolveConversation = async (conversationId, userId) => {
    if (conversationId) {
        const conv = await ChatConversation.findOne({ _id: conversationId, user: userId });
        if (conv) return conv;
    }
    return new ChatConversation({ user: userId, title: 'New chat', messages: [] });
};

// @desc    Stream a chat turn (SSE)
// @route   POST /api/chat/stream
// @access  Private (any authenticated role)
exports.streamChat = async (req, res, next) => {
    try {
        const { message, conversationId } = req.body || {};
        if (!message || !String(message).trim()) {
            return res.status(400).json({ success: false, message: 'message is required' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        const conversation = await resolveConversation(conversationId, req.user._id);

        // Tell the client the conversation id immediately so the
        // frontend can associate incoming stream chunks before 'done'.
        res.write(`event: meta\n`);
        res.write(`data: ${JSON.stringify({ conversationId: String(conversation._id || '') })}\n\n`);

        await streamTurn({
            conversation,
            userMessage: String(message),
            user: req.user,
            res,
        });

        res.end();
    } catch (err) {
        // If the headers are already flushed, the client is mid-stream —
        // write one error frame and end. Otherwise surface as JSON.
        if (res.headersSent) {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ message: err.message || 'stream failed' })}\n\n`);
            return res.end();
        }
        next(err);
    }
};

// @desc    List current user's conversations (most recent first)
// @route   GET /api/chat/conversations
exports.listConversations = async (req, res, next) => {
    try {
        const rows = await ChatConversation.find({ user: req.user._id })
            .select('title lastActivityAt createdAt')
            .sort('-lastActivityAt')
            .limit(50)
            .lean();
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
};

// @desc    Get one conversation (full message history)
// @route   GET /api/chat/conversations/:id
exports.getConversation = async (req, res, next) => {
    try {
        const conv = await ChatConversation.findOne({
            _id: req.params.id,
            user: req.user._id,
        }).lean();
        if (!conv) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }
        // Strip internal tool frames before returning to the UI so the
        // user sees only the visible chat turns, not raw JSON tool output.
        const visible = (conv.messages || []).filter((m) => m.role !== 'tool');
        res.status(200).json({
            success: true,
            data: { ...conv, messages: visible },
        });
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a conversation
// @route   DELETE /api/chat/conversations/:id
exports.deleteConversation = async (req, res, next) => {
    try {
        const result = await ChatConversation.deleteOne({
            _id: req.params.id,
            user: req.user._id,
        });
        if (!result.deletedCount) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }
        res.status(200).json({ success: true });
    } catch (err) {
        next(err);
    }
};
