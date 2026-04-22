import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import {
    UNIVERSITY_PALETTE,
    SOURCE_PALETTE,
    shortUniversity,
    conversionColor,
} from '../../utils/studentDesign';

const Row = ({ label, value, mono = false }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.35 }}>
        <Typography
            sx={{
                fontSize: 11,
                color: 'var(--t-text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '.03em',
            }}
        >
            {label}
        </Typography>
        <Typography
            sx={{
                fontSize: 12.5,
                color: 'var(--t-text-2)',
                fontWeight: 500,
                fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
                textAlign: 'right',
            }}
        >
            {value}
        </Typography>
    </Box>
);

const LucStudentsCardsView = ({
    students,
    loading,
    onRowClick,
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
}) => {
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (students.length === 0) {
        return (
            <Box
                sx={{
                    textAlign: 'center',
                    py: 6,
                    color: 'var(--t-text-muted)',
                    backgroundColor: 'var(--t-surface)',
                    border: '1px solid var(--t-border)',
                    borderRadius: '12px',
                }}
            >
                <Typography variant="body1" sx={{ color: 'var(--t-text-3)' }}>
                    No students found
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 1.5,
            }}
        >
            {students.map((s) => {
                const uniColor = UNIVERSITY_PALETTE[s.university] || '#64748B';
                const srcColor = SOURCE_PALETTE[s.source] || 'var(--t-text-3)';
                const convColor = conversionColor(s.conversionTime);
                return (
                    <Box
                        key={s._id}
                        onClick={() => onRowClick?.(s)}
                        sx={{
                            p: 2,
                            borderRadius: '12px',
                            backgroundColor: 'var(--t-surface)',
                            border: '1px solid var(--t-border)',
                            boxShadow: 'var(--t-shadow-card-sm)',
                            cursor: onRowClick ? 'pointer' : 'default',
                            transition: 'transform 120ms ease, box-shadow 120ms ease',
                            '&:hover': onRowClick
                                ? {
                                      transform: 'translateY(-2px)',
                                      boxShadow: 'var(--t-shadow-card)',
                                  }
                                : undefined,
                            position: 'relative',
                        }}
                    >
                        {/* Header */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                                pb: 1,
                                mb: 1,
                                borderBottom: '1px dashed var(--t-border)',
                            }}
                        >
                            <Box
                                sx={{
                                    width: 38,
                                    height: 38,
                                    flexShrink: 0,
                                    borderRadius: '10px',
                                    backgroundColor: `${uniColor}20`,
                                    color: uniColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 15,
                                    fontFamily: '"JetBrains Mono", monospace',
                                }}
                            >
                                {(s.studentName || '?').slice(0, 1).toUpperCase()}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--t-text)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {s.studentName}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: 11,
                                        color: 'var(--t-text-muted)',
                                        fontFamily: '"JetBrains Mono", monospace',
                                    }}
                                >
                                    #{s.sno} · {s.month}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {canEdit && (
                                    <Tooltip title="Edit">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit?.(s);
                                            }}
                                            sx={{ color: 'var(--t-accent-text)' }}
                                        >
                                            <EditIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {canDelete && (
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete?.(s);
                                            }}
                                            sx={{ color: 'var(--t-danger-text)' }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>

                        {/* Chips row */}
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                            {s.university && (
                                <Tooltip title={s.university}>
                                    <Chip
                                        label={shortUniversity(s.university)}
                                        size="small"
                                        sx={{
                                            fontSize: 10.5,
                                            height: 22,
                                            backgroundColor: `${uniColor}20`,
                                            color: uniColor,
                                            fontWeight: 600,
                                        }}
                                    />
                                </Tooltip>
                            )}
                            {s.source && (
                                <Chip
                                    label={s.source}
                                    size="small"
                                    sx={{
                                        fontSize: 10.5,
                                        height: 22,
                                        backgroundColor: `${srcColor}20`,
                                        color: srcColor,
                                        fontWeight: 600,
                                    }}
                                />
                            )}
                            {s.conversionTime != null && (
                                <Chip
                                    label={`${s.conversionTime}d`}
                                    size="small"
                                    sx={{
                                        fontSize: 10.5,
                                        height: 22,
                                        backgroundColor: `${convColor}20`,
                                        color: convColor,
                                        fontWeight: 600,
                                    }}
                                />
                            )}
                        </Box>

                        <Row label="Program" value={s.program || '—'} />
                        <Row
                            label="Course Fee"
                            value={<span style={{ color: '#16A34A' }}>AED {(s.courseFee || 0).toLocaleString()}</span>}
                        />
                        <Row label="Consultant" value={s.consultantName || '—'} />
                        <Row label="Team" value={s.teamLeadName || s.teamName || '—'} />
                        <Row
                            label="Closing"
                            value={s.closingDate ? format(new Date(s.closingDate), 'MMM d, yyyy') : '—'}
                        />
                    </Box>
                );
            })}
        </Box>
    );
};

export default LucStudentsCardsView;
