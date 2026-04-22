import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    MenuItem,
    Box,
    Autocomplete,
    Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    Videocam as VideocamIcon,
    DirectionsCar as DirectionsCarIcon,
    Business as BusinessIcon,
    School as SchoolIcon,
} from '@mui/icons-material';
import { LEAD_STAGES, MEETING_MODES } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import studentService from '../services/studentService';
import consultantService from '../services/consultantService';
import userService from '../services/userService';

const MODE_ICONS = {
    Zoom: { Icon: VideocamIcon, color: '#4f46e5' },
    'Out Meeting': { Icon: DirectionsCarIcon, color: '#7c3aed' },
    'Office Meeting': { Icon: BusinessIcon, color: '#16a34a' },
    'Student Meeting': { Icon: SchoolIcon, color: '#ea580c' },
};

const blankForm = {
    meetingDate: new Date(),
    studentName: '',
    program: '',
    mode: '',
    consultant: '',
    teamLead: '',
    status: '',
    remarks: '',
};

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

    // Seed the form from initialData when editing, or reset to blank (plus the
    // current TL's own id for team_lead role) when creating.
    useEffect(() => {
        if (!open) return;
        if (initialData) {
            setFormData({
                meetingDate: initialData.meetingDate ? new Date(initialData.meetingDate) : new Date(),
                studentName: initialData.studentName || '',
                program: initialData.program || '',
                mode: initialData.mode || '',
                consultant: initialData.consultant?._id || initialData.consultant || '',
                teamLead: initialData.teamLead?._id || initialData.teamLead || '',
                status: initialData.status || '',
                remarks: initialData.remarks || '',
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

    // Load the program list once the dialog opens.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        studentService
            .getPrograms()
            .then((res) => {
                if (!cancelled) setPrograms(res.data || []);
            })
            .catch(() => {
                if (!cancelled) setPrograms([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    // Admin needs the list of LUC team leads. TL doesn't — their teamLead is
    // always themselves.
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
            .catch(() => {
                if (!cancelled) setTeamLeads([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open, isAdmin]);

    // Load the consultant list: TL gets their own team's consultants; admin
    // cascades from the selected team lead. Consultants live in the
    // Consultant collection (not the User collection) so we always fetch via
    // consultantService and, for admin, filter by teamLead client-side.
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
        return () => {
            cancelled = true;
        };
    }, [open, isAdmin, formData.teamLead]);

    const currentTeamLeadName = useMemo(() => {
        if (isAdmin) return '';
        return user?.name || '';
    }, [isAdmin, user]);

    const handleChange = (field) => (event) => {
        const value = event.target.value;
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            // When admin swaps the team lead, clear the consultant — it belongs
            // to the previous TL's team.
            if (field === 'teamLead') next.consultant = '';
            return next;
        });
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const handleDateChange = (date) => {
        setFormData((prev) => ({ ...prev, meetingDate: date }));
        if (errors.meetingDate) setErrors((prev) => ({ ...prev, meetingDate: '' }));
    };

    const handleProgramChange = (_event, value) => {
        setFormData((prev) => ({ ...prev, program: value || '' }));
        if (errors.program) setErrors((prev) => ({ ...prev, program: '' }));
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
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                meetingDate: formData.meetingDate.toISOString(),
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

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog
                open={open}
                onClose={submitting ? undefined : onClose}
                maxWidth="lg"
                fullWidth
                scroll="paper"
                PaperProps={{ sx: { maxHeight: '92vh' } }}
            >
                <DialogTitle sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
                    {initialData ? 'Edit Meeting' : 'Add Meeting'}
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ pt: 1 }}>
                        {submitError && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {submitError}
                            </Alert>
                        )}
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                columnGap: 3,
                                rowGap: 3,
                            }}
                        >
                            <DatePicker
                                label="Date"
                                value={formData.meetingDate}
                                onChange={handleDateChange}
                                format="dd/MM/yyyy"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        required: true,
                                        error: !!errors.meetingDate,
                                        helperText: errors.meetingDate || 'Backdate or future date allowed',
                                    },
                                }}
                            />

                            <TextField
                                fullWidth
                                required
                                label="Student Name"
                                value={formData.studentName}
                                onChange={handleChange('studentName')}
                                error={!!errors.studentName}
                                helperText={errors.studentName}
                            />

                            <Autocomplete
                                options={programs}
                                value={formData.program || null}
                                onChange={handleProgramChange}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        required
                                        label="Program"
                                        error={!!errors.program}
                                        helperText={errors.program || 'Pick from existing student programs'}
                                    />
                                )}
                            />

                            <TextField
                                fullWidth
                                required
                                select
                                label="Mode of the Meeting"
                                value={formData.mode}
                                onChange={handleChange('mode')}
                                error={!!errors.mode}
                                helperText={errors.mode}
                            >
                                {MEETING_MODES.map((m) => {
                                    const iconMeta = MODE_ICONS[m.value];
                                    const Icon = iconMeta?.Icon;
                                    return (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {Icon && (
                                                    <Icon
                                                        fontSize="small"
                                                        sx={{ color: iconMeta.color }}
                                                    />
                                                )}
                                                {m.label}
                                            </Box>
                                        </MenuItem>
                                    );
                                })}
                            </TextField>

                            {isAdmin ? (
                                <TextField
                                    fullWidth
                                    required
                                    select
                                    label="Team Lead"
                                    value={formData.teamLead}
                                    onChange={handleChange('teamLead')}
                                    error={!!errors.teamLead}
                                    helperText={errors.teamLead}
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
                                    label="Team Lead"
                                    value={currentTeamLeadName}
                                    InputProps={{ readOnly: true }}
                                    helperText="Scoped to your team"
                                />
                            )}

                            <TextField
                                fullWidth
                                required
                                select
                                label="Consultant"
                                value={formData.consultant}
                                onChange={handleChange('consultant')}
                                error={!!errors.consultant}
                                helperText={
                                    errors.consultant ||
                                    (isAdmin && !formData.teamLead ? 'Pick a team lead first' : '')
                                }
                                disabled={isAdmin && !formData.teamLead}
                            >
                                {consultants.map((c) => (
                                    <MenuItem key={c._id} value={c._id}>
                                        {c.name}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                fullWidth
                                required
                                select
                                label="Status"
                                value={formData.status}
                                onChange={handleChange('status')}
                                error={!!errors.status}
                                helperText={errors.status}
                            >
                                {LEAD_STAGES.map((stage) => (
                                    <MenuItem key={stage.value} value={stage.value}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: '50%',
                                                    backgroundColor: stage.color,
                                                    mr: 1,
                                                }}
                                            />
                                            {stage.label}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </TextField>

                            <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={4}
                                    label="Remarks"
                                    value={formData.remarks}
                                    onChange={handleChange('remarks')}
                                    helperText="Optional"
                                />
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        color="primary"
                        disabled={submitting}
                    >
                        {initialData ? 'Update' : 'Save'} Meeting
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default MeetingFormDialog;
