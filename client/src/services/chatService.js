// Streaming client for the chat copilot. Talks to /api/chat/stream via
// SSE so tokens land in the UI as they're generated (Claude / ChatGPT
// feel). We use fetch + ReadableStream rather than EventSource because
// EventSource can't send POST bodies or an Authorization header.

import { API_BASE_URL } from '../utils/constants';

const url = (path) => `${API_BASE_URL}${path}`;

const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Stream a chat turn. Resolves when the server emits `done` or `error`.
 *
 * @param {object} opts
 * @param {string} opts.message - user message
 * @param {string} [opts.conversationId] - existing thread to append to
 * @param {(evt: {event: string, data: any}) => void} opts.onEvent - per-SSE callback
 * @param {AbortSignal} [opts.signal] - allows the UI to cancel
 */
export async function streamChatTurn({ message, conversationId, onEvent, signal }) {
    const response = await fetch(url('/chat/stream'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...authHeaders(),
        },
        body: JSON.stringify({ message, conversationId }),
        signal,
    });

    if (!response.ok || !response.body) {
        let serverMessage = 'Chat request failed';
        try {
            const j = await response.json();
            serverMessage = j.message || serverMessage;
        } catch {
            /* body may already be consumed */
        }
        onEvent?.({ event: 'error', data: { message: serverMessage } });
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // SSE frames are separated by a blank line. Each frame has `event:`
    // and `data:` lines. We accumulate until we see `\n\n` then dispatch.
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            let event = 'message';
            const dataLines = [];
            for (const line of raw.split('\n')) {
                if (line.startsWith('event: ')) event = line.slice(7).trim();
                else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
            }
            const dataRaw = dataLines.join('\n');
            let data;
            try {
                data = dataRaw ? JSON.parse(dataRaw) : {};
            } catch {
                data = { raw: dataRaw };
            }
            onEvent?.({ event, data });
        }
    }
}

export async function listConversations() {
    const res = await fetch(url('/chat/conversations'), { headers: authHeaders() });
    const j = await res.json();
    return j.data || [];
}

export async function fetchConversation(id) {
    const res = await fetch(url(`/chat/conversations/${id}`), { headers: authHeaders() });
    const j = await res.json();
    return j.data || null;
}

export async function deleteConversation(id) {
    const res = await fetch(url(`/chat/conversations/${id}`), {
        method: 'DELETE',
        headers: authHeaders(),
    });
    return res.ok;
}
