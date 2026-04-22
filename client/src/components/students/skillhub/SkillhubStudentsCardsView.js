import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    SwapHoriz as SwapIcon,
} from '@mui/icons-material';
import { SKILLHUB_STATUS_META } from '../../../utils/studentDesign';

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

const SkillhubStudentsCardsView = ({
    students,
    loading,
    onRowClick,
    onEdit,
    onDelete,
    onMove,
    canEdit = true,
    canDelete = true,
    canMove = true,
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
                <Typography sx={{ color: 'var(--t-text-3)' }}>No students in this tab yet.</Typography>
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
                const status = SKILLHUB_STATUS_META[s.studentStatus] || {
                    lbl: s.studentStatus || '—',
                    color: 'var(--t-text-3)',
                    bg: 'var(--t-surface-muted)',
                };
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
                                ? { transform: 'translateY(-2px)', boxShadow: 'var(--t-shadow-card)' }
                                : undefined,
                        }}
                    >
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
                                    backgroundColor: status.bg,
                                    color: status.color,
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
                                    {s.enrollmentNumber || '—'}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {canMove && (
                                    <Tooltip title="Move to…">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onMove?.(e, s);
                                            }}
                                            sx={{ color: 'var(--t-accent-text)' }}
                                        >
                                            <SwapIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
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

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                            <Chip
                                label={status.lbl}
                                size="small"
                                sx={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    backgroundColor: status.bg,
                                    color: status.color,
                                    height: 22,
                                }}
                            />
                            {s.curriculum && (
                                <Chip
                                    label={s.curriculum}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontSize: 10.5,
                                        height: 22,
                                        color: 'var(--t-text-3)',
                                        borderColor: 'var(--t-border)',
                                    }}
                                />
                            )}
                            {s.yearOrGrade && (
                                <Chip
                                    label={s.yearOrGrade}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontSize: 10.5,
                                        height: 22,
                                        color: 'var(--t-text-3)',
                                        borderColor: 'var(--t-border)',
                                    }}
                                />
                            )}
                            {s.mode && (
                                <Chip
                                    label={s.mode}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontSize: 10.5,
                                        height: 22,
                                        color: 'var(--t-text-3)',
                                        borderColor: 'var(--t-border)',
                                    }}
                                />
                            )}
                        </Box>

                        <Row label="Counselor" value={s.consultantName || '—'} />
                        <Row label="Acad. Year" value={s.academicYear || '—'} />
                        <Row
                            label="Course Fee"
                            value={<span style={{ color: '#16A34A', fontWeight: 700 }}>AED {(s.courseFee || 0).toLocaleString()}</span>}
                        />
                        <Row
                            label="Outstanding"
                            value={
                                <span
                                    style={{
                                        color: (s.outstandingAmount ?? 0) > 0 ? '#BE185D' : 'var(--t-text-faint)',
                                        fontWeight: 700,
                                    }}
                                >
                                    AED {(s.outstandingAmount ?? 0).toLocaleString()}
                                </span>
                            }
                        />
                    </Box>
                );
            })}
        </Box>
    );
};

export default SkillhubStudentsCardsView;
