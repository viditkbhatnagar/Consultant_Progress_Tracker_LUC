import React, { useState } from 'react';
import {
    Box,
    IconButton,
    Menu,
    MenuItem,
    TablePagination,
    Tooltip,
    Typography,
    CircularProgress,
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreHoriz as MoreIcon,
} from '@mui/icons-material';
import MeetingAvatar from './MeetingAvatar';
import ProgramPill from './ProgramPill';
import ModeBadge from './ModeBadge';
import StatusPill from './StatusPill';
import BoardHorizontalScroller from '../shared/BoardHorizontalScroller';
import { ALL_STATUSES, formatDDMMYYYY } from '../../utils/meetingDesign';

const MeetingsTableView = ({
    rows,
    total,
    page,
    pageSize,
    onPageChange,
    loading,
    density,
    isAdmin,
    onOpenDetail,
    onEdit,
    onDelete,
    onStatusChange,
}) => {
    const rowPad = density === 'compact' ? '8px 14px' : '12px 14px';
    const [statusAnchor, setStatusAnchor] = useState(null);
    const [statusRow, setStatusRow] = useState(null);
    const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
    const [rowMenuRow, setRowMenuRow] = useState(null);

    const openStatusMenu = (e, row) => {
        e.stopPropagation();
        setStatusRow(row);
        setStatusAnchor(e.currentTarget);
    };
    const closeStatusMenu = () => {
        setStatusAnchor(null);
        setStatusRow(null);
    };

    const openRowMenu = (e, row) => {
        e.stopPropagation();
        setRowMenuRow(row);
        setRowMenuAnchor(e.currentTarget);
    };
    const closeRowMenu = () => {
        setRowMenuAnchor(null);
        setRowMenuRow(null);
    };

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
                    component="table"
                    sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 12.5,
                        '& th': {
                            textAlign: 'left',
                            padding: '10px 14px',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            color: 'var(--t-text-muted)',
                            backgroundColor: 'var(--t-surface-muted)',
                            borderBottom: '1px solid var(--t-border)',
                            whiteSpace: 'nowrap',
                        },
                        '& td': {
                            padding: rowPad,
                            borderBottom: '1px solid var(--t-border-soft)',
                            verticalAlign: 'middle',
                            fontSize: 12.5,
                            color: 'var(--t-text-2)',
                        },
                        '& tr:last-child td': { borderBottom: 0 },
                        '& tr:hover td': { backgroundColor: 'var(--t-surface-hover)' },
                    }}
                >
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Program</th>
                            <th>Mode</th>
                            <th>Consultant</th>
                            {isAdmin && <th>Team Lead</th>}
                            <th>Status</th>
                            <th>Remarks</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '48px 0' }}>
                                    <CircularProgress size={22} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isAdmin ? 9 : 8}
                                    style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t-text-muted)' }}
                                >
                                    No meetings match your filters.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r._id}>
                                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t-text-3)' }}>
                                        {formatDDMMYYYY(r.meetingDate)}
                                    </td>
                                    <td>
                                        <Box
                                            component="button"
                                            type="button"
                                            onClick={() => onOpenDetail?.(r)}
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 1.25,
                                                background: 'transparent',
                                                border: 0,
                                                padding: 0,
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <MeetingAvatar name={r.studentName} size={26} />
                                            <Typography
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: 12.5,
                                                    color: 'var(--t-text)',
                                                    lineHeight: 1.25,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    maxWidth: 240,
                                                }}
                                            >
                                                {r.studentName}
                                            </Typography>
                                        </Box>
                                    </td>
                                    <td>
                                        <ProgramPill program={r.program} truncate={18} />
                                    </td>
                                    <td>
                                        <ModeBadge mode={r.mode} />
                                    </td>
                                    <td>
                                        <Box
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 0.75,
                                                color: 'var(--t-text)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            <MeetingAvatar name={r.consultantName || r.consultant?.name || '—'} size={20} />
                                            <span>{r.consultantName || r.consultant?.name || '—'}</span>
                                        </Box>
                                    </td>
                                    {isAdmin && (
                                        <td>
                                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'var(--t-text-3)' }}>
                                                <MeetingAvatar name={r.teamLeadName || r.teamLead?.name || '—'} size={20} />
                                                <span>{r.teamLeadName || r.teamLead?.name || '—'}</span>
                                            </Box>
                                        </td>
                                    )}
                                    <td>
                                        <StatusPill status={r.status} onClick={(e) => openStatusMenu(e, r)} />
                                    </td>
                                    <td
                                        style={{
                                            maxWidth: 280,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            color: 'var(--t-text-3)',
                                        }}
                                    >
                                        <Tooltip title={r.remarks || ''} arrow placement="top">
                                            <span>{r.remarks || <span style={{ color: 'var(--t-text-faint)' }}>—</span>}</span>
                                        </Tooltip>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        <Tooltip title="Edit" placement="top" arrow>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => { e.stopPropagation(); onEdit?.(r); }}
                                                sx={{ color: 'var(--t-text-3)', width: 26, height: 26 }}
                                            >
                                                <EditIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        </Tooltip>
                                        {isAdmin && (
                                            <Tooltip title="Delete" placement="top" arrow>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); onDelete?.(r); }}
                                                    sx={{ color: 'var(--t-danger-text)', width: 26, height: 26 }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 15 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        <Tooltip title="More" placement="top" arrow>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => openRowMenu(e, r)}
                                                sx={{ color: 'var(--t-text-3)', width: 26, height: 26 }}
                                            >
                                                <MoreIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Box>
            </BoardHorizontalScroller>
            <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_e, next) => onPageChange(next)}
                rowsPerPage={pageSize}
                rowsPerPageOptions={[pageSize]}
                sx={{
                    borderTop: '1px solid var(--t-border)',
                    '& .MuiTablePagination-toolbar': { fontSize: 12.5, color: 'var(--t-text-3)' },
                }}
            />

            {/* Inline status-change popover */}
            <Menu
                anchorEl={statusAnchor}
                open={Boolean(statusAnchor)}
                onClose={closeStatusMenu}
                PaperProps={{
                    sx: {
                        minWidth: 200,
                        maxHeight: 360,
                        borderRadius: '10px',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                    },
                }}
            >
                <Box sx={{ px: 1.5, pt: 1, pb: 0.5, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t-text-muted)', fontWeight: 600 }}>
                    Change status
                </Box>
                {ALL_STATUSES.map((s) => (
                    <MenuItem
                        key={s}
                        onClick={() => {
                            if (statusRow && s !== statusRow.status) onStatusChange?.(statusRow, s);
                            closeStatusMenu();
                        }}
                        sx={{ py: 0.75 }}
                    >
                        <StatusPill status={s} size="sm" />
                    </MenuItem>
                ))}
            </Menu>

            {/* Row overflow menu */}
            <Menu
                anchorEl={rowMenuAnchor}
                open={Boolean(rowMenuAnchor)}
                onClose={closeRowMenu}
                PaperProps={{
                    sx: {
                        minWidth: 160,
                        borderRadius: '10px',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                    },
                }}
            >
                <MenuItem
                    onClick={() => {
                        if (rowMenuRow) onOpenDetail?.(rowMenuRow);
                        closeRowMenu();
                    }}
                    sx={{ fontSize: 12.5 }}
                >
                    Open details
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (rowMenuRow) onEdit?.(rowMenuRow);
                        closeRowMenu();
                    }}
                    sx={{ fontSize: 12.5 }}
                >
                    Edit meeting
                </MenuItem>
                {isAdmin && (
                    <MenuItem
                        onClick={() => {
                            if (rowMenuRow) onDelete?.(rowMenuRow);
                            closeRowMenu();
                        }}
                        sx={{ fontSize: 12.5, color: 'var(--t-danger-text)' }}
                    >
                        Delete
                    </MenuItem>
                )}
            </Menu>
        </Box>
    );
};

export default MeetingsTableView;
