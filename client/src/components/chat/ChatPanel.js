import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Drawer,
    IconButton,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    Send as SendIcon,
    ChatBubbleOutline as ChatIcon,
    AddComment as NewChatIcon,
    History as HistoryIcon,
    DeleteOutline as DeleteIcon,
    ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import SuggestedChips from './SuggestedChips';
import {
    streamChatTurn,
    listConversations,
    fetchConversation,
    deleteConversation,
} from '../../services/chatService';

const DRAWER_WIDTH = 480;

const ChatPanel = ({ open, onClose }) => {
    const location = useLocation();
    const [messages, setMessages] = useState([]); // visible turns
    const [conversationId, setConversationId] = useState(null);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [activeToolName, setActiveToolName] = useState('');
    const [history, setHistory] = useState([]);
    const [view, setView] = useState('chat'); // 'chat' | 'history'
    const abortRef = useRef(null);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

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

            const userMsg = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
            const assistantMsg = {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: '',
                streaming: true,
            };
            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            setInput('');
            setSending(true);
            setActiveToolName('');

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                await streamChatTurn({
                    message: trimmed,
                    conversationId,
                    signal: controller.signal,
                    onEvent: ({ event, data }) => {
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
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.role === 'assistant' && m.streaming
                                        ? { ...m, streaming: false }
                                        : m
                                )
                            );
                            setSending(false);
                            setActiveToolName('');
                            refreshHistory();
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
                    },
                });
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
        [conversationId, sending, refreshHistory]
    );

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    const toolChip = useMemo(() => {
        if (!activeToolName) return null;
        const label = activeToolName.replace(/_/g, ' ');
        return `Fetching ${label}…`;
    }, [activeToolName]);

    const empty = messages.length === 0;

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: { xs: '100%', sm: DRAWER_WIDTH },
                    backgroundColor: 'var(--d-bg, #F7F6F3)',
                    backgroundImage: 'none',
                    color: 'var(--d-text, #191918)',
                    borderLeft: '1px solid var(--d-border, #E6E3DC)',
                    display: 'flex',
                    flexDirection: 'column',
                },
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
                <Typography
                    sx={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--d-text)',
                        flex: 1,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {view === 'history' ? 'Chat history' : 'Ask me'}
                </Typography>
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
                            overflow: 'auto',
                            py: 1.5,
                            display: 'flex',
                            flexDirection: 'column',
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
                                onChipClick={(t) => send(t)}
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
                            placeholder="Ask about revenue, team performance, attendance…"
                            fullWidth
                            multiline
                            maxRows={4}
                            size="small"
                            disabled={sending}
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
                        <Tooltip title="Send">
                            <span>
                                <IconButton
                                    onClick={() => send(input)}
                                    disabled={sending || !input.trim()}
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
        </Drawer>
    );
};

export default ChatPanel;
