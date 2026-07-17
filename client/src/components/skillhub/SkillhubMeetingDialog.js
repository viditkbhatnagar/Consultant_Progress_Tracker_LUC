import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, TextField,
    FormControl, InputLabel, Select, MenuItem, Alert, Typography,
} from '@mui/material';
import { format } from 'date-fns';
import meetingService from '../../services/meetingService';
import { MEETING_MODES } from '../../utils/constants';
import { ALL_STATUSES } from '../../utils/meetingDesign';

// MUI renders dialogs in a portal, so component-scoped --t-*/--d-* vars don't
// reach them. Layered fallbacks keep the surface opaque on every page.
const SURFACE = 'var(--d-surface, var(--t-surface, #FFFFFF))';
const TEXT = 'var(--d-text, var(--t-text, #1F2937))';
const BORDER = 'var(--d-border, var(--t-border, #E5E7EB))';

const todayIso = () => format(new Date(), 'yyyy-MM-dd');
const toIso = (d) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');

const blankForm = {
    studentName: '',
    meetingDate: todayIso(),
    mode: '',
    status: '',
    demoDoneBy: '',
    consultantName: '',
    remarks: '',
};

// Skillhub meeting form. Institute-shaped: no LUC Program field, plus the
// "Demo done by" teacher dropdown (Institute only — Training has no faculty).
const SkillhubMeetingDialog = ({
    open, onClose, onSaved, meeting, consultants = [], teachers = [],
    isInstitute, isAdmin, viewOrg,
}) => {
    const [form, setForm] = useState(blankForm);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError('');
        setForm(meeting ? {
            studentName: meeting.studentName || '',
            meetingDate: toIso(meeting.meetingDate) || todayIso(),
            mode: meeting.mode || '',
            status: meeting.status || '',
            demoDoneBy: meeting.demoDoneBy || '',
            consultantName: meeting.consultantName || '',
            remarks: meeting.remarks || '',
        } : blankForm);
    }, [open, meeting]);

    const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

    // Admin isn't scoped by the token, so ownership has to come from the
    // picked counselor's team lead (the branch login that owns the branch).
    const selectedConsultant = useMemo(
        () => consultants.find((c) => c.name === form.consultantName),
        [consultants, form.consultantName]
    );

    const validate = () => {
        if (!form.studentName.trim()) return 'Student name is required.';
        if (!form.meetingDate) return 'Meeting date is required.';
        if (!form.mode) return 'Please select a mode.';
        if (!form.status) return 'Please select a status.';
        if (!form.consultantName) return 'Please select a counselor.';
        if (isAdmin && !meeting) {
            const tl = selectedConsultant?.teamLead;
            if (!tl) return 'That counselor has no branch owner — pick another.';
        }
        return '';
    };

    const save = async () => {
        const msg = validate();
        if (msg) { setError(msg); return; }
        setSaving(true);
        setError('');
        try {
            const payload = {
                studentName: form.studentName.trim(),
                meetingDate: form.meetingDate,
                mode: form.mode,
                status: form.status,
                consultantName: form.consultantName,
                consultant: selectedConsultant?._id || null,
                remarks: form.remarks.trim(),
                ...(isInstitute ? { demoDoneBy: form.demoDoneBy } : {}),
            };
            // Non-admins get org + ownership from their token, server-side.
            if (isAdmin && !meeting) {
                const tl = selectedConsultant?.teamLead;
                payload.organization = viewOrg;
                payload.teamLead = typeof tl === 'object' ? tl?._id : tl;
            }
            if (meeting) await meetingService.updateMeeting(meeting._id, payload);
            else await meetingService.createMeeting(payload);
            onSaved();
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{ paper: { sx: { backgroundColor: SURFACE, color: TEXT, borderRadius: '14px' } } }}
        >
            <DialogTitle sx={{ fontWeight: 800, borderBottom: `1px solid ${BORDER}` }}>
                {meeting ? 'Edit Meeting' : 'Log Meeting'}
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: SURFACE }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>Details</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth required label="Student Name" value={form.studentName}
                            onChange={(e) => set('studentName', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth required type="date" label="Meeting Date"
                            InputLabelProps={{ shrink: true }} value={form.meetingDate}
                            onChange={(e) => set('meetingDate', e.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Mode</InputLabel>
                            <Select label="Mode" value={form.mode} onChange={(e) => set('mode', e.target.value)}>
                                {MEETING_MODES.map((m) => (
                                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Status</InputLabel>
                            <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
                                {ALL_STATUSES.map((s) => (
                                    <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Counselor</InputLabel>
                            <Select
                                label="Counselor" value={form.consultantName}
                                onChange={(e) => set('consultantName', e.target.value)}
                            >
                                {consultants.map((c) => (
                                    <MenuItem key={c._id} value={c.name}>{c.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {isInstitute && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControl fullWidth>
                                <InputLabel>Demo done by</InputLabel>
                                <Select
                                    label="Demo done by" value={form.demoDoneBy}
                                    onChange={(e) => set('demoDoneBy', e.target.value)}
                                >
                                    <MenuItem value=""><em>Not a demo / none</em></MenuItem>
                                    {teachers.map((t) => (
                                        <MenuItem key={t._id} value={t.name}>{t.name}</MenuItem>
                                    ))}
                                    {/* A meeting keeps the teacher who took it even if that
                                        teacher is later deactivated — keep the saved value
                                        selectable so an edit doesn't silently blank it. */}
                                    {form.demoDoneBy && !teachers.some((t) => t.name === form.demoDoneBy) && (
                                        <MenuItem value={form.demoDoneBy}>{form.demoDoneBy}</MenuItem>
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                    )}

                    <Grid size={12}>
                        <TextField
                            fullWidth multiline minRows={3} label="Remarks" value={form.remarks}
                            onChange={(e) => set('remarks', e.target.value)}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ backgroundColor: SURFACE, borderTop: `1px solid ${BORDER}`, px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : meeting ? 'Save Changes' : 'Log Meeting'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SkillhubMeetingDialog;
