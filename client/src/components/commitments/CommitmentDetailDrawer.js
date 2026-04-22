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
    Slider,
} from '@mui/material';
import { Close as CloseIcon, Edit as EditIcon } from '@mui/icons-material';
import MeetingAvatar from '../meetings/MeetingAvatar';
import StatusPill from '../meetings/StatusPill';
import {
    ALL_LEAD_STAGES,
    formatDDMMYYYY,
    formatWeekOfMonth,
    STATUS_META,
    displayDate,
} from '../../utils/commitmentDesign';

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
        <Box sx={{ color: 'var(--t-text-2)', fontSize: 12.5 }}>{children}</Box>
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

const CommitmentDetailDrawer = ({
    open,
    row,
    onClose,
    onSave,
    onEdit,
    onDelete,
    onCloseAdmission,
    isAdmin,
}) => {
    const [leadStage, setLeadStage] = useState('');
    const [status, setStatus] = useState('');
    const [probability, setProbability] = useState(0);
    const [followUpNotes, setFollowUpNotes] = useState('');
    const [adminComment, setAdminComment] = useState('');
    const [stageAnchor, setStageAnchor] = useState(null);
    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        if (row) {
            setLeadStage(row.leadStage || '');
            setStatus(row.status || 'pending');
            setProbability(row.conversionProbability ?? 0);
            setFollowUpNotes(row.followUpNotes || '');
            setAdminComment(row.adminComment || '');
        }
    }, [row]);

    if (!row) return null;

    const dirty =
        leadStage !== row.leadStage ||
        status !== row.status ||
        probability !== (row.conversionProbability ?? 0) ||
        followUpNotes !== (row.followUpNotes || '') ||
        adminComment !== (row.adminComment || '');

    const handleSave = async () => {
        if (!dirty) {
            onClose();
            return;
        }
        setSaving(true);
        try {
            const patch = {
                leadStage,
                status,
                conversionProbability: probability,
                followUpNotes,
            };
            if (isAdmin) patch.adminComment = adminComment;
            await onSave?.(row, patch);
            setSnack({ open: true, message: 'Commitment updated', severity: 'success' });
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

    const achievement = row.status === 'achieved' || row.admissionClosed ? 100 : 0;

    return (
        <>
            <Drawer
                anchor="right"
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: { width: { xs: '100%', sm: 500 }, backgroundColor: 'var(--t-surface-elev)' },
                }}
            >
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
                        <IconButton onClick={() => onEdit?.(row)} size="small" sx={{ color: 'var(--t-text-3)' }}>
                            <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Box>
                </Box>

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
                        <MeetingAvatar name={row.studentName || '—'} size={56} />
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
                                {row.studentName || 'Unnamed'}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: 'var(--t-text-muted)', mt: 0.25 }}>
                                {formatWeekOfMonth(row.commitmentDate, row.weekStartDate)} · {formatDDMMYYYY(displayDate(row))}
                            </Typography>
                        </Box>
                        <Box>
                            <StatusPill
                                status={leadStage}
                                onClick={(e) => setStageAnchor(e.currentTarget)}
                            />
                            <Menu
                                anchorEl={stageAnchor}
                                open={Boolean(stageAnchor)}
                                onClose={() => setStageAnchor(null)}
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
                                        onClick={() => { setLeadStage(s); setStageAnchor(null); }}
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
                        <FieldTile label="Consultant">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MeetingAvatar name={row.consultantName || '—'} size={20} />
                                <span style={{ fontWeight: 600, color: 'var(--t-text)' }}>
                                    {row.consultantName || '—'}
                                </span>
                            </Box>
                        </FieldTile>
                        <FieldTile label="Team lead">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MeetingAvatar name={row.teamLead?.name || row.teamName || '—'} size={20} />
                                <span>{row.teamLead?.name || row.teamName || '—'}</span>
                            </Box>
                        </FieldTile>
                        <FieldTile label="Follow-up date">
                            {row.followUpDate ? formatDDMMYYYY(row.followUpDate) : '—'}
                        </FieldTile>
                        <FieldTile label="Meetings done">{row.meetingsDone || 0}</FieldTile>
                        <FieldTile label="Achievement">
                            <span style={{ color: achievement === 100 ? 'var(--t-success-text)' : 'var(--t-text-3)', fontWeight: 600 }}>
                                {achievement}%
                            </span>
                        </FieldTile>
                        <FieldTile label="Admission">
                            {row.admissionClosed
                                ? `Closed ${row.closedDate ? '· ' + formatDDMMYYYY(row.closedDate) : ''}`
                                : 'Open'}
                        </FieldTile>
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Commitment</SectionTitle>
                        <Box
                            sx={{
                                backgroundColor: 'var(--t-surface-muted)',
                                border: '1px solid var(--t-border)',
                                borderRadius: '8px',
                                p: 1.5,
                                fontSize: 12.5,
                                color: 'var(--t-text-2)',
                                lineHeight: 1.5,
                            }}
                        >
                            {row.commitmentMade || (
                                <span style={{ color: 'var(--t-text-faint)' }}>No commitment description</span>
                            )}
                        </Box>
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Workflow status</SectionTitle>
                        <TextField
                            fullWidth
                            size="small"
                            select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {Object.entries(STATUS_META).map(([v, m]) => (
                                <MenuItem key={v} value={v}>
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-block',
                                            width: 8,
                                            height: 8,
                                            borderRadius: 999,
                                            backgroundColor: m.color,
                                            mr: 1,
                                            verticalAlign: 'middle',
                                        }}
                                    />
                                    {m.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Conversion probability</SectionTitle>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 0.5 }}>
                            <Slider
                                size="small"
                                value={probability}
                                onChange={(_e, v) => setProbability(v)}
                                min={0}
                                max={100}
                                sx={{ flex: 1 }}
                            />
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                    minWidth: 40,
                                    textAlign: 'right',
                                }}
                            >
                                {probability}%
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ mb: 2.5 }}>
                        <SectionTitle>Follow-up notes</SectionTitle>
                        <TextField
                            multiline
                            minRows={2}
                            fullWidth
                            value={followUpNotes}
                            onChange={(e) => setFollowUpNotes(e.target.value)}
                            placeholder="What happens next, who's blocking, etc."
                            sx={{
                                '& .MuiInputBase-root': {
                                    backgroundColor: 'var(--t-surface-muted)',
                                    fontSize: 12.5,
                                    borderRadius: '8px',
                                },
                            }}
                        />
                    </Box>

                    {row.reasonForNotAchieving && (
                        <Box sx={{ mb: 2.5 }}>
                            <SectionTitle>Reason not achieved</SectionTitle>
                            <Box
                                sx={{
                                    backgroundColor: 'var(--t-danger-bg)',
                                    border: '1px solid var(--t-danger-bg)',
                                    borderRadius: '8px',
                                    p: 1.5,
                                    fontSize: 12.5,
                                    color: 'var(--t-danger-text)',
                                }}
                            >
                                {row.reasonForNotAchieving}
                            </Box>
                        </Box>
                    )}

                    {row.correctiveActionByTL && (
                        <Box sx={{ mb: 2.5 }}>
                            <SectionTitle>Corrective action by TL</SectionTitle>
                            <Box
                                sx={{
                                    backgroundColor: 'var(--t-surface-muted)',
                                    border: '1px solid var(--t-border)',
                                    borderRadius: '8px',
                                    p: 1.5,
                                    fontSize: 12.5,
                                    color: 'var(--t-text-2)',
                                }}
                            >
                                {row.correctiveActionByTL}
                            </Box>
                        </Box>
                    )}

                    {isAdmin && (
                        <Box sx={{ mb: 2.5 }}>
                            <SectionTitle>Admin comment</SectionTitle>
                            <TextField
                                multiline
                                minRows={2}
                                fullWidth
                                value={adminComment}
                                onChange={(e) => setAdminComment(e.target.value)}
                                placeholder="Admin-only notes visible to TL"
                                sx={{
                                    '& .MuiInputBase-root': {
                                        backgroundColor: 'var(--t-surface-muted)',
                                        fontSize: 12.5,
                                        borderRadius: '8px',
                                    },
                                }}
                            />
                        </Box>
                    )}

                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {!row.admissionClosed && (
                            <Button
                                onClick={() => onCloseAdmission?.(row)}
                                size="small"
                                variant="outlined"
                                color="success"
                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                                Close admission
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                onClick={() => onDelete?.(row)}
                                size="small"
                                variant="outlined"
                                color="error"
                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                                Delete commitment
                            </Button>
                        )}
                    </Box>
                </Box>

                <Box
                    sx={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--t-border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                    }}
                >
                    <Button onClick={onClose} size="small" variant="text" sx={{ textTransform: 'none', color: 'var(--t-text-3)' }}>
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

export default CommitmentDetailDrawer;
