import React, { useRef } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    IconButton,
    Chip,
    Tooltip,
    Typography,
    CircularProgress,
} from '@mui/material';
import TableScrollArrows from './TableScrollArrows';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
    LUC_COLUMNS,
    UNIVERSITY_PALETTE,
    shortUniversity,
    conversionColor,
    SOURCE_PALETTE,
} from '../../utils/studentDesign';

const headerCell = (col, idx) => ({
    fontWeight: 700,
    backgroundColor: 'var(--t-surface-elev)',
    color: 'var(--t-text)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--t-border)',
    fontSize: 11,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    minWidth: col.width,
    padding: '10px 12px',
    textAlign: col.align || 'left',
});

const renderCell = (col, student, row, onRowClick) => {
    const raw = student[col.key];
    if (col.key === 'sno') {
        return (
            <span style={{ fontWeight: 600, color: 'var(--t-text-3)' }}>
                {row + 1}
            </span>
        );
    }
    if (col.primary) {
        return (
            <Typography
                sx={{
                    fontWeight: 600,
                    color: 'var(--t-text)',
                    fontFamily: '"Inter", sans-serif',
                    fontSize: 13.5,
                }}
            >
                {raw || '—'}
            </Typography>
        );
    }
    if (col.key === 'gender') {
        return raw ? (
            <Chip
                label={raw}
                size="small"
                variant="outlined"
                sx={{
                    fontSize: 11,
                    color: raw === 'Male' ? '#2563EB' : '#BE185D',
                    borderColor: raw === 'Male' ? '#2563EB' : '#BE185D',
                }}
            />
        ) : (
            '—'
        );
    }
    if (col.key === 'university') {
        if (!raw) return '—';
        const color = UNIVERSITY_PALETTE[raw] || '#64748B';
        return (
            <Tooltip title={raw}>
                <Chip
                    label={shortUniversity(raw)}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 11, color, borderColor: color }}
                />
            </Tooltip>
        );
    }
    if (col.key === 'source') {
        if (!raw) return '—';
        const color = SOURCE_PALETTE[raw] || 'var(--t-text-3)';
        return (
            <Chip
                label={raw}
                size="small"
                sx={{
                    fontSize: 11,
                    backgroundColor: `${color}20`,
                    color,
                    fontWeight: 600,
                }}
            />
        );
    }
    if (col.money) {
        return (
            <span style={{ fontWeight: 600, color: col.key === 'courseFee' ? '#16A34A' : '#2563EB' }}>
                AED {(raw || 0).toLocaleString()}
            </span>
        );
    }
    if (col.date) {
        return raw ? format(new Date(raw), 'dd/MM/yyyy') : '—';
    }
    if (col.conversionPill) {
        const days = raw;
        if (days == null) return '—';
        return (
            <Chip
                label={`${days}d`}
                size="small"
                sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: `${conversionColor(days)}20`,
                    color: conversionColor(days),
                }}
            />
        );
    }
    if (col.suffix && raw != null && raw !== '') {
        return `${raw}${col.suffix}`;
    }
    if (col.truncate) {
        return (
            <Tooltip title={raw || ''}>
                <Typography noWrap sx={{ maxWidth: col.truncate, fontSize: 13 }}>
                    {raw || '—'}
                </Typography>
            </Tooltip>
        );
    }
    return raw == null || raw === '' ? '—' : raw;
};

