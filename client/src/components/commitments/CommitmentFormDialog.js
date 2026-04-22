import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    MenuItem,
    Box,
    Typography,
    IconButton,
    Alert,
    Slider,
    Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import { startOfWeek, endOfWeek, getWeek, getYear } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import consultantService from '../../services/consultantService';
import userService from '../../services/userService';
import StatusPill from '../meetings/StatusPill';
import { ALL_LEAD_STAGES, STATUS_META } from '../../utils/commitmentDesign';

const Label = ({ children }) => (
    <Typography
        component="span"
        sx={{
            fontSize: 11.5,
            color: 'var(--t-text-muted)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            mb: 0.5,
            display: 'block',
        }}
    >
        {children}
    </Typography>
);

const blankForm = () => ({
    commitmentDate: new Date(),
    studentName: '',
    studentPhone: '',
    commitmentMade: '',
    leadStage: 'Cold',
    status: 'pending',
    conversionProbability: 50,
    meetingsDone: 0,
    followUpDate: null,
    followUpNotes: '',
    expectedConversionDate: null,
    prospectForWeek: '',
    teamLead: '',
    consultantId: '',
    reasonForNotAchieving: '',
    correctiveActionByTL: '',
    adminComment: '',
});

const CommitmentFormDialog = ({ open, onClose, onSubmit, initialData = null }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [form, setForm] = useState(blankForm());
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [teamLeads, setTeamLeads] = useState([]);
    const [consultants, setConsultants] = useState([]);

    useEffect(() => {
        if (!open) return;
        if (initialData) {
            const tlId = initialData.teamLead?._id || initialData.teamLead || '';
            setForm({
                commitmentDate: initialData.commitmentDate
                    ? new Date(initialData.commitmentDate)
                    : initialData.weekStartDate
                        ? new Date(initialData.weekStartDate)
                        : new Date(),
                studentName: initialData.studentName || '',
                studentPhone: initialData.studentPhone || '',
                commitmentMade: initialData.commitmentMade || '',
                leadStage: initialData.leadStage || 'Cold',
                status: initialData.status || 'pending',
                conversionProbability: initialData.conversionProbability ?? 50,
                meetingsDone: initialData.meetingsDone ?? 0,
                followUpDate: initialData.followUpDate ? new Date(initialData.followUpDate) : null,
                followUpNotes: initialData.followUpNotes || '',
                expectedConversionDate: initialData.expectedConversionDate
                    ? new Date(initialData.expectedConversionDate)
                    : null,
                prospectForWeek: initialData.prospectForWeek ?? '',
                teamLead: tlId,
                consultantId: '',  // Not stored as ref on commitment, so edit keeps name only
                reasonForNotAchieving: initialData.reasonForNotAchieving || '',
                correctiveActionByTL: initialData.correctiveActionByTL || '',
                adminComment: initialData.adminComment || '',
            });
        } else {
            setForm({
                ...blankForm(),
                teamLead: isAdmin ? '' : user?.id || user?._id || '',
            });
        }
        setErrors({});
        setSubmitError('');
    }, [open, initialData, isAdmin, user]);

    useEffect(() => {
        if (!open || !isAdmin) return;
        let cancelled = false;
        userService
            .getUsers({ organization: 'luc' })
            .then((res) => {
                const all = res.data || res || [];
                const tls = all.filter(
                    (u) =>
                        u.role === 'team_lead' &&
                        (u.organization || 'luc') === 'luc' &&
                        u.isActive !== false
                );
                if (!cancelled) setTeamLeads(tls);
            })
            .catch(() => { if (!cancelled) setTeamLeads([]); });
        return () => { cancelled = true; };
    }, [open, isAdmin]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        const load = async () => {
            try {
                if (isAdmin && !form.teamLead) {
                    if (!cancelled) setConsultants([]);
                    return;
                }
                const res = await consultantService.getConsultants(
                    isAdmin ? { organization: 'luc' } : {}
                );
                const list = res.data || res || [];
                const active = list.filter((c) => c.isActive !== false);
                const scoped = isAdmin
                    ? active.filter((c) => {
                          const tl = c.teamLead?._id || c.teamLead;
                          return tl && tl.toString() === form.teamLead.toString();
                      })
                    : active;
                if (!cancelled) setConsultants(scoped);
            } catch (_e) {
                if (!cancelled) setConsultants([]);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [open, isAdmin, form.teamLead]);

    const activeTeamLead = useMemo(() => {
        if (!form.teamLead) return null;
        if (isAdmin) return teamLeads.find((t) => t._id === form.teamLead) || null;
        return { _id: user?.id || user?._id, name: user?.name || 'Team Lead' };
    }, [isAdmin, teamLeads, form.teamLead, user]);

    const consultantOptions = useMemo(() => {
        const list = [];
        if (activeTeamLead) {
            list.push({
                value: `tl:${activeTeamLead._id}`,
                label: `${activeTeamLead.name} (Team Lead)`,
                name: activeTeamLead.name,
            });
        }
        for (const c of consultants) {
            list.push({ value: c._id, label: c.name, name: c.name });
        }
        return list;
    }, [activeTeamLead, consultants]);

    const handleField = (field) => (e) => {
        const value = e.target.value;
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'teamLead') next.consultantId = '';
            return next;
        });
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.commitmentDate) e.commitmentDate = 'Date is required';
        if (!form.commitmentMade.trim()) e.commitmentMade = 'Commitment description is required';
        if (!form.leadStage) e.leadStage = 'Lead stage is required';
        if (!form.teamLead) e.teamLead = 'Team lead is required';
        if (isAdmin && !form.consultantId) e.consultantId = 'Consultant is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            // Derive week context from commitmentDate (Mon–Sun ISO week).
            const d = form.commitmentDate;
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
            const weekNumber = getWeek(d, { weekStartsOn: 1 });
            const year = getYear(d);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

            const picked = consultantOptions.find((o) => o.value === form.consultantId);
            const consultantName = picked?.name || '';

            const payload = {
                commitmentDate: d.toISOString(),
                weekStartDate: weekStart.toISOString(),
                weekEndDate: weekEnd.toISOString(),
                weekNumber,
                year,
                dayCommitted: dayName,
                studentName: form.studentName.trim(),
                studentPhone: form.studentPhone.trim(),
                commitmentMade: form.commitmentMade.trim(),
                leadStage: form.leadStage,
                status: form.status,
                conversionProbability: Number(form.conversionProbability) || 0,
                meetingsDone: Number(form.meetingsDone) || 0,
                followUpDate: form.followUpDate ? form.followUpDate.toISOString() : undefined,
                followUpNotes: form.followUpNotes || '',
                expectedConversionDate: form.expectedConversionDate
                    ? form.expectedConversionDate.toISOString()
                    : undefined,
                prospectForWeek: form.prospectForWeek === '' ? undefined : Number(form.prospectForWeek),
                reasonForNotAchieving: form.reasonForNotAchieving || '',
                correctiveActionByTL: form.correctiveActionByTL || '',
                consultantName,
            };

            if (isAdmin) {
                payload.teamLead = form.teamLead;
                if (activeTeamLead) payload.teamName = activeTeamLead.teamName || activeTeamLead.name;
                if (form.adminComment) payload.adminComment = form.adminComment;
            }

            await onSubmit(payload);
            onClose();
        } catch (err) {
            setSubmitError(
                err?.response?.data?.message || err?.message || 'Failed to save commitment'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog
                open={open}
                onClose={submitting ? undefined : onClose}
                maxWidth="md"
                fullWidth
                scroll="paper"
                PaperProps={{
                    sx: {
                        maxWidth: 720,
                        borderRadius: '14px',
                        boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
                        overflow: 'hidden',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--t-border)',
                    }}
                >
                    <Box>
                        <Typography sx={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--t-text)' }}>
                            {initialData ? 'Edit commitment' : 'New commitment'}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'var(--t-text-muted)', mt: 0.25 }}>
                            {initialData ? 'Update commitment details' : 'Log a weekly sales commitment'}
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={onClose} disabled={submitting} sx={{ color: 'var(--t-text-3)' }}>
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                <DialogContent sx={{ padding: '18px 20px', backgroundColor: 'var(--t-surface)' }}>
                    {submitError && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
                            {submitError}
                        </Alert>
                    )}

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                            columnGap: 2,
                            rowGap: 2,
                        }}
                    >
                        <Box>
                            <Label>Commitment date</Label>
                            <DatePicker
                                value={form.commitmentDate}
                                onChange={(d) => {
                                    setForm((p) => ({ ...p, commitmentDate: d }));
                                    if (errors.commitmentDate) setErrors((p) => ({ ...p, commitmentDate: '' }));
                                }}
                                format="dd/MM/yyyy"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                        error: !!errors.commitmentDate,
                                        helperText: errors.commitmentDate || ' ',
                                    },
                                }}
                            />
                        </Box>
                        <Box>
                            <Label>Student name</Label>
                            <TextField
                                fullWidth
                                size="small"
                                value={form.studentName}
                                onChange={handleField('studentName')}
                                placeholder="e.g. Maria Anastasia"
                                helperText=" "
                            />
                        </Box>

                        <Box>
                            <Label>Team lead</Label>
                            {isAdmin ? (
                                <TextField
                                    fullWidth
                                    size="small"
                                    select
                                    value={form.teamLead}
                                    onChange={handleField('teamLead')}
                                    error={!!errors.teamLead}
                                    helperText={errors.teamLead || ' '}
                                >
                                    {teamLeads.map((tl) => (
                                        <MenuItem key={tl._id} value={tl._id}>
                                            {tl.name}
                                            {tl.teamName ? ` (${tl.teamName})` : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            ) : (
                                <TextField
                                    fullWidth
                                    size="small"
                                    value={user?.name || ''}
                                    InputProps={{ readOnly: true }}
                                    helperText="Scoped to your team"
                                />
                            )}
                        </Box>

                        <Box>
                            <Label>Consultant</Label>
                            <TextField
                                fullWidth
                                size="small"
                                select
                                value={form.consultantId}
                                onChange={handleField('consultantId')}
                                error={!!errors.consultantId}
                                helperText={
                                    errors.consultantId ||
                                    (isAdmin && !form.teamLead ? 'Pick a team lead first' : ' ')
                                }
                                disabled={isAdmin && !form.teamLead}
                            >
                                {consultantOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>

                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Commitment description</Label>
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                                value={form.commitmentMade}
                                onChange={handleField('commitmentMade')}
                                placeholder="What the consultant commits to achieve this week"
                                error={!!errors.commitmentMade}
                                helperText={errors.commitmentMade || ' '}
                            />
                        </Box>

                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Lead stage</Label>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {ALL_LEAD_STAGES.map((s) => {
                                    const selected = form.leadStage === s;
                                    return (
                                        <Box
                                            key={s}
                                            onClick={() => {
                                                setForm((p) => ({ ...p, leadStage: s }));
                                                if (errors.leadStage) setErrors((p) => ({ ...p, leadStage: '' }));
                                            }}
                                            sx={{
                                                padding: '3px',
                                                borderRadius: 999,
                                                border: selected ? '1.5px solid #1976d2' : '1.5px solid transparent',
                                                backgroundColor: selected ? 'rgba(25,118,210,0.08)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'all 120ms ease',
                                                '&:hover': {
                                                    backgroundColor: selected ? 'rgba(25,118,210,0.08)' : 'rgba(0,0,0,0.03)',
                                                },
                                            }}
                                        >
                                            <StatusPill status={s} size="sm" />
                                        </Box>
                                    );
                                })}
                            </Box>
                            {errors.leadStage && (
                                <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                    {errors.leadStage}
                                </Typography>
                            )}
                        </Box>

                        <Box>
                            <Label>Workflow status</Label>
                            <TextField
                                fullWidth
                                size="small"
                                select
                                value={form.status}
                                onChange={handleField('status')}
                            >
                                {Object.entries(STATUS_META).map(([v, m]) => (
                                    <MenuItem key={v} value={v}>
                                        {m.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>

                        <Box>
                            <Label>Meetings done</Label>
                            <TextField
                                fullWidth
                                size="small"
                                type="number"
                                inputProps={{ min: 0 }}
                                value={form.meetingsDone}
                                onChange={handleField('meetingsDone')}
                            />
                        </Box>

                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Conversion probability · {form.conversionProbability}%</Label>
                            <Slider
                                size="small"
                                value={Number(form.conversionProbability) || 0}
                                onChange={(_e, v) => setForm((p) => ({ ...p, conversionProbability: v }))}
                                min={0}
                                max={100}
                                sx={{ mt: 1 }}
                            />
                        </Box>

                        <Box>
                            <Label>Follow-up date</Label>
                            <DatePicker
                                value={form.followUpDate}
                                onChange={(d) => setForm((p) => ({ ...p, followUpDate: d }))}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                            />
                        </Box>

                        <Box>
                            <Label>Expected conversion date</Label>
                            <DatePicker
                                value={form.expectedConversionDate}
                                onChange={(d) => setForm((p) => ({ ...p, expectedConversionDate: d }))}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                            />
                        </Box>

                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Follow-up notes</Label>
                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                size="small"
                                value={form.followUpNotes}
                                onChange={handleField('followUpNotes')}
                                placeholder="Objections, requested docs, next steps…"
                            />
                        </Box>

                        {form.status === 'missed' && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <Label>Reason not achieved</Label>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    size="small"
                                    value={form.reasonForNotAchieving}
                                    onChange={handleField('reasonForNotAchieving')}
                                    placeholder="What got in the way"
                                />
                            </Box>
                        )}

                        {!isAdmin && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <Label>Corrective action (TL)</Label>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    size="small"
                                    value={form.correctiveActionByTL}
                                    onChange={handleField('correctiveActionByTL')}
                                    placeholder="What you'll change next week"
                                />
                            </Box>
                        )}

                        {isAdmin && (
                            <>
                                <Divider sx={{ gridColumn: { xs: '1', sm: '1 / -1' }, my: 0.5 }} />
                                <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                    <Label>Admin comment</Label>
                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        size="small"
                                        value={form.adminComment}
                                        onChange={handleField('adminComment')}
                                        placeholder="Admin-only notes visible to TL"
                                    />
                                </Box>
                            </>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions
                    sx={{
                        padding: '12px 20px',
                        borderTop: '1px solid var(--t-border)',
                        backgroundColor: 'var(--t-surface-muted)',
                    }}
                >
                    <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', color: 'var(--t-text-3)' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={submitting}
                        startIcon={!initialData && <AddIcon sx={{ fontSize: 16 }} />}
                        sx={{ textTransform: 'none', borderRadius: '8px', boxShadow: 'none', px: 2 }}
                    >
                        {submitting
                            ? 'Saving…'
                            : initialData
                                ? 'Update commitment'
                                : 'Log commitment'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default CommitmentFormDialog;
