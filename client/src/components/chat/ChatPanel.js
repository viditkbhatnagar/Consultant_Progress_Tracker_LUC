import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    CircularProgress,
    Drawer,
    IconButton,
    TextField,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    Send as SendIcon,
    ChatBubbleOutline as ChatIcon,
    AddComment as NewChatIcon,
    History as HistoryIcon,
    DeleteOutline as DeleteIcon,
    ArrowBack as BackIcon,
    Mic as MicIcon,
    Stop as StopIcon,
    OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import SuggestedChips from './SuggestedChips';
import {
    streamChatTurn,
    listConversations,
    fetchConversation,
    deleteConversation,
    transcribeAudio,
} from '../../services/chatService';
import {
    streamDocsChat,
    fetchPdfBlobUrl,
} from '../../services/docsChatService';
import { routeFor } from '../../utils/classifyQuery';
import { getAskMeContext } from '../../utils/askMeContext';
import { useAuth } from '../../context/AuthContext';

// Prefer opus-in-webm (widest support) but fall back on platforms that
// don't allow it (Safari historically — iOS 14.3+ supports it now but
// older Mac Safari doesn't always). MediaRecorder.isTypeSupported does
// the detection at call time.
const pickMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

// Responsive drawer width. Keeps chats readable on narrow tablets but
// gives markdown tables with 5-8 columns (counselor / student / date /
// status / program / mode / remarks) enough room on desktop.
const DRAWER_WIDTHS = { xs: '100%', sm: 560, md: 640, lg: 720 };

// Phase 5: when the inline PDF preview panel is open the drawer expands
// to roughly two-thirds of the viewport so the PDF + chat both get
// comfortable widths. On narrow viewports we never show the split — the
// mobile fallback navigates to /pdf-viewer instead.
const DRAWER_WIDTHS_WITH_PREVIEW = {
    xs: '100%',
    sm: '100%',
    md: '92vw',
    lg: '82vw',
    xl: '1280px',
};

