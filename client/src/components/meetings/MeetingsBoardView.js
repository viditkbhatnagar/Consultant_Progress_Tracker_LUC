import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import MeetingAvatar from './MeetingAvatar';
import ModeBadge from './ModeBadge';
import { BOARD_STATUS_ORDER, formatDDMMYYYY, getStatusPalette } from '../../utils/meetingDesign';
import BoardHorizontalScroller from '../shared/BoardHorizontalScroller';

const BoardCard = ({ row, onOpen }) => (
    <Box
        component="button"
        type="button"
        onClick={() => onOpen?.(row)}
        sx={{
            textAlign: 'left',
            border: '1px solid var(--t-border)',
            backgroundColor: 'var(--t-surface-elev)',
            borderRadius: '10px',
            padding: '10px',
            cursor: 'pointer',
            transition: 'box-shadow 120ms ease, background-color 120ms ease',
            display: 'block',
            width: '100%',
            '&:hover': {
                backgroundColor: 'var(--t-surface)',
                boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
            },
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
            <MeetingAvatar name={row.studentName} size={28} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    sx={{
                        fontSize: 12.5,
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
                        fontSize: 11,
                        color: 'var(--t-text-faint)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {row.program || '—'} · {formatDDMMYYYY(row.meetingDate)}
                </Typography>
            </Box>
        </Box>
        {row.remarks && (
            <Typography
                sx={{
                    fontSize: 11.5,
                    color: 'var(--t-text-3)',
                    my: 0.75,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                }}
            >
                {row.remarks}
            </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            <ModeBadge mode={row.mode} dense />
            <Box sx={{ display: 'inline-flex' }}>
                <MeetingAvatar
                    name={row.consultantName || '—'}
                    size={20}
                    sx={{ boxShadow: '0 0 0 1.5px var(--t-surface)' }}
                />
                <MeetingAvatar
                    name={row.teamLeadName || '—'}
                    size={20}
                    sx={{ marginLeft: '-6px', boxShadow: '0 0 0 1.5px var(--t-surface)' }}
                />
            </Box>
        </Box>
    </Box>
);

const MeetingsBoardView = ({ rows, loading, onOpen }) => {
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

    return (
        <BoardHorizontalScroller>
            {BOARD_STATUS_ORDER.map((status) => {
                const items = rows.filter((r) => r.status === status);
                const palette = getStatusPalette(status);
                return (
                    <Box
                        key={status}
                        sx={{
                            flex: '0 0 280px',
                            minWidth: 280,
                            backgroundColor: 'var(--t-surface)',
                            border: '1px solid var(--t-border)',
                            borderRadius: '10px',
                            minHeight: 360,
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--t-border)',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 999,
                                        backgroundColor: palette.dot,
                                    }}
                                />
                                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'var(--t-text)' }}>
                                    {status}
                                </Typography>
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    color: 'var(--t-text-muted)',
                                    backgroundColor: 'var(--t-surface-muted)',
                                    px: 0.75,
                                    py: 0.125,
                                    borderRadius: 999,
                                    fontVariantNumeric: 'tabular-nums',
                                    minWidth: 22,
                                    textAlign: 'center',
                                }}
                            >
                                {items.length}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                padding: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                flex: 1,
                            }}
                        >
                            {items.map((r) => (
                                <BoardCard key={r._id} row={r} onOpen={onOpen} />
                            ))}
                            {items.length === 0 && (
                                <Box
                                    sx={{
                                        textAlign: 'center',
                                        color: 'var(--t-text-faint)',
                                        fontSize: 11,
                                        py: 2.5,
                                        border: '1px dashed var(--t-border)',
                                        borderRadius: '8px',
                                    }}
                                >
                                    No meetings here yet
                                </Box>
                            )}
                        </Box>
                    </Box>
                );
            })}
        </BoardHorizontalScroller>
    );
};

export default MeetingsBoardView;
