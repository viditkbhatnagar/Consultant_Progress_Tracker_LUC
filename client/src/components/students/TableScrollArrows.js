import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, TextField, Typography, Button } from '@mui/material';
import {
    ChevronLeft as LeftIcon,
    ChevronRight as RightIcon,
} from '@mui/icons-material';

const SCROLL_STEP = 320;

// Top bar above the table:
//   [< chevron]  [progress track]  [> chevron]  |  Page [input] / total
// The page-jump input accepts a number 1..totalPages and commits on Enter
// or blur. Chevrons + track drive horizontal scroll on the external ref.
// The whole bar always renders when page-jump is active; arrow controls
// disable themselves when there's no horizontal overflow.
const TableScrollArrows = ({
    scrollRef,
    page,
    totalPages,
    onPageChange,
    hideWhenNoOverflow = true,
}) => {
    const trackRef = useRef(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);
    const [thumb, setThumb] = useState({ left: 0, width: 1 });

    const hasPageJump =
        typeof page === 'number' &&
        typeof totalPages === 'number' &&
        typeof onPageChange === 'function';

    const [jumpValue, setJumpValue] = useState(String(page ?? 1));

    useEffect(() => {
        setJumpValue(String(page ?? 1));
    }, [page]);

    const update = useCallback(() => {
        const el = scrollRef?.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 1);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        const ratio = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1;
        const width = Math.max(Math.min(ratio, 1), 0.08);
        const pos =
            el.scrollWidth - el.clientWidth > 0
                ? el.scrollLeft / (el.scrollWidth - el.clientWidth)
                : 0;
        setThumb({ left: pos * (1 - width), width });
    }, [scrollRef]);

    useEffect(() => {
        update();
        const el = scrollRef?.current;
        if (!el) return () => {};
        const onScroll = () => update();
        el.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', update);
        const id = setTimeout(update, 50);
        return () => {
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', update);
            clearTimeout(id);
        };
    }, [scrollRef, update]);

    const nudge = (dir) => {
        const el = scrollRef?.current;
        if (!el) return;
        el.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' });
    };

    const onTrackClick = (e) => {
        const track = trackRef.current;
        const el = scrollRef?.current;
        if (!track || !el) return;
        const rect = track.getBoundingClientRect();
        const clickedRatio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width)
        );
        const maxScroll = el.scrollWidth - el.clientWidth;
        el.scrollTo({ left: clickedRatio * maxScroll, behavior: 'smooth' });
    };

    const commitJump = () => {
        if (!hasPageJump) return;
        const n = parseInt(jumpValue, 10);
        if (Number.isNaN(n)) {
            setJumpValue(String(page));
            return;
        }
        const clamped = Math.max(1, Math.min(totalPages || 1, n));
        if (clamped !== page) onPageChange(clamped);
        setJumpValue(String(clamped));
    };

    const hasOverflow = canLeft || canRight;
    // Hide rule: only when there's no overflow AND no page-jump UI to show.
    if (hideWhenNoOverflow && !hasOverflow && !hasPageJump) return null;

    return (
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
                    boxShadow: 'var(--t-shadow-card-sm)',
                    '&:hover': {
                        backgroundColor: 'var(--t-surface-muted)',
                        color: 'var(--t-text)',
                    },
                    '&.Mui-disabled': {
                        color: 'var(--t-disabled)',
                        borderColor: 'var(--t-border-soft)',
                    },
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
                    cursor: hasOverflow ? 'pointer' : 'default',
                    overflow: 'hidden',
                    transition: 'background-color 120ms ease',
                    '&:hover': hasOverflow
                        ? { backgroundColor: 'var(--t-track-bg-hover)' }
                        : undefined,
                    opacity: hasOverflow ? 1 : 0.5,
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
                    boxShadow: 'var(--t-shadow-card-sm)',
                    '&:hover': {
                        backgroundColor: 'var(--t-surface-muted)',
                        color: 'var(--t-text)',
                    },
                    '&.Mui-disabled': {
                        color: 'var(--t-disabled)',
                        borderColor: 'var(--t-border-soft)',
                    },
                }}
            >
                <RightIcon fontSize="small" />
            </IconButton>

            {hasPageJump && (
                <>
                    <Box
                        sx={{
                            width: '1px',
                            height: 22,
                            backgroundColor: 'var(--t-border)',
                            mx: 0.5,
                        }}
                    />
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: 'var(--t-text-3)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Go to page:
                    </Typography>
                    <TextField
                        size="small"
                        placeholder={String(page)}
                        value={jumpValue}
                        onChange={(e) =>
                            setJumpValue(e.target.value.replace(/[^\d]/g, ''))
                        }
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                commitJump();
                                e.target.blur();
                            }
                        }}
                        inputProps={{
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                            style: { textAlign: 'center', padding: '5px 6px' },
                            'aria-label': 'Jump to page',
                            min: 1,
                            max: totalPages,
                        }}
                        sx={{
                            width: 64,
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'var(--t-surface)',
                                fontSize: 13,
                                fontWeight: 700,
                                fontFamily: '"JetBrains Mono", monospace',
                                color: 'var(--t-text)',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'var(--t-accent-border)',
                                borderWidth: 1.5,
                            },
                            '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'var(--t-accent)',
                            },
                        }}
                    />
                    <Button
                        onClick={commitJump}
                        variant="contained"
                        size="small"
                        disabled={
                            !jumpValue || parseInt(jumpValue, 10) === page
                        }
                        sx={{
                            minWidth: 48,
                            px: 1.25,
                            height: 30,
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: 'none',
                            boxShadow: 'none',
                            borderRadius: '8px',
                        }}
                    >
                        Go
                    </Button>
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: 'var(--t-text-muted)',
                            whiteSpace: 'nowrap',
                            fontFamily: '"JetBrains Mono", monospace',
                            ml: 0.5,
                        }}
                    >
                        of {totalPages || 1}
                    </Typography>
                </>
            )}
        </Box>
    );
};

export default TableScrollArrows;