const ChatPanel = ({ open, onClose }) => {
    const location = useLocation();
    const { user } = useAuth();
    const theme = useTheme();
    // `md` is the split-vs-overlay breakpoint. Below this, source chips
    // navigate to the full-screen /pdf-viewer route instead of opening
    // the inline preview (60%/40% split doesn't fit below ~900 px).
    const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
    // LUC users get the docs router; everyone else sees the tracker-only
    // chatbot unchanged. `isLuc` pattern matches the app-wide convention
    // of defaulting missing organization to 'luc'.
    const isLuc = (user?.organization || 'luc') === 'luc';

    // Phase 5 preview state. `preview` is null when the split is closed.
    // When set: { blobUrl, title, page, chunkId, loading, error }. The
    // blobUrl is owned by this component — revoked on close/unmount so we
    // don't leak object URLs for the life of the session.
    const [preview, setPreview] = useState(null);
    const [messages, setMessages] = useState([]); // visible turns
    const [conversationId, setConversationId] = useState(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [activeToolName, setActiveToolName] = useState('');
    const [history, setHistory] = useState([]);
    const [view, setView] = useState('chat'); // 'chat' | 'history'
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const [recordSeconds, setRecordSeconds] = useState(0);
    const abortRef = useRef(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordTimerRef = useRef(null);

    // Auto-scroll to bottom on any message update.
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending, activeToolName]);

    // Focus the input whenever the drawer opens.
    useEffect(() => {
        if (open) {
            const t = setTimeout(() => inputRef.current?.focus(), 150);
            return () => clearTimeout(t);
        }
    }, [open]);

    const closePreview = useCallback(() => {
        setPreview((p) => {
            if (p?.blobUrl) URL.revokeObjectURL(p.blobUrl);
            return null;
        });
    }, []);

    // Fetch the highlighted (or fallback regular) PDF as a blob — matches
    // the authenticated-fetch pattern the PdfViewer page uses.
    const openPreview = useCallback(async ({ path, page, title, chunkId }) => {
        if (!path) return;
        // Revoke any previous blob before starting a new fetch.
        setPreview((prev) => {
            if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
            return { blobUrl: null, title, page, chunkId, loading: true, error: '' };
        });
        try {
            const blobUrl = await fetchPdfBlobUrl(path);
            setPreview({
                blobUrl,
                title,
                page,
                chunkId,
                loading: false,
                error: '',
            });
        } catch (err) {
            setPreview({
                blobUrl: null,
                title,
                page,
                chunkId,
                loading: false,
                error: err.message || 'Failed to load preview',
            });
        }
    }, []);

    // Release any held blob URL when the component unmounts or the drawer
    // is dismissed entirely (not just when the preview panel is closed).
    useEffect(() => {
        if (!open && preview?.blobUrl) {
            URL.revokeObjectURL(preview.blobUrl);
            setPreview(null);
        }
    }, [open, preview]);
    useEffect(() => () => {
        if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshHistory = useCallback(async () => {
        try {
            const rows = await listConversations();
            setHistory(rows);
        } catch {
            /* ignore — history UI will show empty */
        }
    }, []);

    useEffect(() => {
        if (open) refreshHistory();
    }, [open, refreshHistory]);

    const resetToNew = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setMessages([]);
        setConversationId(null);
        setInput('');
        setSending(false);
        setActiveToolName('');
        setView('chat');
    }, []);

    const loadConversation = useCallback(async (id) => {
        setView('chat');
        setMessages([]);
        setConversationId(id);
        try {
            const conv = await fetchConversation(id);
            if (!conv) return;
            setMessages(
                (conv.messages || []).map((m) => ({
                    id: String(m._id || Math.random()),
                    role: m.role,
                    content: m.content || '',
                    streaming: false,
                }))
            );
        } catch {
            /* ignore */
        }
    }, []);

    const onDeleteConversation = useCallback(
        async (id) => {
            if (!window.confirm('Delete this conversation?')) return;
            await deleteConversation(id);
            if (id === conversationId) resetToNew();
            refreshHistory();
        },
        [conversationId, resetToNew, refreshHistory]
    );

    const send = useCallback(
        async (text) => {
            const trimmed = (text || '').trim();
            if (!trimmed || sending) return;

            // Client-side router (spec §9 Pattern B). LUC consultants get
            // tracker + docs; Skillhub/manager stay on the tracker-only
            // path so /api/docs-chat is never called from non-LUC UI.
            // Phase 4.2: classifier itself is org-agnostic; the Skillhub
            // hard-lock lives here. Tracker is the default on ambiguous.
            const route = isLuc ? routeFor(trimmed) : 'tracker';

            const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
            const assistantMsg = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: '',
                streaming: true,
                sources: [],
                route,
            };
            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            setInput('');
            setSending(true);
            setActiveToolName('');

            const controller = new AbortController();
            abortRef.current = controller;

            // Shared SSE event handler (events are already normalized
            // across chatService and docsChatService: delta / done / error,
            // plus tracker-only meta / tool-start / tool-end).
            const onEvent = ({ event, data }) => {
                if (event === 'meta' && data?.conversationId) {
                    setConversationId(data.conversationId);
                    return;
                }
                if (event === 'delta' && data?.text) {
                    setMessages((prev) => {
                        const out = [...prev];
                        const last = out[out.length - 1];
                        if (last && last.role === 'assistant') {
                            out[out.length - 1] = {
                                ...last,
                                content: last.content + data.text,
                            };
                        }
                        return out;
                    });
                    return;
                }
                if (event === 'tool-start' && data?.name) {
                    setActiveToolName(data.name);
                    return;
                }
                if (event === 'tool-end') {
                    setActiveToolName('');
                    return;
                }
                if (event === 'done') {
                    // docs-chat ships sources + tier + exactMatch + logId +
                    // latencyMs. Tracker chat emits done with no extra
                    // fields today, so the spread-with-fallback is safe.
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.role === 'assistant' && m.streaming
                                ? {
                                      ...m,
                                      streaming: false,
                                      sources: data?.sources || m.sources || [],
                                      tier: data?.tier,
                                      exactMatch: data?.exactMatch,
                                      programFilter: data?.programFilter,
                                      logId: data?.logId || null,
                                      latencyMs: data?.latencyMs ?? null,
                                  }
                                : m
                        )
                    );
                    setSending(false);
                    setActiveToolName('');
                    if (route === 'tracker') refreshHistory();
                    return;
                }
                if (event === 'error') {
                    setMessages((prev) => {
                        const out = [...prev];
                        const last = out[out.length - 1];
                        if (last && last.role === 'assistant') {
                            out[out.length - 1] = {
                                ...last,
                                streaming: false,
                                content:
                                    last.content +
                                    (last.content ? '\n\n' : '') +
                                    `_Error: ${data?.message || 'something went wrong'}_`,
                            };
                        }
                        return out;
                    });
                    setSending(false);
                    setActiveToolName('');
                }
            };

            try {
                if (route === 'docs') {
                    // Pull ambient context (e.g. open Student detail drawer)
                    // so we can auto-scope docs retrieval by program.
                    const ctx = getAskMeContext() || {};
                    await streamDocsChat({
                        query: trimmed,
                        studentId: ctx.studentId,
                        leadId: ctx.leadId,
                        programHint: ctx.programHint,
                        signal: controller.signal,
                        onEvent,
                    });
                } else {
                    await streamChatTurn({
                        message: trimmed,
                        conversationId,
                        signal: controller.signal,
                        onEvent,
                    });
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.role === 'assistant' && m.streaming
                                ? { ...m, streaming: false, content: m.content + `\n\n_Network error._` }
                                : m
                        )
                    );
                }
                setSending(false);
                setActiveToolName('');
            }
        },
        [conversationId, sending, refreshHistory, isLuc]
    );

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    // Voice input — record with MediaRecorder, upload to /api/chat/transcribe
    // (server-side OpenAI Whisper), populate the chat input, and auto-send.
    // Whisper handles language auto-detection, so users can speak in any
    // of its 99+ supported languages without configuring anything.
    const stopStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        if (recordTimerRef.current) {
            clearInterval(recordTimerRef.current);
            recordTimerRef.current = null;
        }
    };

    const startRecording = useCallback(async () => {
        setVoiceError('');
        if (recording || sending || transcribing) return;
        if (!navigator.mediaDevices?.getUserMedia) {
            setVoiceError('Voice input not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const mimeType = pickMimeType();
            const mr = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];

            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mr.onstop = async () => {
                const type = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type });
                stopStream();
                setRecording(false);
                setRecordSeconds(0);
                if (blob.size < 500) {
                    setVoiceError('Too short — try again.');
                    return;
                }
                setTranscribing(true);
                try {
                    const text = await transcribeAudio(blob);
                    if (text) {
                        setInput(text);
                        // Auto-send transcribed text. The clarification
                        // flow lives server-side, so any ambiguity still
                        // triggers the same chip-based follow-up.
                        send(text);
                    } else {
                        setVoiceError('Couldn\'t hear anything — try again.');
                    }
                } catch (err) {
                    setVoiceError(err.message || 'Transcription failed.');
                } finally {
                    setTranscribing(false);
                }
            };

            mr.start();
            setRecording(true);
            setRecordSeconds(0);
            recordTimerRef.current = setInterval(() => {
                setRecordSeconds((s) => {
                    // Hard cap at 120s — Whisper handles longer but UX
                    // gets painful past ~2 minutes.
                    if (s >= 120) {
                        try { mr.stop(); } catch {}
                        return s;
                    }
                    return s + 1;
                });
            }, 1000);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setVoiceError('Microphone permission denied.');
            } else if (err.name === 'NotFoundError') {
                setVoiceError('No microphone detected.');
            } else {
                setVoiceError(err.message || 'Could not start recording.');
            }
            stopStream();
            setRecording(false);
        }
    }, [recording, sending, transcribing, send]);

    const stopRecording = useCallback(() => {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') {
            try { mr.stop(); } catch {}
        }
    }, []);

    // Clean up any live mic stream if the component unmounts mid-record.
    useEffect(() => () => stopStream(), []);

    const toolChip = useMemo(() => {
        if (!activeToolName) return null;
        const label = activeToolName.replace(/_/g, ' ');
        return `Fetching ${label}…`;
    }, [activeToolName]);

    const empty = messages.length === 0;

    const splitActive = Boolean(preview) && !isNarrow;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: splitActive ? DRAWER_WIDTHS_WITH_PREVIEW : DRAWER_WIDTHS,
                    backgroundColor: 'var(--d-bg, #F7F6F3)',
                    backgroundImage: 'none',
                    color: 'var(--d-text, #191918)',
                    borderLeft: '1px solid var(--d-border, #E6E3DC)',
                    display: 'flex',
                    flexDirection: splitActive ? 'row' : 'column',
                    transition: 'width 220ms ease',
                },
            }}
        >
            {/* Phase 5 — inline PDF preview panel (desktop only). On
                narrow viewports source chips navigate to /pdf-viewer
                instead, so this branch never renders. */}
            {splitActive && (
                <Box
                    sx={{
                        width: { md: '55%', lg: '58%', xl: '62%' },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRight: '1px solid var(--d-border, #E6E3DC)',
                        backgroundColor: '#1f1f1f',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            backgroundColor: 'var(--d-surface, #FFFFFF)',
                            borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                            color: 'var(--d-text, #191918)',
                        }}
                    >
                        <Typography
                            sx={{
                                flex: 1,
                                fontSize: 13,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {preview.title} · page {preview.page}
                        </Typography>
                        {preview.blobUrl && (
                            <Tooltip title="Open in new tab">
                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        window.open(
                                            preview.blobUrl +
                                                `#page=${preview.page}`,
                                            '_blank'
                                        )
                                    }
                                >
                                    <OpenInNewIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Close preview">
                            <IconButton size="small" onClick={closePreview}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box sx={{ position: 'relative', flex: 1 }}>
                        {preview.loading && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                }}
                            >
                                <CircularProgress color="inherit" size={24} />
                            </Box>
                        )}
                        {preview.error && (
                            <Box sx={{ p: 2, color: '#fff' }}>
                                <Typography variant="body2">
                                    {preview.error}
                                </Typography>
                            </Box>
                        )}
                        {preview.blobUrl && !preview.loading && !preview.error && (
                            <iframe
                                title={`${preview.title} preview`}
                                src={`${preview.blobUrl}#page=${preview.page}`}
                                style={{
                                    border: 0,
                                    width: '100%',
                                    height: '100%',
                                    background: '#fff',
                                }}
                            />
                        )}
                    </Box>
                </Box>
            )}

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: splitActive ? 1 : 'unset',
                    minWidth: 0,
                    width: splitActive ? 'auto' : '100%',
                    height: splitActive ? '100%' : undefined,
                }}
            >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                    flexShrink: 0,
                }}
            >
                {view === 'history' ? (
                    <Tooltip title="Back to chat">
                        <IconButton
                            size="small"
                            onClick={() => setView('chat')}
                            sx={{ color: 'var(--d-text-2)' }}
                        >
                            <BackIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <ChatIcon sx={{ color: 'var(--d-accent)', fontSize: 22 }} />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--d-text)',
                            letterSpacing: '-0.01em',
                            lineHeight: 1.15,
                        }}
                    >
                        {view === 'history' ? 'Chat history' : 'Ask me'}
                    </Typography>
                    {view === 'chat' && (
                        <Typography
                            sx={{
                                fontSize: 11,
                                color: 'var(--d-text-muted, #8A887E)',
                                fontWeight: 500,
                                letterSpacing: '0.01em',
                                mt: 0.25,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Ask in any language · voice or text
                        </Typography>
                    )}
                </Box>
                {view === 'chat' && (
                    <>
                        <Tooltip title="History">
                            <IconButton
                                size="small"
                                onClick={() => setView('history')}
                                sx={{ color: 'var(--d-text-3)' }}
                            >
                                <HistoryIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="New chat">
                            <IconButton
                                size="small"
                                onClick={resetToNew}
                                sx={{ color: 'var(--d-text-3)' }}
                            >
                                <NewChatIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                <Tooltip title="Close">
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{ color: 'var(--d-text-3)' }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Body */}
            {view === 'history' ? (
                <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
                    {history.length === 0 ? (
                        <Typography
                            sx={{
                                textAlign: 'center',
                                color: 'var(--d-text-muted)',
                                fontSize: 13,
                                mt: 4,
                                px: 3,
                            }}
                        >
                            No conversations yet.
                        </Typography>
                    ) : (
                        history.map((h) => (
                            <Box
                                key={h._id}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 2,
                                    py: 1.25,
                                    borderBottom: '1px solid var(--d-border-soft)',
                                    cursor: 'pointer',
                                    transition:
                                        'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                    '&:hover': { backgroundColor: 'var(--d-surface-hover)' },
                                }}
                                onClick={() => loadConversation(h._id)}
                            >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: 'var(--d-text)',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {h.title || 'Untitled'}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: 11,
                                            color: 'var(--d-text-muted)',
                                        }}
                                    >
                                        {new Date(h.lastActivityAt).toLocaleString()}
                                    </Typography>
                                </Box>
                                <IconButton
                                    size="small"
                                    sx={{ color: 'var(--d-danger)' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteConversation(h._id);
                                    }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        ))
                    )}
                </Box>
            ) : (
                <>
                    <Box
                        ref={scrollRef}
                        sx={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            py: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                        }}
                    >
                        {empty && (
                            <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
                                <Typography
                                    sx={{
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'var(--d-text)',
                                        letterSpacing: '-0.01em',
                                        mb: 0.5,
                                    }}
                                >
                                    Ask anything about the tracker.
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: 13,
                                        color: 'var(--d-text-3)',
                                        lineHeight: 1.5,
                                    }}
                                >
                                    Revenue, team performance, attendance, student records — in
                                    natural language. I read live data and answer in seconds.
                                </Typography>
                            </Box>
                        )}

                        {empty && <SuggestedChips pathname={location.pathname} onPick={send} />}

                        {messages.map((m) => (
                            <ChatMessage
                                key={m.id}
                                role={m.role}
                                content={m.content}
                                streaming={m.streaming}
                                sources={m.sources}
                                logId={m.logId}
                                latencyMs={m.latencyMs}
                                onChipClick={(t) => send(t)}
                                onOpenPreview={isNarrow ? null : openPreview}
                            />
                        ))}

                        {toolChip && (
                            <Box sx={{ px: 2, pb: 1 }}>
                                <Typography
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        fontSize: 11,
                                        color: 'var(--d-text-muted)',
                                        backgroundColor: 'var(--d-surface-muted)',
                                        border: '1px solid var(--d-border-soft)',
                                        borderRadius: 999,
                                        px: 1.25,
                                        py: 0.35,
                                        fontStyle: 'italic',
                                    }}
                                >
                                    {toolChip}
                                </Typography>
                            </Box>
                        )}

                        {/* Voice input status — shown above the input when
                            recording or transcribing so users know what's
                            happening. Also surfaces permission errors. */}
                        {(recording || transcribing || voiceError) && (
                            <Box sx={{ px: 2, pb: 1 }}>
                                {recording && (
                                    <Box
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            fontSize: 12,
                                            color: 'var(--d-danger, #B91C1C)',
                                            backgroundColor: 'var(--d-danger-bg, rgba(220,38,38,0.1))',
                                            border: '1px solid var(--d-danger, #B91C1C)',
                                            borderRadius: 999,
                                            px: 1.25,
                                            py: 0.35,
                                            fontWeight: 600,
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--d-danger, #B91C1C)',
                                                animation: 'voicePulse 1s ease-in-out infinite',
                                                '@keyframes voicePulse': {
                                                    '0%, 100%': { opacity: 1 },
                                                    '50%': { opacity: 0.35 },
                                                },
                                            }}
                                        />
                                        Recording · {String(Math.floor(recordSeconds / 60)).padStart(1, '0')}:{String(recordSeconds % 60).padStart(2, '0')} · tap stop when done
                                    </Box>
                                )}
                                {!recording && transcribing && (
                                    <Typography
                                        sx={{
                                            display: 'inline-flex',
                                            fontSize: 12,
                                            fontStyle: 'italic',
                                            color: 'var(--d-text-muted)',
                                            backgroundColor: 'var(--d-surface-muted)',
                                            border: '1px solid var(--d-border-soft)',
                                            borderRadius: 999,
                                            px: 1.25,
                                            py: 0.35,
                                        }}
                                    >
                                        Transcribing…
                                    </Typography>
                                )}
                                {!recording && !transcribing && voiceError && (
                                    <Typography
                                        sx={{
                                            display: 'inline-flex',
                                            fontSize: 12,
                                            color: 'var(--d-danger-text)',
                                            backgroundColor: 'var(--d-danger-bg)',
                                            border: '1px solid var(--d-danger, #B91C1C)',
                                            borderRadius: 999,
                                            px: 1.25,
                                            py: 0.35,
                                        }}
                                    >
                                        {voiceError}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* Input */}
                    <Box
                        sx={{
                            p: 1.5,
                            borderTop: '1px solid var(--d-border-soft, #ECE9E2)',
                            backgroundColor: 'var(--d-surface, #FFFFFF)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: 1,
                        }}
                    >
                        <TextField
                            inputRef={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder={recording ? 'Listening…' : transcribing ? 'Transcribing…' : 'Ask about revenue, team performance, attendance… or tap the mic'}
                            fullWidth
                            multiline
                            maxRows={4}
                            size="small"
                            disabled={sending || recording || transcribing}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                                    borderRadius: '10px',
                                    fontSize: 14,
                                    '& fieldset': { borderColor: 'var(--d-border, #E6E3DC)' },
                                    '&:hover fieldset': { borderColor: 'var(--d-accent, #2383E2)' },
                                    '&.Mui-focused fieldset': {
                                        borderColor: 'var(--d-accent, #2383E2)',
                                        borderWidth: '1px',
                                    },
                                },
                            }}
                        />

                        {/* Mic / Stop toggle — voice input. Recording state
                            swaps to a red stop button. Disabled while a
                            previous transcription is in-flight or while
                            the assistant is streaming. */}
                        <Tooltip title={recording ? 'Stop recording' : 'Voice input'}>
                            <span>
                                <IconButton
                                    onClick={recording ? stopRecording : startRecording}
                                    disabled={sending || transcribing}
                                    sx={{
                                        backgroundColor: recording
                                            ? 'var(--d-danger, #B91C1C)'
                                            : 'var(--d-surface-muted, #F1EFEA)',
                                        color: recording
                                            ? '#FFFFFF'
                                            : 'var(--d-text-2, #2A2927)',
                                        border: '1px solid',
                                        borderColor: recording
                                            ? 'var(--d-danger, #B91C1C)'
                                            : 'var(--d-border, #E6E3DC)',
                                        borderRadius: '10px',
                                        width: 40,
                                        height: 40,
                                        transition:
                                            'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                                        '&:hover': {
                                            backgroundColor: recording
                                                ? 'var(--d-danger-text, #B91C1C)'
                                                : 'var(--d-surface-hover, #EFEDE8)',
                                            borderColor: recording
                                                ? 'var(--d-danger, #B91C1C)'
                                                : 'var(--d-accent, #2383E2)',
                                        },
                                        '&.Mui-disabled': {
                                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                                            color: 'var(--d-text-muted, #8A887E)',
                                        },
                                    }}
                                >
                                    {recording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Tooltip title="Send">
                            <span>
                                <IconButton
                                    onClick={() => send(input)}
                                    disabled={sending || recording || transcribing || !input.trim()}
                                    sx={{
                                        backgroundColor: 'var(--d-accent, #2383E2)',
                                        color: '#FFFFFF',
                                        borderRadius: '10px',
                                        width: 40,
                                        height: 40,
                                        '&:hover': {
                                            backgroundColor: 'var(--d-accent-text, #1F6FBF)',
                                        },
                                        '&.Mui-disabled': {
                                            backgroundColor: 'var(--d-disabled, #C9C5BB)',
                                            color: 'var(--d-surface, #FFFFFF)',
                                        },
                                    }}
                                >
                                    <SendIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </>
            )}
            </Box>
        </Drawer>
    );
};

export default ChatPanel;
