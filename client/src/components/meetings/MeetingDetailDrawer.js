import React, { useEffect, useState } from 'react';
import {
    Drawer,
    Box,
    IconButton,
    Typography,
    Button,
    TextField,
    MenuItem,
    Menu,
    Divider,
    Snackbar,
    Alert,
} from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import MeetingAvatar from './MeetingAvatar';
import ProgramPill from './ProgramPill';
import ModeBadge from './ModeBadge';
import StatusPill from './StatusPill';
import {
    ALL_STATUSES,
    formatDDMMYYYY,
    shortId,
} from '../../utils/meetingDesign';

const FieldTile = ({ label, children }) => (
    <Box
        sx={{
            backgroundColor: 'var(--t-surface-muted)',
            border: '1px solid var(--t-border)',
            borderRadius: '10px',
            padding: '10px 12px',
        }}
    >
        <Typography
            sx={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--t-text-muted)',
                fontWeight: 600,
                mb: 0.75,
            }}
        >
            {label}
        </Typography>
        <Box sx={{ color: 'var(--t-text-2)' }}>{children}</Box>
    </Box>
);

const SectionTitle = ({ children }) => (
    <Typography
        sx={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--t-text-muted)',
            fontWeight: 600,
            mb: 1,
        }}
    >
        {children}
    </Typography>
);

const MeetingDetailDrawer = ({
    open,
    row,
    onClose,
    onSave,
    onEdit,
    onDelete,
    isAdmin,
}) => {
    const [remarks, setRemarks] = useState('');
    const [status, setStatus] = useState('');
    const [statusAnchor, setStatusAnchor] = useState(null);
    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        if (row) {
            setRemarks(row.remarks || '');
            setStatus(row.status || '');
        }
    }, [row]);

    if (!row) return null;

    const dirty = remarks !== (row.remarks || '') || status !== row.status;

    const handleSave = async () => {
        if (!dirty) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            await onSave?.(row, { remarks, status });
            setSnack({ open: true, message: 'Meeting updated', severity: 'success' });
            onClose();
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || err?.message || 'Failed to save',
                severity: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 480 },
                        backgroundColor: 'var(--t-surface-elev)',
                    },
                }}
            >
                {/* Head */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1.75,
                        py: 1.25,
                        borderBottom: '1px solid var(--t-border)',
                    }}
                >
                    <IconButton onClick={onClose} size="small" sx={{ color: 'var(--t-text-3)' }}>
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                            onClick={() => onEdit?.(row)}
                            size="small"
                            sx={{ color: 'var(--t-text-3)' }}
                        >
                            <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                </Box>

                {/* Body */}
                <Box sx={{ flex: 1, overflow: 'auto', padding: '18px 22px 24px' }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr auto',
                            gap: 1.5,
                            alignItems: 'center',
                            mb: 2.5,
                        }}
                    >
                        <MeetingAvatar name={row.studentName} size={56} />
                        <Box sx={{ minWidth: 0 }}>
                            <Typography
                                sx={{
                                    fontSize: 18,
                                    fontWeight: 650,
                                    letterSpacing: '-0.01em',
                                    color: 'var(--t-text)',
                                    lineHeight: 1.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {row.studentName}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: 'var(--t-text-muted)', mt: 0.25 }}>
                                Meeting #{shortId(row._id)} · {formatDDMMYYYY(row.meetingDate)}
                            </Typography>
                        </Box>
                        <Box>
                            <StatusPill
                                status={status}
                                onClick={(e) => setStatusAnchor(e.currentTarget)}
                            />
                            <Menu
                                anchorEl={statusAnchor}
                                open={Boolean(statusAnchor)}
                                onClose={() => setStatusAnchor(null)}
                                PaperProps={{
                                    sx: {
                                        minWidth: 200,
                                        maxHeight: 360,
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
                                    Change status
                                </Box>
                                {ALL_STATUSES.map((s) => (
                                    <MenuItem
                                        key={s}
                                        onClick={() => {
                                            setStatus(s);
                                            setStatusAnchor(null);
                                        }}
                                        sx={{ py: 0.75 }}
                                    >
                                        <StatusPill status={s} size="sm" />
                                    </MenuItem>
                                ))}
                            </Menu>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 1.25,
                            mb: 2.5,
                        }}
                    >
                        <FieldTile label="Program">
                            <ProgramPill program={row.program} truncate={22} />
                        </FieldTile>
                        <FieldTile label="Mode">
                            <ModeBadge mode={row.mode} />
                        </FieldTile>
                        <FieldTile label="Consultant">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MeetingAvatar name={row.consultantName || '—'} size={20} />
                                <span>{row.consultantName || '—'}</span>
                            </Box>
                        </FieldTile>
                        <FieldTile label="Team lead">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MeetingAvatar name={row.teamLeadName || '—'} size={20} />
                                <span>{row.teamLeadName || '—'}</span>
                            </Box>
                        </FieldTile>
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Remarks</SectionTitle>
                        <TextField
                            multiline
                            minRows={3}
                            fullWidth
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Follow-up notes, objections, requested docs…"
                            sx={{
                                '& .MuiInputBase-root': {
                                    backgroundColor: 'var(--t-surface-muted)',
                                    fontSize: 12.5,
                                    borderRadius: '8px',
                                },
                            }}
                        />
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Timeline</SectionTitle>
                        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                            <TimelineItem
                                label={`Status: ${status}`}
                                time={row.updatedAt ? formatDDMMYYYY(row.updatedAt) : 'Just now'}
                            />
                            <TimelineItem
                                label={`Meeting logged by ${row.consultantName || '—'}`}
                                time={formatDDMMYYYY(row.createdAt || row.meetingDate)}
                            />
                            <TimelineItem
                                dim
                                label="Meeting date"
                                time={formatDDMMYYYY(row.meetingDate)}
                            />
                        </Box>
                    </Box>

                    {isAdmin && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Box>
                                <SectionTitle>Admin actions</SectionTitle>
                                <Button
                                    onClick={() => onDelete?.(row)}
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Delete meeting
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>

                {/* Foot */}
                <Box
                    sx={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--t-border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                    }}
                >
                    <Button
                        onClick={onClose}
                        size="small"
                        variant="text"
                        sx={{ textTransform: 'none', color: 'var(--t-text-3)' }}
                    >
                        Close
                    </Button>
                    <Button
                        onClick={handleSave}
                        size="small"
                        variant="contained"
                        disabled={saving || !dirty}
                        sx={{ textTransform: 'none', borderRadius: '8px', boxShadow: 'none' }}
                    >
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </Box>
            </Drawer>
            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </>
    );
};

const TimelineItem = ({ label, time, dim = false }) => (
    <Box
        component="li"
        sx={{
            display: 'grid',
            gridTemplateColumns: '14px 1fr',
            gap: 1.25,
            padding: '8px 0',
            borderTop: '1px dashed var(--t-border)',
            '&:first-of-type': { borderTop: 'none' },
            fontSize: 12.5,
            color: 'var(--t-text-3)',
        }}
    >
        <Box
            sx={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: dim ? 'var(--t-text-faint)' : '#1976d2',
                mt: 0.75,
            }}
        />
        <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{label}</Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--t-text-faint)', mt: 0.25 }}>{time}</Typography>
        </Box>
    </Box>
);

export default MeetingDetailDrawer;
