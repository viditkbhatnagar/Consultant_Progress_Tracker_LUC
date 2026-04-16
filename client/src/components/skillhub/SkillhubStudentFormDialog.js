import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Box,
    Typography,
    Divider,
    IconButton,
    Checkbox,
    ListItemText,
    OutlinedInput,
    Alert,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import {
    SKILLHUB_CURRICULA,
    SKILLHUB_SUBJECTS,
    SKILLHUB_MODES,
    SKILLHUB_COURSE_DURATIONS,
    SKILLHUB_LEAD_SOURCES,
    SKILLHUB_STREAMS,
} from '../../utils/constants';

const emptyEmi = () => ({ dueDate: '', amount: 0, paidOn: '', paidAmount: 0 });

const blankForm = {
    studentName: '',
    gender: 'Male',
    dob: '',
    phones: { student: '', mother: '', father: '' },
    emails: { student: '', mother: '', father: '' },
    nationality: '',
    residence: '',
    addressEmirate: '',
    school: '',
    curriculum: 'CBSE',
    yearOrGrade: '',
    stream: '',
    subjects: [],
    mode: 'Online',
    courseDuration: 'OneYear',
    courseFee: 0,
    registrationFee: 0,
    emis: [],
    leadSource: 'Google',
    referredBy: '',
    campaignName: '',
    enquiryDate: '',
    closingDate: '',
    dateOfEnrollment: '',
    consultantName: '',
    consultantId: '',
};