const LucStudentsTableView = ({
    students,
    loading,
    page,
    limit,
    total,
    onPageChange,
    onRowClick,
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
    emptyMessage = 'No students found',
}) => {
    const scrollRef = useRef(null);

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
                <Typography variant="body1" sx={{ mb: 0.5, color: 'var(--t-text-3)' }}>
                    {emptyMessage}
                </Typography>
                <Typography variant="caption">
                    Try adjusting your filters.
                </Typography>
            </Box>
        );
    }

    return (
        <Paper
            sx={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: '12px',
                backgroundColor: 'var(--t-surface)',
                border: '1px solid var(--t-border)',
                boxShadow: 'var(--t-shadow-card-sm)',
            }}
        >
            <TableScrollArrows
                scrollRef={scrollRef}
                page={page}
                totalPages={Math.max(1, Math.ceil((total || 0) / limit))}
                onPageChange={onPageChange}
            />
            <TableContainer
                ref={scrollRef}
                sx={{
                    maxHeight: 'calc(100vh - 300px)',
                    minHeight: 420,
                    '&::-webkit-scrollbar': { height: 10, width: 10 },
                    '&::-webkit-scrollbar-track': { backgroundColor: 'var(--t-track-bg)' },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'var(--t-scrollbar-thumb)',
                        borderRadius: 10,
                    },
                }}
            >
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {LUC_COLUMNS.map((col, i) => (
                                <TableCell key={col.key} sx={headerCell(col, i)}>
                                    {col.lbl}
                                </TableCell>
                            ))}
                            <TableCell
                                sx={{
                                    ...headerCell({ align: 'center' }, -1),
                                    minWidth: 110,
                                    position: 'sticky',
                                    right: 0,
                                    zIndex: 3,
                                }}
                            >
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {students.map((student, idx) => {
                            const altBg =
                                idx % 2 === 0
                                    ? 'var(--t-surface)'
                                    : 'var(--t-surface-hover)';
                            return (
                                <TableRow
                                    key={student._id}
                                    hover
                                    onClick={(e) => {
                                        // Don't fire rowClick when the user tapped an action icon
                                        if (e.target.closest('[data-action]')) return;
                                        onRowClick?.(student);
                                    }}
                                    sx={{
                                        backgroundColor: altBg,
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        '&:hover': {
                                            backgroundColor: 'var(--t-surface-hover)',
                                        },
                                    }}
                                >
                                    {LUC_COLUMNS.map((col) => (
                                        <TableCell
                                            key={col.key}
                                            align={col.align || 'left'}
                                            sx={{
                                                color: 'var(--t-text-2)',
                                                borderBottom: '1px solid var(--t-border-soft)',
                                                fontSize: 13,
                                                padding: '8px 12px',
                                            }}
                                        >
                                            {renderCell(col, student, idx + (page - 1) * limit, onRowClick)}
                                        </TableCell>
                                    ))}
                                    <TableCell
                                        align="center"
                                        data-action
                                        sx={{
                                            position: 'sticky',
                                            right: 0,
                                            backgroundColor: altBg,
                                            borderLeft: '1px solid var(--t-border-soft)',
                                            borderBottom: '1px solid var(--t-border-soft)',
                                            padding: '4px 8px',
                                        }}
                                    >
                                        {!canEdit && !canDelete ? (
                                            <Typography variant="caption" color="var(--t-text-muted)">
                                                View only
                                            </Typography>
                                        ) : (
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                {canEdit && (
                                                    <Tooltip title="Edit">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEdit?.(student);
                                                            }}
                                                            sx={{ color: 'var(--t-accent-text)' }}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                {canDelete && (
                                                    <Tooltip title="Delete">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDelete?.(student);
                                                            }}
                                                            sx={{ color: 'var(--t-danger-text)' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={total}
                page={page - 1}
                onPageChange={(_e, p) => onPageChange(p + 1)}
                rowsPerPage={limit}
                rowsPerPageOptions={[limit]}
                labelDisplayedRows={({ from, to, count }) => {
                    const totalPages = Math.max(1, Math.ceil(count / limit));
                    return `Page ${page} of ${totalPages} · ${from}–${to} of ${count}`;
                }}
                sx={{
                    borderTop: '1px solid var(--t-border)',
                    color: 'var(--t-text-3)',
                    '& .MuiTablePagination-toolbar': {
                        minHeight: 44,
                    },
                    '& .MuiSelect-icon': { color: 'var(--t-text-3)' },
                    '& .MuiIconButton-root.Mui-disabled': {
                        color: 'var(--t-disabled)',
                    },
                }}
            />
        </Paper>
    );
};

export default LucStudentsTableView;
