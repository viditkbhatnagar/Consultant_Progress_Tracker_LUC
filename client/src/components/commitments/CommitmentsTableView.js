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
import MeetingAvatar from '../meetings/MeetingAvatar';
import StatusPill from '../meetings/StatusPill';
import BoardHorizontalScroller from '../shared/BoardHorizontalScroller';
import {
    ALL_LEAD_STAGES,
    formatDDMMYYYY,
    formatWeekOfMonth,
    STATUS_META,
    displayDate,
} from '../../utils/commitmentDesign';

const StatusChip = ({ status }) => {
    if (!status) return <span style={{ color: 'var(--t-text-faint)' }}>—</span>;
    const meta = STATUS_META[status] || { label: status, color: 'var(--t-text-faint)' };
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.25,
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                color: meta.color,
                border: `1px solid ${meta.color}`,
                backgroundColor: 'transparent',
                lineHeight: 1.3,
            }}
        >
            <Box
                component="span"
                sx={{ width: 6, height: 6, borderRadius: 999, backgroundColor: meta.color }}
            />
            {meta.label}
        </Box>
    );
};

const CommitmentsTableView = ({
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
    onStageChange,
}) => {
    const rowPad = density === 'compact' ? '8px 14px' : '12px 14px';
    const [stageAnchor, setStageAnchor] = useState(null);
    const [stageRow, setStageRow] = useState(null);
    const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
    const [rowMenuRow, setRowMenuRow] = useState(null);

    const openStageMenu = (e, row) => {
        e.stopPropagation();
        setStageRow(row);
        setStageAnchor(e.currentTarget);
    };
    const closeStageMenu = () => {
        setStageAnchor(null);
        setStageRow(null);
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
                            <th>Week</th>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Consultant</th>
                            {isAdmin && <th>Team Lead</th>}
                            <th>Commitment</th>
                            <th>Lead Stage</th>
                            <th style={{ textAlign: 'center' }}>Prob.</th>
                            <th style={{ textAlign: 'center' }}>Ach.</th>
                            <th style={{ textAlign: 'center' }}>Meet.</th>
                            <th>Follow-up</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={isAdmin ? 13 : 12} style={{ textAlign: 'center', padding: '48px 0' }}>
                                    <CircularProgress size={22} />
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={isAdmin ? 13 : 12}
                                    style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t-text-muted)' }}
                                >
                                    No commitments match your filters.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const achievement =
                                    r.status === 'achieved' || r.admissionClosed ? 100 : 0;
                                return (
                                    <tr key={r._id}>
                                        <td style={{ color: 'var(--t-text-3)' }}>
                                            {formatWeekOfMonth(r.commitmentDate, r.weekStartDate)}
                                        </td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--t-text-3)' }}>
                                            {formatDDMMYYYY(displayDate(r))}
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
                                                <MeetingAvatar name={r.studentName || '—'} size={26} />
                                                <Typography
                                                    sx={{
                                                        fontWeight: 600,
                                                        fontSize: 12.5,
                                                        color: 'var(--t-text)',
                                                        lineHeight: 1.25,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        maxWidth: 200,
                                                    }}
                                                >
                                                    {r.studentName || 'Unnamed'}
                                                </Typography>
                                            </Box>
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
                                                <MeetingAvatar name={r.consultantName || '—'} size={20} />
                                                <span>{r.consultantName || '—'}</span>
                                            </Box>
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                <Box
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.75,
                                                        color: 'var(--t-text-3)',
                                                    }}
                                                >
                                                    <MeetingAvatar
                                                        name={r.teamLead?.name || r.teamName || '—'}
                                                        size={20}
                                                    />
                                                    <span>{r.teamLead?.name || r.teamName || '—'}</span>
                                                </Box>
                                            </td>
                                        )}
                                        <td
                                            style={{
                                                maxWidth: 260,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                color: 'var(--t-text-3)',
                                            }}
                                        >
                                            <Tooltip title={r.commitmentMade || ''} arrow placement="top">
                                                <span>
                                                    {r.commitmentMade || (
                                                        <span style={{ color: 'var(--t-text-faint)' }}>—</span>
                                                    )}
                                                </span>
                                            </Tooltip>
                                        </td>
                                        <td>
                                            <StatusPill
                                                status={r.leadStage}
                                                onClick={(e) => openStageMenu(e, r)}
                                            />
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'center',
                                                fontVariantNumeric: 'tabular-nums',
                                                color: 'var(--t-text)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {r.conversionProbability ?? 0}%
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'center',
                                                fontVariantNumeric: 'tabular-nums',
                                                color: achievement === 100 ? 'var(--t-success-text)' : 'var(--t-text-faint)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {achievement}%
                                        </td>
                                        <td
                                            style={{
                                                textAlign: 'center',
                                                fontVariantNumeric: 'tabular-nums',
                                                color: 'var(--t-text-3)',
                                            }}
                                        >
                                            {r.meetingsDone || 0}
                                        </td>
                                        <td style={{ color: 'var(--t-text-3)', fontVariantNumeric: 'tabular-nums' }}>
                                            {r.followUpDate ? formatDDMMYYYY(r.followUpDate) : (
                                                <span style={{ color: 'var(--t-text-faint)' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            <StatusChip status={r.status} />
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
                                );
                            })
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

            <Menu
                anchorEl={stageAnchor}
                open={Boolean(stageAnchor)}
                onClose={closeStageMenu}
                PaperProps={{
                    sx: {
                        minWidth: 220,
                        maxHeight: 380,
                        borderRadius: '10px',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                    },
                }}
            >
                <Box
                    sx={{
                        px: 1.5,
                        pt: 1,
                        pb: 0.5,
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--t-text-muted)',
                        fontWeight: 600,
                    }}
                >
                    Change lead stage
                </Box>
                {ALL_LEAD_STAGES.map((s) => (
                    <MenuItem
                        key={s}
                        onClick={() => {
                            if (stageRow && s !== stageRow.leadStage) onStageChange?.(stageRow, s);
                            closeStageMenu();
                        }}
                        sx={{ py: 0.75 }}
                    >
                        <StatusPill status={s} size="sm" />
                    </MenuItem>
                ))}
            </Menu>

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
                    Edit commitment
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

export default CommitmentsTableView;
