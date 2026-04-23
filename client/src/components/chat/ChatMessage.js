import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Render a single chat message. Uses `react-markdown` + GFM (tables,
// task lists, strikethrough). Every element is themed via dashboard tokens
// with hex fallbacks so the same component works when called from admin,
// TL, skillhub, or any tracker page.
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
        // Only activate chip mode if we captured 2–6 clean options AND the
        // message visibly ends with a question. Keeps normal bullet lists
        // (summaries, breakdowns) from being mistaken for clarification.
        const trailing = out.join('\n').trimEnd();
        const hasQuestion = /[?]\s*$/.test(trailing);
        if (options.length >= 2 && options.length <= 6 && hasQuestion) {
            return { displayContent: trailing, chips: options };
        }
        return { displayContent: content, chips: [] };
    }, [content, isUser]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                mb: 1.5,
                px: 2,
            }}
        >
            <Box
                sx={{
                    // Assistant bubbles can go nearly full width so wide
                    // markdown tables have room; user bubbles stay right-aligned.
                    maxWidth: isUser ? '92%' : '98%',
                    width: isUser ? 'auto' : 'fit-content',
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
                    py: 1.25,
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    // Compact spacing for common block elements so the chat
                    // doesn't feel airy.
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
                    // character. The surrounding .markdown-table-wrapper
                    // div is injected by the `table` renderer below.
                    '& .md-table-wrap': {
                        width: '100%',
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
                ) : (
                    <>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Wrap every markdown table in a scrollable
                                // container so wide (5-8 column) tables can
                                // scroll horizontally instead of compressing
                                // and breaking text character-by-character.
                                table: ({ node, ...props }) => (
                                    <div className="md-table-wrap">
                                        <table {...props} />
                                    </div>
                                ),
                            }}
                        >
                            {displayContent || (streaming ? '…' : '')}
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
                        maxWidth: '92%',
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
    );
};

export default ChatMessage;
