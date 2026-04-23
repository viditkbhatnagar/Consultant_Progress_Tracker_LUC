import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Small circular "VB" avatar displayed next to every assistant bubble.
// Branded, themed, and keyed to the accent color so it sits naturally
// in both light and dark mode without extra assets.
const VBAvatar = () => (
    <Box
        aria-hidden
        sx={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--d-accent, #2383E2)',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            userSelect: 'none',
            flexShrink: 0,
        }}
    >
        VB
    </Box>
);

// Pulsing three-dot "thinking" indicator shown while the assistant is
// working but hasn't streamed any content yet. Replaces the old empty-
// bubble + "…" placeholder that flashed as a white circle.
const ThinkingDots = () => (
    <Box
        sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            py: 0.5,
            '& span': {
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--d-text-muted, #8A887E)',
                animation: 'vbDot 1.1s ease-in-out infinite',
            },
            '& span:nth-of-type(2)': { animationDelay: '0.15s' },
            '& span:nth-of-type(3)': { animationDelay: '0.3s' },
            '@keyframes vbDot': {
                '0%, 80%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
                '40%': { opacity: 1, transform: 'translateY(-2px)' },
            },
        }}
    >
        <span />
        <span />
        <span />
    </Box>
);

// Render a single chat message. Uses `react-markdown` + GFM (tables,
// task lists, strikethrough). Assistant messages show a small VB avatar
// on the left; user messages stay right-aligned with no avatar.
const ChatMessage = ({ role, content, streaming = false, onChipClick }) => {
    const isUser = role === 'user';

    // Detect trailing "options" list so we can render them as clickable
    // chips below the message. The system prompt tells the LLM to emit
    // hyphen-bulleted options when asking for clarification.
    const { displayContent, chips } = useMemo(() => {
        if (isUser || !content) return { displayContent: content, chips: [] };
        const lines = content.split('\n');
        const out = [];
        const options = [];
        let inTrailingList = true;
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (inTrailingList && /^\s*[-*]\s+/.test(line)) {
                options.unshift(line.replace(/^\s*[-*]\s+/, '').trim());
                continue;
            }
            if (inTrailingList && line.trim() === '') continue;
            inTrailingList = false;
            out.unshift(line);
        }
        const trailing = out.join('\n').trimEnd();
        const hasQuestion = /[?]\s*$/.test(trailing);
        if (options.length >= 2 && options.length <= 6 && hasQuestion) {
            return { displayContent: trailing, chips: options };
        }
        return { displayContent: content, chips: [] };
    }, [content, isUser]);

    // If an assistant message has neither content nor a streaming flag,
    // there's nothing to show — hide the row entirely so we don't leave
    // a floating avatar or an empty bubble artifact between turns.
    if (!isUser && !content && !streaming) return null;

    const emptyWhileStreaming = !isUser && !displayContent && streaming;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: isUser ? 'column' : 'row',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: isUser ? 0 : 1,
                mb: 1.5,
                px: 2,
                // Without these, a wide table inside the bubble forces
                // this row to grow past the drawer width.
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
            }}
        >
            {!isUser && <VBAvatar />}

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    flex: isUser ? 'unset' : 1,
                    maxWidth: '100%',
                    overflow: 'hidden',
                }}
            >
                {!isUser && (
                    <Typography
                        sx={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: 'var(--d-text-muted, #8A887E)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            mb: 0.5,
                        }}
                    >
                        VB
                    </Typography>
                )}
                <Box
                    sx={{
                        // Cap width and let the internal table wrapper handle
                        // horizontal scrolling. `width: auto` (vs fit-content)
                        // prevents wide tables from blowing past the drawer.
                        maxWidth: isUser ? '92%' : '100%',
                        width: 'auto',
                        alignSelf: isUser ? 'flex-end' : 'stretch',
                        backgroundColor: isUser
                            ? 'var(--d-accent-bg, rgba(35,131,226,0.08))'
                            : 'var(--d-surface, #FFFFFF)',
                        color: isUser
                            ? 'var(--d-accent-text, #1F6FBF)'
                            : 'var(--d-text, #191918)',
                        border: isUser
                            ? '1px solid var(--d-accent-border, #2383E2)'
                            : '1px solid var(--d-border-soft, #ECE9E2)',
                        borderRadius: '14px',
                        px: 1.75,
                        py: emptyWhileStreaming ? 0.75 : 1.25,
                        fontSize: 14,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        minWidth: 0,
                        overflow: 'hidden',
                        '& p': { margin: '0 0 6px 0' },
                        '& p:last-child': { margin: 0 },
                        '& ul, & ol': { margin: '4px 0 4px 18px', padding: 0 },
                        '& li': { margin: '2px 0' },
                        '& code': {
                            fontFamily: 'var(--d-font-mono, monospace)',
                            fontSize: 12.5,
                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                            padding: '1px 5px',
                            borderRadius: 4,
                        },
                        '& pre': {
                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                            padding: 1,
                            borderRadius: 8,
                            overflowX: 'auto',
                        },
                        // Tables: wrap in a horizontally-scrollable surface so
                        // wide tables don't force text to break character-by-
                        // character. The surrounding .md-table-wrap div is
                        // injected by the `table` renderer below.
                        '& .md-table-wrap': {
                            width: '100%',
                            maxWidth: '100%',
                            overflowX: 'auto',
                            margin: '8px 0',
                            border: '1px solid var(--d-border-soft, #ECE9E2)',
                            borderRadius: 10,
                            backgroundColor: 'var(--d-surface, #FFFFFF)',
                        },
                        '& table': {
                            borderCollapse: 'collapse',
                            width: 'max-content',
                            minWidth: '100%',
                            fontSize: 12.75,
                            fontVariantNumeric: 'tabular-nums',
                        },
                        '& th, & td': {
                            borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                            padding: '8px 12px',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            verticalAlign: 'top',
                        },
                        '& tr:last-child td': { borderBottom: 'none' },
                        '& th': {
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                            color: 'var(--d-text-muted, #8A887E)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            fontSize: 11,
                            fontWeight: 600,
                            borderBottom: '1px solid var(--d-border, #E6E3DC)',
                        },
                        '& tbody tr:hover td': {
                            backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
                        },
                        '& a': { color: 'var(--d-accent, #2383E2)' },
                        '& strong': { fontWeight: 700 },
                    }}
                >
                    {isUser ? (
                        content
                    ) : emptyWhileStreaming ? (
                        <ThinkingDots />
                    ) : (
                        <>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // Wrap every markdown table in a scrollable
                                    // container so wide (5-8 column) tables can
                                    // scroll horizontally.
                                    table: ({ node, ...props }) => (
                                        <div className="md-table-wrap">
                                            <table {...props} />
                                        </div>
                                    ),
                                }}
                            >
                                {displayContent}
                            </ReactMarkdown>
                            {streaming && (
                                <Box
                                    component="span"
                                    sx={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '14px',
                                        verticalAlign: 'text-bottom',
                                        ml: 0.25,
                                        backgroundColor: 'var(--d-accent)',
                                        animation: 'chatCursorBlink 1s steps(2, start) infinite',
                                        '@keyframes chatCursorBlink': {
                                            '0%': { opacity: 1 },
                                            '50%': { opacity: 0 },
                                            '100%': { opacity: 1 },
                                        },
                                    }}
                                />
                            )}
                        </>
                    )}
                </Box>

                {chips.length > 0 && !streaming && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.75,
                            mt: 1,
                        }}
                    >
                        {chips.map((c, i) => (
                            <Box
                                key={i}
                                component="button"
                                type="button"
                                onClick={() => onChipClick?.(c)}
                                sx={{
                                    border: '1px solid var(--d-border, #E6E3DC)',
                                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                                    color: 'var(--d-text-2, #2A2927)',
                                    borderRadius: 999,
                                    px: 1.5,
                                    py: 0.5,
                                    fontSize: 12.5,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition:
                                        'background-color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                                    '&:hover': {
                                        backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                                        borderColor: 'var(--d-accent, #2383E2)',
                                        color: 'var(--d-accent-text, #1F6FBF)',
                                    },
                                    '&:focus-visible': {
                                        outline: '2px solid var(--d-accent, #2383E2)',
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                {c}
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default ChatMessage;
