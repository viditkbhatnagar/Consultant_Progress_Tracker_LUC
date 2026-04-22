import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Box, IconButton } from '@mui/material';
import { ChevronLeft as LeftIcon, ChevronRight as RightIcon } from '@mui/icons-material';

const SCROLL_STEP = 320;

/**
 * Reusable horizontal scroller with a top control bar (left/right chevrons +
 * a clickable progress track). Works for both Kanban-style flex rows AND
 * tables — pass `variant="embedded"` when the parent already provides the
 * surrounding card so we don't double-wrap.
 *
 * Props:
 *   - children: the content to scroll (board columns OR a table)
 *   - variant: "default" (outer white card, Kanban bg) | "embedded" (no card,
 *     transparent scroll container — used inside a table card)
 *   - hideWhenNoOverflow: when true, hides the top bar entirely if the
 *     content already fits without horizontal scrolling. Defaults true.
 *   - contentSx: extra sx merged into the scroll container
 */
const BoardHorizontalScroller = ({
    children,
    variant = 'default',
    hideWhenNoOverflow = true,
    contentSx,
}) => {
    const scrollRef = useRef(null);
    const trackRef = useRef(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);
    const [thumb, setThumb] = useState({ left: 0, width: 1 });

    const update = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 1);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        const ratio = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
        const width = Math.max(Math.min(ratio, 1), 0.08);
        const pos = el.scrollWidth - el.clientWidth > 0
            ? el.scrollLeft / (el.scrollWidth - el.clientWidth)
            : 0;
        setThumb({ left: pos * (1 - width), width });
    }, []);

    useEffect(() => {
        update();
        const el = scrollRef.current;
        if (!el) return () => {};
        const onScroll = () => update();
        el.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', update);
        };
    }, [update, children]);

    const nudge = (dir) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
    };

    const onTrackClick = (e) => {
        const track = trackRef.current;
        const el = scrollRef.current;
        if (!track || !el) return;
        const rect = track.getBoundingClientRect();
        const clickedRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollTo({ left: clickedRatio * maxScroll, behavior: 'smooth' });
    };

    const hasOverflow = canLeft || canRight;
    const showBar = hideWhenNoOverflow ? hasOverflow : true;

    const isEmbedded = variant === 'embedded';
    const bg = isEmbedded ? 'var(--t-surface)' : 'var(--t-surface-muted)';

    const topBar = showBar ? (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                padding: '8px 12px',
                backgroundColor: 'var(--t-surface-elev)',
                borderBottom: '1px solid var(--t-border)',
            }}
        >
            <IconButton
                onClick={() => nudge(-1)}
                disabled={!canLeft}
                aria-label="Scroll left"
                size="small"
                sx={{
                    width: 30,
                    height: 30,
                    backgroundColor: 'var(--t-surface)',
                    color: 'var(--t-text-3)',
                    border: '1px solid var(--t-border)',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                    '&:hover': { backgroundColor: 'var(--t-surface-muted)', color: 'var(--t-text)' },
                    '&.Mui-disabled': { color: 'var(--t-disabled)', borderColor: 'var(--t-border-soft)' },
                }}
            >
                <LeftIcon fontSize="small" />
            </IconButton>

            <Box
                ref={trackRef}
                onClick={onTrackClick}
                sx={{
                    position: 'relative',
                    flex: 1,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: 'var(--t-track-bg)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'background-color 120ms ease',
                    '&:hover': { backgroundColor: 'var(--t-track-bg-hover)' },
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${thumb.left * 100}%`,
                        width: `${thumb.width * 100}%`,
                        backgroundColor: 'var(--t-text-faint)',
                        borderRadius: 999,
                        transition: 'left 120ms ease, width 120ms ease',
                    }}
                />
            </Box>

            <IconButton
                onClick={() => nudge(1)}
                disabled={!canRight}
                aria-label="Scroll right"
                size="small"
                sx={{
                    width: 30,
                    height: 30,
                    backgroundColor: 'var(--t-surface)',
                    color: 'var(--t-text-3)',
                    border: '1px solid var(--t-border)',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                    '&:hover': { backgroundColor: 'var(--t-surface-muted)', color: 'var(--t-text)' },
                    '&.Mui-disabled': { color: 'var(--t-disabled)', borderColor: 'var(--t-border-soft)' },
                }}
            >
                <RightIcon fontSize="small" />
            </IconButton>
        </Box>
    ) : null;

    const scrollContainer = (
        <Box
            ref={scrollRef}
            sx={{
                ...(isEmbedded
                    ? { padding: 0, backgroundColor: bg }
                    : {
                          display: 'flex',
                          gap: 1.5,
                          padding: 1.5,
                          backgroundColor: bg,
                      }),
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--t-disabled) transparent',
                '&::-webkit-scrollbar': { height: 10 },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'var(--t-disabled)',
                    borderRadius: 999,
                    border: `2px solid ${bg}`,
                },
                '&::-webkit-scrollbar-thumb:hover': { backgroundColor: 'var(--t-text-faint)' },
                '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                ...contentSx,
            }}
        >
            {children}
        </Box>
    );

    if (isEmbedded) {
        return (
            <>
                {topBar}
                {scrollContainer}
            </>
        );
    }

    return (
        <Box
            sx={{
                backgroundColor: 'var(--t-surface)',
                border: '1px solid var(--t-border)',
                borderRadius: '14px',
                overflow: 'hidden',
            }}
        >
            {topBar}
            {scrollContainer}
        </Box>
    );
};

export default BoardHorizontalScroller;
