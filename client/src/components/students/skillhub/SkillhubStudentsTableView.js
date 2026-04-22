import React, { useState, useRef } from 'react';
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
    Menu,
    MenuItem,
} from '@mui/material';
import TableScrollArrows from '../TableScrollArrows';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    SwapHoriz as SwapIcon,
    MoreVert as MoreIcon,
} from '@mui/icons-material';
import { SKILLHUB_STATUS_META } from '../../../utils/studentDesign';

const headerCell = {
    fontWeight: 700,
    backgroundColor: 'var(--t-surface-elev)',
    color: 'var(--t-text)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--t-border)',
    fontSize: 11,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    padding: '10px 12px',
};

const bodyCell = {
    color: 'var(--t-text-2)',
    borderBottom: '1px solid var(--t-border-soft)',
    fontSize: 13,
    padding: '8px 12px',
};

const SkillhubStudentsTableView = ({
    students,
    loading,
    page,
    limit,
    total,
    onPageChange,
    onRowClick,
    onEdit,
    onDelete,
    onMove,
    canEdit = true,
    canDelete = true,
    canMove = true,
}) => {
    const [moveAnchor, setMoveAnchor] = useState(null);
    const [moving, setMoving] = useState(null);
    const scrollRef = useRef(null);
    const openMove = (e, s) => {
        e.stopPropagation();
        setMoving(s);
        setMoveAnchor(e.currentTarget);
    };
    const closeMove = () => {
        setMoveAnchor(null);
        setMoving(null);
    };

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
                <Typography sx={{ color: 'var(--t-text-3)' }}>
                    No students in this tab yet.
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
                            <TableCell sx={headerCell}>Enrollment #</TableCell>
                            <TableCell sx={headerCell}>Name</TableCell>
                            <TableCell sx={headerCell}>Curriculum</TableCell>
                            <TableCell sx={headerCell}>Year/Grade</TableCell>
                            <TableCell sx={headerCell}>Acad. Year</TableCell>
                            <TableCell sx={headerCell}>Counselor</TableCell>
                            <TableCell sx={headerCell}>Mode</TableCell>
                            <TableCell sx={headerCell}>Enrolled</TableCell>
                            <TableCell sx={{ ...headerCell, textAlign: 'right' }}>Course Fee</TableCell>
                            <TableCell sx={{ ...headerCell, textAlign: 'right' }}>Outstanding</TableCell>
                            <TableCell sx={headerCell}>Status</TableCell>
                            <TableCell
                                sx={{
                                    ...headerCell,
                                    textAlign: 'center',
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
                        {students.map((s, idx) => {
                            const altBg =
                                idx % 2 === 0 ? 'var(--t-surface)' : 'var(--t-surface-hover)';
                            const status = SKILLHUB_STATUS_META[s.studentStatus] || {
                                lbl: s.studentStatus || '—',
                                color: 'var(--t-text-3)',
                                bg: 'var(--t-surface-muted)',
                            };
                            return (
                                <TableRow
                                    key={s._id}
                                    hover
                                    onClick={(e) => {
                                        if (e.target.closest('[data-action]')) return;
                                        onRowClick?.(s);
                                    }}
                                    sx={{
                                        backgroundColor: altBg,
                                        cursor: onRowClick ? 'pointer' : 'default',
                                    }}
                                >
                                    <TableCell sx={{ ...bodyCell, fontFamily: 'monospace' }}>
                                        {s.enrollmentNumber || '-'}
                                    </TableCell>
                                    <TableCell sx={bodyCell}>
                                        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: 'var(--t-text)' }}>
                                            {s.studentName}
                                        </Typography>
                                        {s.school && (
                                            <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                                                {s.school}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell sx={bodyCell}>
                                        <Chip
                                            label={s.curriculum || '—'}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                fontSize: 11,
                                                color: 'var(--t-text-3)',
                                                borderColor: 'var(--t-border)',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={bodyCell}>{s.yearOrGrade || '—'}</TableCell>
                                    <TableCell sx={bodyCell}>{s.academicYear || '—'}</TableCell>
                                    <TableCell sx={bodyCell}>{s.consultantName || '—'}</TableCell>
                                    <TableCell sx={bodyCell}>{s.mode || '—'}</TableCell>
                                    <TableCell sx={bodyCell}>
                                        {s.dateOfEnrollment
                                            ? new Date(s.dateOfEnrollment).toLocaleDateString([], {
                                                  year: '2-digit',
                                                  month: 'short',
                                                  day: 'numeric',
                                              })
                                            : '—'}
                                    </TableCell>
                                    <TableCell sx={{ ...bodyCell, textAlign: 'right', fontWeight: 600 }}>
                                        {(s.courseFee || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell
                                        sx={{
                                            ...bodyCell,
                                            textAlign: 'right',
                                            fontWeight: 600,
                                            color:
                                                (s.outstandingAmount ?? 0) > 0
                                                    ? '#BE185D'
                                                    : 'var(--t-text-faint)',
                                        }}
                                    >
                                        {(s.outstandingAmount ?? 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={bodyCell}>
                                        <Chip
                                            label={status.lbl}
                                            size="small"
                                            sx={{
                                                fontSize: 10.5,
                                                fontWeight: 600,
                                                backgroundColor: status.bg,
                                                color: status.color,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell
                                        data-action
                                        sx={{
                                            ...bodyCell,
                                            textAlign: 'center',
                                            position: 'sticky',
                                            right: 0,
                                            backgroundColor: altBg,
                                            borderLeft: '1px solid var(--t-border-soft)',
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                            {canMove && (
                                                <Tooltip title="Move to…">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => openMove(e, s)}
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
                    '& .MuiTablePagination-toolbar': { minHeight: 44 },
                    '& .MuiSelect-icon': { color: 'var(--t-text-3)' },
                }}
            />

            <Menu
                anchorEl={moveAnchor}
                open={Boolean(moveAnchor)}
                onClose={closeMove}
                PaperProps={{
                    sx: {
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        border: '1px solid var(--t-border)',
                        boxShadow: 'var(--t-shadow-elev)',
                    },
                }}
            >
                {['new_admission', 'active', 'inactive']
                    .filter((s) => s !== moving?.studentStatus)
                    .map((s) => (
                        <MenuItem
                            key={s}
                            onClick={() => {
                                const target = moving;
                                closeMove();
                                onMove?.(target, s);
                            }}
                            sx={{ fontSize: 12.5 }}
                        >
                            Move to {SKILLHUB_STATUS_META[s].lbl}
                        </MenuItem>
                    ))}
            </Menu>
        </Paper>
    );
};

export default SkillhubStudentsTableView;
