import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    MenuItem,
    Box,
    Autocomplete,
    Alert,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Stack,
    FormControlLabel,
    Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    Close as CloseIcon,
    Add as AddIcon,
} from '@mui/icons-material';
import { MEETING_MODES } from '../utils/constants';
import { ALL_STATUSES, MODE_META } from '../utils/meetingDesign';
import { useAuth } from '../context/AuthContext';
import studentService from '../services/studentService';
import consultantService from '../services/consultantService';
import userService from '../services/userService';
import commitmentService from '../services/commitmentService';
import StatusPill from './meetings/StatusPill';
import { compareNames } from '../utils/nameSimilarity';
import { format as formatDate, startOfWeek, endOfWeek, getWeek, getYear } from 'date-fns';

const blankForm = {
    meetingDate: new Date(),
    studentName: '',
    program: '',
    mode: '',
    consultant: '',
    teamLead: '',
    status: '',
    remarks: '',
    // LUC drift-prevention spine — required when status='Admission'.
    commitmentId: '',
    manualEntry: false,
    manualEntryReason: '',
};

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

const MeetingFormDialog = ({ open, onClose, onSubmit, initialData = null }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [formData, setFormData] = useState(blankForm);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [programs, setPrograms] = useState([]);
    const [teamLeads, setTeamLeads] = useState([]);
    const [consultants, setConsultants] = useState([]);
    // Linkable commitments for the picker — only fetched when the user
    // moves status to 'Admission' (LUC). Empty otherwise to keep the
    // dialog snappy on the common path.
    const [linkableCommits, setLinkableCommits] = useState([]);
    const [selectedCommit, setSelectedCommit] = useState(null);
    // Inline quick-create panel state. Lets a consultant log the missing
    // Admission-stage commitment without leaving the meeting dialog.
    const [quickOpen, setQuickOpen] = useState(false);
    const [quickText, setQuickText] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);
    const [quickError, setQuickError] = useState('');

    // Seed from initialData or reset to blank (+ auto-teamLead for TL role).
    useEffect(() => {
        if (!open) return;
        if (initialData) {
            const tlId = initialData.teamLead?._id || initialData.teamLead || '';
            const consultantId = initialData.consultant?._id || initialData.consultant;
            const consultantValue = consultantId
                ? consultantId
                : tlId
                    ? `tl:${tlId}`
                    : '';
            setFormData({
                meetingDate: initialData.meetingDate ? new Date(initialData.meetingDate) : new Date(),
                studentName: initialData.studentName || '',
                program: initialData.program || '',
                mode: initialData.mode || '',
                consultant: consultantValue,
                teamLead: tlId,
                status: initialData.status || '',
                remarks: initialData.remarks || '',
                commitmentId: initialData.commitmentId || '',
                manualEntry: !!initialData.manualEntry,
                manualEntryReason: initialData.manualEntryReason || '',
            });
        } else {
            setFormData({
                ...blankForm,
                teamLead: isAdmin ? '' : user?.id || user?._id || '',
            });
        }
        setErrors({});
        setSubmitError('');
    }, [open, initialData, isAdmin, user]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        studentService
            .getPrograms()
            .then((res) => { if (!cancelled) setPrograms(res.data || []); })
            .catch(() => { if (!cancelled) setPrograms([]); });
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => {
        if (!open || !isAdmin) return;
        let cancelled = false;
        userService
            .getUsers({ organization: 'luc' })
            .then((res) => {
                const all = res.data || res || [];
                const tls = all.filter(
                    (u) => u.role === 'team_lead' && (u.organization || 'luc') === 'luc' && u.isActive !== false
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
                if (isAdmin && !formData.teamLead) {
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
                        return tl && tl.toString() === formData.teamLead.toString();
                    })
                    : active;
                if (!cancelled) setConsultants(scoped);
            } catch (_e) {
                if (!cancelled) setConsultants([]);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [open, isAdmin, formData.teamLead]);

    const currentTeamLeadName = useMemo(() => {
        if (isAdmin) return '';
        return user?.name || '';
    }, [isAdmin, user]);

    const activeTeamLead = useMemo(() => {
        if (!formData.teamLead) return null;
        if (isAdmin) {
            return teamLeads.find((t) => t._id === formData.teamLead) || null;
        }
        return {
            _id: user?.id || user?._id,
            name: user?.name || 'Team Lead',
        };
    }, [isAdmin, teamLeads, formData.teamLead, user]);

    const consultantOptions = useMemo(() => {
        const list = [];
        if (activeTeamLead) {
            list.push({
                value: `tl:${activeTeamLead._id}`,
                label: `${activeTeamLead.name} (Team Lead)`,
            });
        }
        for (const c of consultants) {
            list.push({ value: c._id, label: c.name });
        }
        return list;
    }, [activeTeamLead, consultants]);

    const handleField = (field) => (event) => {
        const value = event.target.value;
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'teamLead') next.consultant = '';
            return next;
        });
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    // Load linkable commitments when status switches to 'Admission'.
    // The server filters to LUC + leadStage='Admission' + studentId IS NULL.
    useEffect(() => {
        if (!open) return;
        if (formData.status !== 'Admission') {
            setLinkableCommits([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await commitmentService.getLinkableCommitments({
                    consultantName: formData.consultantName,
                    limit: 200,
                });
                if (!cancelled) setLinkableCommits(res?.data || []);
            } catch (_) {
                if (!cancelled) setLinkableCommits([]);
            }
        })();
        return () => { cancelled = true; };
    }, [open, formData.status, formData.consultantName]);

    // When the user changes commitmentId out from under us, sync selectedCommit.
    useEffect(() => {
        if (!formData.commitmentId) {
            setSelectedCommit(null);
            return;
        }
        const match = linkableCommits.find((c) => c._id === formData.commitmentId);
        if (match) setSelectedCommit(match);
    }, [formData.commitmentId, linkableCommits]);

    // Quick-create an Admission-stage commitment from the meeting context.
    // Server's auto-close logic flips admissionClosed=true on save (because
    // leadStage='Admission' AND status='achieved'). Then we refresh the
    // linkable list and auto-select the new row in the picker.
    const handleQuickCreateCommit = async () => {
        if (!formData.studentName.trim()) {
            setQuickError('Student name is required (set it on the meeting first)');
            return;
        }
        const consultantOpt = consultantOptions.find((o) => o.value === formData.consultant);
        const consultantName = consultantOpt?.label
            || (typeof formData.consultant === 'string' && formData.consultant.startsWith('tl:')
                ? activeTeamLead?.name || currentTeamLeadName
                : '');
        if (!consultantName) {
            setQuickError('Pick a consultant on the meeting first');
            return;
        }
        if (!formData.teamLead) {
            setQuickError('Pick a team lead on the meeting first');
            return;
        }
        const tlObj = teamLeads.find((t) => t._id === formData.teamLead);
        const teamName = tlObj?.teamName || activeTeamLead?.teamName || '';
        const teamLeadName = tlObj?.name || activeTeamLead?.name || currentTeamLeadName || '';
        if (!teamName) {
            setQuickError('Could not resolve team name for the selected team lead');
            return;
        }

        const dt = formData.meetingDate || new Date();
        const payload = {
            commitmentDate: dt.toISOString(),
            weekStartDate: startOfWeek(dt, { weekStartsOn: 1 }).toISOString(),
            weekEndDate: endOfWeek(dt, { weekStartsOn: 1 }).toISOString(),
            weekNumber: getWeek(dt, { weekStartsOn: 1 }),
            year: getYear(dt),
            dayCommitted: dt.toLocaleDateString('en-US', { weekday: 'long' }),
            studentName: formData.studentName.trim(),
            commitmentMade: quickText.trim() || `Admission — ${formData.studentName.trim()}`,
            leadStage: 'Admission',
            status: 'achieved',
            achievementPercentage: 100,
            consultantName,
            // Admin role requires explicit teamLead/teamName in the body.
            // team_lead role auto-sets these server-side, but passing them
            // is harmless.
            teamLead: formData.teamLead,
            teamName,
            teamLeadName,
        };

        setQuickError('');
        setQuickSaving(true);
        try {
            const res = await commitmentService.createCommitment(payload);
            const newCommit = res?.data || res;
            // Refresh linkable list and auto-select the new commit.
            const refreshed = await commitmentService.getLinkableCommitments({
                consultantName,
                limit: 200,
            });
            const list = refreshed?.data || [];
            setLinkableCommits(list);
            const picked = list.find((c) => String(c._id) === String(newCommit._id)) || newCommit;
            setSelectedCommit(picked);
            setFormData((prev) => ({ ...prev, commitmentId: picked._id }));
            setQuickOpen(false);
            setQuickText('');
        } catch (err) {
            setQuickError(err?.response?.data?.message || err.message || 'Failed to create commitment');
        } finally {
            setQuickSaving(false);
        }
    };

    const validate = () => {
        const e = {};
        if (!formData.meetingDate) e.meetingDate = 'Date is required';
        if (!formData.studentName.trim()) e.studentName = 'Student name is required';
        if (!formData.program) e.program = 'Program is required';
        if (!formData.mode) e.mode = 'Mode is required';
        if (!formData.consultant) e.consultant = 'Consultant is required';
        if (!formData.teamLead) e.teamLead = 'Team lead is required';
        if (!formData.status) e.status = 'Status is required';
        // Drift-prevention: a meeting marked Admission must reference the
        // closed commitment that produced it. Either role can opt out via
        // the Manual Entry switch + reason (mirrors Student form pattern).
        if (formData.status === 'Admission' && !formData.commitmentId) {
            if (formData.manualEntry) {
                if (!formData.manualEntryReason || !formData.manualEntryReason.trim()) {
                    e.manualEntryReason = 'Reason required for manual entry';
                }
            } else {
                e.commitmentId = 'Pick a linked commitment, or enable Manual Entry';
            }
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            const selected = formData.consultant;
            let consultantId = null;
            let consultantName;
            if (typeof selected === 'string' && selected.startsWith('tl:')) {
                consultantId = null;
                consultantName = activeTeamLead?.name || currentTeamLeadName || '';
            } else {
                consultantId = selected || null;
                const opt = consultantOptions.find((o) => o.value === selected);
                consultantName = opt?.label || undefined;
            }

            await onSubmit({
                ...formData,
                consultant: consultantId,
                consultantName,
                meetingDate: formData.meetingDate.toISOString(),
                // Strip empty commitmentId so the server doesn't try to
                // ObjectId-cast an empty string. Only sent when the
                // picker fired. Manual Entry only carries through when
                // the admin actually opted in.
                commitmentId: formData.commitmentId || undefined,
                manualEntry: formData.manualEntry === true,
                manualEntryReason: formData.manualEntry ? formData.manualEntryReason : '',
            });
            onClose();
        } catch (err) {
            setSubmitError(
                err?.response?.data?.message || err?.message || 'Failed to save meeting'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const modeFilter = MEETING_MODES.filter((m) => m.value !== 'Meeting Scheduled');
    const statusOptions = ALL_STATUSES;

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
                        maxWidth: 620,
                        borderRadius: '14px',
                        boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
                        overflow: 'hidden',
                    },
                }}
            >
                {/* Head */}
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
                            {initialData ? 'Edit meeting' : 'New meeting'}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: 'var(--t-text-muted)', mt: 0.25 }}>
                            {initialData ? 'Update meeting details' : 'Log an admissions meeting'}
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={onClose}
                        disabled={submitting}
                        sx={{ color: 'var(--t-text-3)' }}
                    >
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                {/* Body */}
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
                        {/* Date */}
                        <Box>
                            <Label>Date</Label>
                            <DatePicker
                                value={formData.meetingDate}
                                onChange={(d) => {
                                    setFormData((prev) => ({ ...prev, meetingDate: d }));
                                    if (errors.meetingDate) setErrors((prev) => ({ ...prev, meetingDate: '' }));
                                }}
                                format="dd/MM/yyyy"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: 'small',
                                        error: !!errors.meetingDate,
                                        helperText: errors.meetingDate || ' ',
                                    },
                                }}
                            />
                        </Box>

                        {/* Student Name */}
                        <Box>
                            <Label>Student name</Label>
                            <TextField
                                fullWidth
                                size="small"
                                value={formData.studentName}
                                onChange={handleField('studentName')}
                                placeholder="e.g. Maria Anastasia"
                                error={!!errors.studentName}
                                helperText={errors.studentName || ' '}
                            />
                        </Box>

                        {/* Program */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Program</Label>
                            <Autocomplete
                                options={programs}
                                value={formData.program || null}
                                onChange={(_e, v) => {
                                    setFormData((prev) => ({ ...prev, program: v || '' }));
                                    if (errors.program) setErrors((prev) => ({ ...prev, program: '' }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        size="small"
                                        error={!!errors.program}
                                        helperText={errors.program || 'Pick from existing student programs'}
                                    />
                                )}
                            />
                        </Box>

                        {/* Mode — segmented */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Mode</Label>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={formData.mode}
                                onChange={(_e, v) => {
                                    if (!v) return;
                                    setFormData((prev) => ({ ...prev, mode: v }));
                                    if (errors.mode) setErrors((prev) => ({ ...prev, mode: '' }));
                                }}
                                sx={{
                                    backgroundColor: 'var(--t-surface-muted)',
                                    border: '1px solid var(--t-border)',
                                    borderRadius: '8px',
                                    padding: '2px',
                                    gap: '2px',
                                    flexWrap: 'wrap',
                                    '& .MuiToggleButton-root': {
                                        border: 0,
                                        borderRadius: '6px !important',
                                        textTransform: 'none',
                                        fontSize: 12.5,
                                        fontWeight: 500,
                                        color: 'var(--t-text-3)',
                                        gap: 0.75,
                                        px: 1.5,
                                        py: 0.625,
                                    },
                                    '& .MuiToggleButton-root.Mui-selected': {
                                        backgroundColor: 'var(--t-surface)',
                                        color: 'var(--t-text)',
                                        boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                                    },
                                }}
                            >
                                {modeFilter.map((m) => {
                                    const meta = MODE_META[m.value];
                                    const Icon = meta?.Icon;
                                    return (
                                        <ToggleButton key={m.value} value={m.value}>
                                            {Icon && <Icon sx={{ fontSize: 14, color: meta.color }} />}
                                            {m.label}
                                        </ToggleButton>
                                    );
                                })}
                            </ToggleButtonGroup>
                            {errors.mode && (
                                <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                    {errors.mode}
                                </Typography>
                            )}
                        </Box>

                        {/* Team Lead */}
                        <Box>
                            <Label>Team lead</Label>
                            {isAdmin ? (
                                <TextField
                                    fullWidth
                                    size="small"
                                    select
                                    value={formData.teamLead}
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
                                    value={currentTeamLeadName}
                                    InputProps={{ readOnly: true }}
                                    helperText="Scoped to your team"
                                />
                            )}
                        </Box>

                        {/* Consultant */}
                        <Box>
                            <Label>Consultant</Label>
                            <TextField
                                fullWidth
                                size="small"
                                select
                                value={formData.consultant}
                                onChange={handleField('consultant')}
                                error={!!errors.consultant}
                                helperText={
                                    errors.consultant ||
                                    (isAdmin && !formData.teamLead ? 'Pick a team lead first' : ' ')
                                }
                                disabled={isAdmin && !formData.teamLead}
                            >
                                {consultantOptions.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </Box>

                        {/* Status — pill picker */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Status</Label>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                {statusOptions.map((s) => {
                                    const selected = formData.status === s;
                                    return (
                                        <Box
                                            key={s}
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
                                            onClick={() => {
                                                setFormData((prev) => ({ ...prev, status: s }));
                                                if (errors.status) setErrors((prev) => ({ ...prev, status: '' }));
                                            }}
                                        >
                                            <StatusPill status={s} size="sm" />
                                        </Box>
                                    );
                                })}
                            </Box>
                            {errors.status && (
                                <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                    {errors.status}
                                </Typography>
                            )}
                        </Box>

                        {/* Linked Commitment — only shown when status is Admission.
                            LUC drift-prevention spine: an admission meeting must
                            reference the closed commitment that produced it. */}
                        {formData.status === 'Admission' && (
                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <Label>Linked Commitment</Label>
                                <Autocomplete
                                    size="small"
                                    fullWidth
                                    options={linkableCommits}
                                    value={selectedCommit}
                                    onChange={(_e, v) => {
                                        setSelectedCommit(v);
                                        setFormData((prev) => ({
                                            ...prev,
                                            commitmentId: v?._id || '',
                                        }));
                                        if (errors.commitmentId) {
                                            setErrors((prev) => ({ ...prev, commitmentId: '' }));
                                        }
                                    }}
                                    getOptionLabel={(o) =>
                                        o ? `${o.studentName || '(no name)'} — ${o.consultantName}` : ''
                                    }
                                    isOptionEqualToValue={(a, b) => a?._id === b?._id}
                                    renderOption={(props, opt) => (
                                        <li {...props} key={opt._id}>
                                            <Box>
                                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                                    {opt.studentName || '(no name)'}
                                                </Typography>
                                                <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                                                    {opt.consultantName} · {opt.teamName} ·{' '}
                                                    {opt.commitmentDate
                                                        ? formatDate(new Date(opt.commitmentDate), 'd MMM yyyy')
                                                        : ''}
                                                </Typography>
                                            </Box>
                                        </li>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Pick the commitment this admission belongs to…"
                                            error={!!errors.commitmentId}
                                        />
                                    )}
                                />
                                {errors.commitmentId && (
                                    <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                        {errors.commitmentId}
                                    </Typography>
                                )}
                                {linkableCommits.length === 0 && !quickOpen && (
                                    <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)', mt: 0.5 }}>
                                        No unlinked Admission-stage commitments in your scope — log one inline below.
                                    </Typography>
                                )}
                                {(() => {
                                    if (formData.manualEntry || !selectedCommit || !formData.studentName) return null;
                                    const { score, warn } = compareNames(formData.studentName, selectedCommit.studentName);
                                    if (!warn) return null;
                                    return (
                                        <Alert severity="warning" sx={{ mt: 1, py: 0.25, fontSize: 12 }}>
                                            Student name on the form ("{formData.studentName.trim()}") doesn't closely match the linked commitment ("{selectedCommit.studentName || '(no name)'}"). Similarity {Math.round(score * 100)}%. Double-check this is the right commitment.
                                        </Alert>
                                    );
                                })()}

                                {/* Quick-create — keeps consultants in this dialog
                                    instead of bouncing to the Commitment Tracker. */}
                                {!quickOpen && (
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => {
                                            setQuickOpen(true);
                                            setQuickError('');
                                            setQuickText('');
                                        }}
                                        sx={{ mt: 0.5, textTransform: 'none', fontWeight: 600 }}
                                    >
                                        + Log new commitment
                                    </Button>
                                )}

                                {quickOpen && (
                                    <Box
                                        sx={{
                                            mt: 1,
                                            p: 1.5,
                                            border: '1px dashed var(--t-border)',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--t-surface-muted)',
                                        }}
                                    >
                                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-2)', mb: 0.75 }}>
                                            Quick admission commitment for "{formData.studentName || '(set student name above)'}"
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            size="small"
                                            placeholder="Commitment description (e.g. 'Admission - OTHM L5 + BBA paid')"
                                            value={quickText}
                                            onChange={(e) => setQuickText(e.target.value)}
                                            disabled={quickSaving}
                                        />
                                        <Typography sx={{ fontSize: 11, color: 'var(--t-text-muted)', mt: 0.5 }}>
                                            Will be created as Lead Stage = Admission, Status = achieved
                                            (auto-closes on save). Date defaults to the meeting date.
                                        </Typography>
                                        {quickError && (
                                            <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                                {quickError}
                                            </Typography>
                                        )}
                                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={handleQuickCreateCommit}
                                                disabled={quickSaving}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                {quickSaving ? 'Saving…' : 'Save commitment & link'}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => { setQuickOpen(false); setQuickText(''); setQuickError(''); }}
                                                disabled={quickSaving}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Cancel
                                            </Button>
                                        </Stack>
                                    </Box>
                                )}

                                {/* Escape hatch — admin/team_lead can save an
                                    Admission meeting without a linked commit
                                    (with a reason). Mirrors the Student form's
                                    manual-entry pattern. Surfaces on the
                                    reconciliation page so admin can re-link
                                    later if needed. */}
                                {!quickOpen && (
                                    <Box sx={{ mt: 1.5 }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={!!formData.manualEntry}
                                                    onChange={(e) => {
                                                        const next = e.target.checked;
                                                        setFormData((p) => ({
                                                            ...p,
                                                            manualEntry: next,
                                                            // Clear commit selection when opting into manual.
                                                            commitmentId: next ? '' : p.commitmentId,
                                                        }));
                                                        if (next) setSelectedCommit(null);
                                                        if (errors.commitmentId) {
                                                            setErrors((prev) => ({ ...prev, commitmentId: '' }));
                                                        }
                                                    }}
                                                />
                                            }
                                            label={
                                                <Typography sx={{ fontSize: 12.5 }}>
                                                    Manual entry (no commitment to link)
                                                </Typography>
                                            }
                                        />
                                        {formData.manualEntry && (
                                            <Box sx={{ mt: 0.5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    placeholder="Reason (required) — e.g. legacy admission, no commitment row"
                                                    value={formData.manualEntryReason}
                                                    onChange={handleField('manualEntryReason')}
                                                    error={!!errors.manualEntryReason}
                                                />
                                                {errors.manualEntryReason && (
                                                    <Typography sx={{ fontSize: 11, color: 'var(--t-danger-text)', mt: 0.5 }}>
                                                        {errors.manualEntryReason}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {/* Remarks */}
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                            <Label>Remarks</Label>
                            <TextField
                                fullWidth
                                multiline
                                minRows={3}
                                size="small"
                                value={formData.remarks}
                                onChange={handleField('remarks')}
                                placeholder="Follow-up plan, objections, documents…"
                            />
                        </Box>
                    </Box>
                </DialogContent>

                {/* Foot */}
                <DialogActions
                    sx={{
                        padding: '12px 20px',
                        borderTop: '1px solid var(--t-border)',
                        backgroundColor: 'var(--t-surface-muted)',
                    }}
                >
                    <Button
                        onClick={onClose}
                        disabled={submitting}
                        sx={{ textTransform: 'none', color: 'var(--t-text-3)' }}
                    >
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
                                ? 'Update meeting'
                                : 'Log meeting'}
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default MeetingFormDialog;