const SkillhubStudentFormDialog = ({ open, onClose, onSave, student, counselors = [] }) => {
    const [formData, setFormData] = useState(blankForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        if (student) {
            setFormData({
                ...blankForm,
                ...student,
                phones: { ...blankForm.phones, ...(student.phones || {}) },
                emails: { ...blankForm.emails, ...(student.emails || {}) },
                consultantId: student.consultant?._id || student.consultant || '',
                dob: student.dob ? student.dob.substring(0, 10) : '',
                enquiryDate: student.enquiryDate ? student.enquiryDate.substring(0, 10) : '',
                closingDate: student.closingDate ? student.closingDate.substring(0, 10) : '',
                dateOfEnrollment: student.dateOfEnrollment ? student.dateOfEnrollment.substring(0, 10) : '',
                emis: (student.emis || []).map((e) => ({
                    dueDate: e.dueDate ? e.dueDate.substring(0, 10) : '',
                    amount: e.amount || 0,
                    paidOn: e.paidOn ? e.paidOn.substring(0, 10) : '',
                    paidAmount: e.paidAmount || 0,
                })),
            });
        } else {
            setFormData(blankForm);
        }
        setError('');
    }, [student, open]);

    const set = (field, value) => setFormData((f) => ({ ...f, [field]: value }));
    const setContact = (group, who, value) =>
        setFormData((f) => ({ ...f, [group]: { ...f[group], [who]: value } }));
    const updateEmi = (idx, field, value) =>
        setFormData((f) => ({
            ...f,
            emis: f.emis.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
        }));
    const addEmi = () =>
        setFormData((f) => ({ ...f, emis: [...f.emis, emptyEmi()] }));
    const removeEmi = (idx) =>
        setFormData((f) => ({ ...f, emis: f.emis.filter((_, i) => i !== idx) }));

    const handleCounselorChange = (e) => {
        const id = e.target.value;
        const c = counselors.find((x) => x._id === id);
        setFormData((f) => ({
            ...f,
            consultantId: id,
            consultantName: c?.name || '',
        }));
    };

    const handleSave = async () => {
        setError('');
        if (!formData.studentName.trim()) return setError('Student name is required');
        if (!formData.consultantId) return setError('Please assign a counselor');
        if (!formData.curriculum) return setError('Curriculum is required');
        if (!formData.yearOrGrade) return setError('Year / Grade is required');
        if (!formData.mode) return setError('Mode is required');
        if (!formData.courseDuration) return setError('Course duration is required');

        setSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {student ? 'Edit Student' : 'New Admission'}
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="subtitle2" sx={{ mb: 1 }}>General Info</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth required label="Student Name"
                            value={formData.studentName}
                            onChange={(e) => set('studentName', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth>
                            <InputLabel>Gender</InputLabel>
                            <Select label="Gender" value={formData.gender}
                                onChange={(e) => set('gender', e.target.value)}>
                                <MenuItem value="Male">Male</MenuItem>
                                <MenuItem value="Female">Female</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth type="date" label="DOB" InputLabelProps={{ shrink: true }}
                            value={formData.dob} onChange={(e) => set('dob', e.target.value)} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Student Phone" value={formData.phones.student}
                            onChange={(e) => setContact('phones', 'student', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Mother's Phone" value={formData.phones.mother}
                            onChange={(e) => setContact('phones', 'mother', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Father's Phone" value={formData.phones.father}
                            onChange={(e) => setContact('phones', 'father', e.target.value)} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Student Email" value={formData.emails.student}
                            onChange={(e) => setContact('emails', 'student', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Mother's Email" value={formData.emails.mother}
                            onChange={(e) => setContact('emails', 'mother', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Father's Email" value={formData.emails.father}
                            onChange={(e) => setContact('emails', 'father', e.target.value)} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Nationality" value={formData.nationality}
                            onChange={(e) => set('nationality', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Residence" value={formData.residence}
                            onChange={(e) => set('residence', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Address / Emirate" value={formData.addressEmirate}
                            onChange={(e) => set('addressEmirate', e.target.value)} />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Academics</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth label="School" value={formData.school}
                            onChange={(e) => set('school', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth required label="Year / Grade" value={formData.yearOrGrade}
                            onChange={(e) => set('yearOrGrade', e.target.value)}
                            helperText="e.g. 9 for IGCSE Y9 or 11 for CBSE Grade 11" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth>
                            <InputLabel>Stream</InputLabel>
                            <Select label="Stream" value={formData.stream}
                                onChange={(e) => set('stream', e.target.value)}>
                                <MenuItem value=""><em>None</em></MenuItem>
                                {SKILLHUB_STREAMS.map((s) => (
                                    <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Curriculum</InputLabel>
                            <Select label="Curriculum" value={formData.curriculum}
                                onChange={(e) => set('curriculum', e.target.value)}>
                                {SKILLHUB_CURRICULA.map((c) => (
                                    <MenuItem key={c} value={c}>{c}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 8 }}>
                        <FormControl fullWidth>
                            <InputLabel>Subjects</InputLabel>
                            <Select
                                multiple
                                label="Subjects"
                                value={formData.subjects}
                                onChange={(e) => set('subjects', e.target.value)}
                                input={<OutlinedInput label="Subjects" />}
                                renderValue={(selected) => selected.join(', ')}
                            >
                                {SKILLHUB_SUBJECTS.map((s) => (
                                    <MenuItem key={s} value={s}>
                                        <Checkbox checked={formData.subjects.includes(s)} />
                                        <ListItemText primary={s} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Mode</InputLabel>
                            <Select label="Mode" value={formData.mode}
                                onChange={(e) => set('mode', e.target.value)}>
                                {SKILLHUB_MODES.map((m) => (
                                    <MenuItem key={m} value={m}>{m}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Course Duration</InputLabel>
                            <Select label="Course Duration" value={formData.courseDuration}
                                onChange={(e) => set('courseDuration', e.target.value)}>
                                {SKILLHUB_COURSE_DURATIONS.map((d) => (
                                    <MenuItem key={d} value={d}>{d}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth type="date" label="Date of Enrollment" InputLabelProps={{ shrink: true }}
                            value={formData.dateOfEnrollment}
                            onChange={(e) => set('dateOfEnrollment', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                        <TextField fullWidth label="Enrollment No." value={student?.enrollmentNumber || '(auto-generated)'} disabled />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Typography variant="subtitle2">Fees & Payments</Typography>
                    <Tooltip
                        placement="right"
                        arrow
                        title={
                            <Box sx={{ p: 0.5, fontSize: 12, lineHeight: 1.6 }}>
                                <Box sx={{ fontWeight: 700, mb: 0.5 }}>
                                    Outstanding Amount Formula
                                </Box>
                                <Box sx={{ fontFamily: 'monospace', mb: 1 }}>
                                    Outstanding = max(0, Course Fee − Registration Fee − Σ(EMI Paid Amount))
                                </Box>
                                <Box sx={{ mb: 0.5 }}>
                                    • <b>Course Fee</b> — total fee for the course
                                </Box>
                                <Box sx={{ mb: 0.5 }}>
                                    • <b>Registration Fee</b> — one-time enrollment fee
                                </Box>
                                <Box sx={{ mb: 0.5 }}>
                                    • <b>EMI Paid Amount</b> — what the student actually paid on each installment (not the scheduled amount)
                                </Box>
                                <Box sx={{ mt: 1, opacity: 0.85 }}>
                                    Outstanding is clamped to 0 — overpayment never goes negative.
                                </Box>
                            </Box>
                        }
                    >
                        <InfoOutlinedIcon
                            sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }}
                        />
                    </Tooltip>
                </Box>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth type="number" label="Course Fee"
                            value={formData.courseFee}
                            onChange={(e) => set('courseFee', Number(e.target.value))} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth type="number" label="Registration Fee"
                            value={formData.registrationFee}
                            onChange={(e) => set('registrationFee', Number(e.target.value))} />
                    </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600 }}>EMIs</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={addEmi}>Add EMI</Button>
                    </Box>
                    {formData.emis.map((emi, idx) => (
                        <Grid container spacing={1} key={idx} sx={{ mb: 1 }}>
                            <Grid size={{ xs: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Due Date"
                                    InputLabelProps={{ shrink: true }}
                                    value={emi.dueDate}
                                    onChange={(e) => updateEmi(idx, 'dueDate', e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 2 }}>
                                <TextField fullWidth size="small" type="number" label="Amount"
                                    value={emi.amount}
                                    onChange={(e) => updateEmi(idx, 'amount', Number(e.target.value))} />
                            </Grid>
                            <Grid size={{ xs: 3 }}>
                                <TextField fullWidth size="small" type="date" label="Paid On"
                                    InputLabelProps={{ shrink: true }}
                                    value={emi.paidOn}
                                    onChange={(e) => updateEmi(idx, 'paidOn', e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 3 }}>
                                <TextField fullWidth size="small" type="number" label="Paid Amount"
                                    value={emi.paidAmount}
                                    onChange={(e) => updateEmi(idx, 'paidAmount', Number(e.target.value))} />
                            </Grid>
                            <Grid size={{ xs: 1 }}>
                                <IconButton size="small" onClick={() => removeEmi(idx)}>
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Grid>
                        </Grid>
                    ))}

                    {/* Live outstanding — mirrors the server-side virtual */}
                    {(() => {
                        const emiPaid = (formData.emis || []).reduce(
                            (s, e) => s + (Number(e.paidAmount) || 0),
                            0
                        );
                        const emiDue = (formData.emis || []).reduce(
                            (s, e) => s + (Number(e.amount) || 0),
                            0
                        );
                        const courseFee = Number(formData.courseFee) || 0;
                        const regFee = Number(formData.registrationFee) || 0;
                        const outstanding = Math.max(0, courseFee - regFee - emiPaid);
                        const totalPaid = regFee + emiPaid;
                        return (
                            <Box
                                sx={{
                                    mt: 2,
                                    p: 1.5,
                                    borderRadius: 1,
                                    bgcolor: 'rgba(160, 210, 235, 0.15)',
                                    border: '1px solid rgba(44, 62, 80, 0.1)',
                                    display: 'flex',
                                    gap: 3,
                                    flexWrap: 'wrap',
                                    fontSize: 13,
                                }}
                            >
                                <Box>
                                    Total EMI Scheduled:{' '}
                                    <b>{emiDue.toLocaleString()}</b>
                                </Box>
                                <Box>
                                    Total EMI Paid:{' '}
                                    <b>{emiPaid.toLocaleString()}</b>
                                </Box>
                                <Box>
                                    Total Paid (Reg + EMI):{' '}
                                    <b>{totalPaid.toLocaleString()}</b>
                                </Box>
                                <Box sx={{ ml: 'auto' }}>
                                    Outstanding:{' '}
                                    <b
                                        style={{
                                            color: outstanding > 0 ? '#d32f2f' : '#2e7d32',
                                        }}
                                    >
                                        {outstanding.toLocaleString()}
                                    </b>
                                </Box>
                            </Box>
                        );
                    })()}
                </Box>

                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Lead Source & Dates</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth>
                            <InputLabel>Lead Source</InputLabel>
                            <Select label="Lead Source" value={formData.leadSource}
                                onChange={(e) => set('leadSource', e.target.value)}>
                                {SKILLHUB_LEAD_SOURCES.map((s) => (
                                    <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Referred By" value={formData.referredBy}
                            onChange={(e) => set('referredBy', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth label="Campaign Name" value={formData.campaignName}
                            onChange={(e) => set('campaignName', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth type="date" label="Enquiry Date" InputLabelProps={{ shrink: true }}
                            value={formData.enquiryDate}
                            onChange={(e) => set('enquiryDate', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField fullWidth type="date" label="Closing Date" InputLabelProps={{ shrink: true }}
                            value={formData.closingDate}
                            onChange={(e) => set('closingDate', e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Team Assignment (Counselor)</InputLabel>
                            <Select label="Team Assignment (Counselor)"
                                value={formData.consultantId}
                                onChange={handleCounselorChange}>
                                {counselors.map((c) => (
                                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving}>
                    {saving ? 'Saving…' : student ? 'Save Changes' : 'Create Admission'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SkillhubStudentFormDialog;
