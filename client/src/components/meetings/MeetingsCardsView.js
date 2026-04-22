import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import MeetingAvatar from './MeetingAvatar';
import ModeBadge from './ModeBadge';
import StatusPill from './StatusPill';
import BoardHorizontalScroller from '../shared/BoardHorizontalScroller';
import { formatDDMMYYYY, getStatusPalette } from '../../utils/meetingDesign';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const splitDate = (dateLike) => {
    if (!dateLike) return { day: '--', month: '---' };
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return { day: '--', month: '---' };
    return {
        day: String(d.getDate()).padStart(2, '0'),
        month: MONTHS[d.getMonth()],
    };
};

const MeetingCard = ({ row, onOpen }) => {
    const palette = getStatusPalette(row.status);
    const { day, month } = splitDate(row.meetingDate);
    return (
        <Box
            component="button"
            type="button"
            onClick={() => onOpen?.(row)}
            sx={{
                textAlign: 'left',
                position: 'relative',
                backgroundColor: 'var(--t-surface)',
                border: '1px solid var(--t-border)',
                borderRadius: '10px',
                padding: '14px',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'box-shadow 120ms ease, transform 120ms ease',
                display: 'block',
                width: '100%',
                '&:hover': {
                    boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
                    transform: 'translateY(-1px)',
                },
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: palette.dot,
                }}
            />
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    mb: 1.25,
                }}
            >
                <Box>
                    <Typography
                        sx={{
                            fontSize: 22,
                            fontWeight: 650,
                            lineHeight: 1,
                            letterSpacing: '-0.02em',
                            color: 'var(--t-text)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {day}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 10.5,
                            color: 'var(--t-text-faint)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            mt: 0.25,
                        }}
                    >
                        {month}
                    </Typography>
                </Box>
                <StatusPill status={row.status} size="sm" />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', my: 1 }}>
                <MeetingAvatar name={row.studentName} size={40} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                        sx={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: 'var(--t-text)',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {row.studentName}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 11.5,
                            color: 'var(--t-text-faint)',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {row.program || '—'}
                    </Typography>
                </Box>
            </Box>
            <Box
                sx={{
                    fontSize: 11.5,
                    color: 'var(--t-text-3)',
                    padding: '8px 0 12px',
                    borderBottom: '1px solid var(--t-border)',
                    minHeight: 30,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                }}
            >
                {row.remarks || <Box component="span" sx={{ color: 'var(--t-text-faint)' }}>No remarks yet</Box>}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.25 }}>
                <ModeBadge mode={row.mode} dense />
                <Box sx={{ display: 'inline-flex' }}>
                    <MeetingAvatar
                        name={row.consultantName || '—'}
                        size={22}
                        sx={{ boxShadow: '0 0 0 1.5px var(--t-surface)' }}
                    />
                    <MeetingAvatar
                        name={row.teamLeadName || '—'}
                        size={22}
                        sx={{ marginLeft: '-6px', boxShadow: '0 0 0 1.5px var(--t-surface)' }}
                    />
                </Box>
            </Box>
            {/* Secondary row: footer line like "Date · Day" matching mock */}
            <Typography
                sx={{
                    mt: 1,
                    fontSize: 10.5,
                    color: 'var(--t-text-faint)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {formatDDMMYYYY(row.meetingDate)}
            </Typography>
        </Box>
    );
};

const MeetingsCardsView = ({ rows, loading, onOpen }) => {
    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 360,
                    backgroundColor: 'var(--t-surface)',
                    border: '1px solid var(--t-border)',
                    borderRadius: '14px',
                }}
            >
                <CircularProgress size={24} />
            </Box>
        );
    }
    if (rows.length === 0) {
        return (
            <Box
                sx={{
                    backgroundColor: 'var(--t-surface)',
                    border: '1px solid var(--t-border)',
                    borderRadius: '14px',
                    py: 6,
                    textAlign: 'center',
                    color: 'var(--t-text-faint)',
                }}
            >
                No meetings match your filters.
            </Box>
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
            <BoardHorizontalScroller variant="embedded">
                <Box
                    sx={{
                        backgroundColor: 'var(--t-surface-muted)',
                        padding: 1.5,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 1.5,
                    }}
                >
                    {rows.map((r) => (
                        <MeetingCard key={r._id} row={r} onOpen={onOpen} />
                    ))}
                </Box>
            </BoardHorizontalScroller>
        </Box>
    );
};

export default MeetingsCardsView;
