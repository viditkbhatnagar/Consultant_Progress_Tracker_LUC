const mongoose = require('mongoose');

// Individual message in a chat conversation. Stored inline in the
// conversation document so we can stream the whole thread to the client
// in one round-trip. `toolCalls` / `toolResults` are persisted so that
// (a) we can reconstruct the exact OpenAI context when resuming, and
// (b) admins can audit what backend queries a chatbot answer was based on.
const messageSchema = new mongoose.Schema(
    {
        role: {
            type: String,
            enum: ['system', 'user', 'assistant', 'tool'],
            required: true,
        },
        content: { type: String, default: '' },
        // Populated when the assistant decided to call a tool.
        toolCalls: [
            {
                id: String,
                name: String,
                arguments: String, // raw JSON string as received from OpenAI
            },
        ],
        // For role='tool' replies — which call this answers.
        toolCallId: String,
        toolName: String,
        // Token usage recorded for each assistant-level completion so the
        // client can show cumulative cost if we ever want it.
        usage: {
            promptTokens: Number,
            completionTokens: Number,
            totalTokens: Number,
        },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const chatConversationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        // Human-readable title — auto-derived from the first user message
        // after the first turn completes. Editable later if we want.
        title: { type: String, default: 'New chat' },
        messages: { type: [messageSchema], default: [] },
        // Last-accessed timestamp drives the conversation-list ordering
        // without forcing us to read the embedded messages array.
        lastActivityAt: { type: Date, default: Date.now, index: true },
    },
    { timestamps: true }
);

// Compound index so the "my conversations" list query (user + sort by
// last activity) hits an index instead of scanning.
chatConversationSchema.index({ user: 1, lastActivityAt: -1 });

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
