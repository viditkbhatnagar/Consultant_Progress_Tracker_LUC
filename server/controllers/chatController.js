const ChatConversation = require('../models/ChatConversation');
const { streamTurn } = require('../services/chatService');
const OpenAI = require('openai');
const { toFile } = require('openai');

let openaiClient = null;
const getOpenAI = () => {
    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
};

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

// @desc    Transcribe a short audio clip via OpenAI Whisper.
// @route   POST /api/chat/transcribe   (multipart/form-data, field: "audio")
// @access  Private
//
// The audio blob is uploaded from the browser's MediaRecorder (usually
// webm/opus; Safari sends mp4/aac). We forward the raw buffer straight to
// OpenAI's audio.transcriptions endpoint — no server-side storage,
// nothing written to disk. Whisper auto-detects the language, so users
// can speak in any of its 99+ supported languages (Hindi, Malayalam,
// Arabic, English…) without having to pick one up front.
exports.transcribeAudio = async (req, res, next) => {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ success: false, message: 'No audio file uploaded (expected field "audio")' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res
                .status(503)
                .json({ success: false, message: 'Speech-to-text is not configured on the server.' });
        }

        // Whisper figures out the format from the filename extension, so
        // keep the incoming mime hint honest. Fallback: .webm — Chrome's
        // default MediaRecorder output and the safest all-rounder.
        const mime = req.file.mimetype || 'audio/webm';
        const ext =
            mime.includes('mp4') || mime.includes('m4a') ? 'm4a' :
            mime.includes('ogg') ? 'ogg' :
            mime.includes('wav') ? 'wav' :
            mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' :
            'webm';

        const file = await toFile(req.file.buffer, `voice.${ext}`, { type: mime });

        const result = await getOpenAI().audio.transcriptions.create({
            file,
            model: 'whisper-1',
            // No `language` param — Whisper auto-detects. Passing
            // response_format: 'verbose_json' would give us the detected
            // language string, but plain JSON is faster and the client
            // doesn't need it today.
        });

        const text = (result.text || '').trim();
        return res.status(200).json({ success: true, text });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[transcribe] failed:', err?.message || err);
        // Surface the rate-limit / service-unavailable errors distinctly
        // so the client can show a helpful message.
        if (err?.status === 429) {
            return res.status(502).json({
                success: false,
                message: 'Speech-to-text is temporarily rate-limited. Try again in a moment.',
            });
        }
        if (err?.status === 413) {
            return res.status(413).json({
                success: false,
                message: 'Recording too long. Keep voice input under ~2 minutes.',
            });
        }
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
