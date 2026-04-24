// Streaming client for the docs-RAG chatbot. POSTs to /api/docs-chat and
// parses the server's SSE stream (event: delta / event: done / event: error)
// into per-frame callbacks, mirroring chatService.streamChatTurn so the UI
// can drive both with the same onEvent contract.

import { API_BASE_URL } from '../utils/constants';

const url = (path) => `${API_BASE_URL}${path}`;

const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Stream a docs-chat turn.
 *
 * @param {object} opts
 * @param {string} opts.query - user question
 * @param {string} [opts.studentId] - active Student row context (server
 *     verifies ownership + extracts Student.program for programFilter)
 * @param {string} [opts.leadId] - alias for studentId in this codebase
 *     (no separate Lead collection)
 * @param {string} [opts.programHint] - slug like 'ssm-mba'; server validates
 *     against the known program enum before honouring
 * @param {(evt: {event: string, data: any}) => void} opts.onEvent
 * @param {AbortSignal} [opts.signal]
 */
export async function streamDocsChat({
    query,
    studentId,
    leadId,
    programHint,
    onEvent,
    signal,
}) {
    const response = await fetch(url('/docs-chat'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...authHeaders(),
        },
        body: JSON.stringify({ query, studentId, leadId, programHint }),
        signal,
    });

    if (!response.ok || !response.body) {
        let serverMessage = 'Docs chat request failed';
        try {
            const j = await response.json();
            serverMessage = j.message || serverMessage;
        } catch {
            /* body may already be consumed */
        }
        onEvent?.({
            event: 'error',
            data: { message: serverMessage, status: response.status },
        });
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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

/**
 * Submit thumbs-up / thumbs-down feedback on a previously logged answer.
 * The logId comes from the SSE `done` event's payload. Silent on success.
 */
export async function submitFeedback({ logId, rating, comment }) {
    const res = await fetch(url('/docs-chat/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ logId, rating, comment: comment || '' }),
    });
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Feedback failed (HTTP ${res.status})`);
    }
    return res.json();
}

/** Admin: pull the /api/docs-chat/stats payload for the admin dashboard. */
export async function fetchDocsRagStats() {
    const res = await fetch(url('/docs-chat/stats'), { headers: authHeaders() });
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Stats fetch failed (HTTP ${res.status})`);
    }
    const j = await res.json();
    return j.data;
}

/** Admin: trigger a re-ingest. Resolves with the new stats on success. */
export async function triggerReingest({ force = false } = {}) {
    const res = await fetch(
        url(`/docs-chat/admin/reingest${force ? '?force=true' : ''}`),
        { method: 'POST', headers: authHeaders() }
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(j.message || `Re-ingest failed (HTTP ${res.status})`);
    }
    return j;
}

/**
 * Fetch a protected program-docs PDF as a blob and return an object URL
 * suitable for <iframe src={blobUrl + '#page=N'}>. Caller is responsible
 * for URL.revokeObjectURL() on unmount to avoid memory leaks.
 *
 * Throws on 401/403 so the caller can route the user back to login or
 * show a clear access message.
 */
export async function fetchPdfBlobUrl(pdfPath) {
    // pdfPath looks like '/program-docs/ssm-dba/DBA.pdf' — hit the server
    // root (not API_BASE_URL) because static PDFs live outside /api.
    const base =
        process.env.NODE_ENV === 'production'
            ? ''
            : 'http://localhost:5001';
    const res = await fetch(`${base}${pdfPath}`, {
        headers: authHeaders(),
    });
    if (!res.ok) {
        const err = new Error(
            res.status === 401
                ? 'Not authenticated'
                : res.status === 403
                    ? 'This document is restricted to LUC users.'
                    : `Failed to load PDF (HTTP ${res.status})`
        );
        err.status = res.status;
        throw err;
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
