import React, { useEffect, useMemo, useState } from 'react';
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
    FormControlLabel,
    Checkbox,
    Box,
    Typography,
    Alert,
    Slider,
    Divider,
    Chip,
    CircularProgress,
} from '@mui/material';
import { format, startOfWeek, endOfWeek, getWeek } from 'date-fns';
import { LEAD_STAGES_LIST } from '../utils/constants';
import consultantService from '../services/consultantService';
import commitmentService from '../services/commitmentService';

const ORG_OPTIONS = [
    { value: 'luc', label: 'LUC' },
    { value: 'skillhub_training', label: 'Skillhub — Training' },
    { value: 'skillhub_institute', label: 'Skillhub — Institute' },
];

const isSkillhubOrg = (org) => org === 'skillhub_training' || org === 'skillhub_institute';

const DEMO_SLOTS = ['Demo 1', 'Demo 2', 'Demo 3', 'Demo 4'];
const blankDemos = () =>
    DEMO_SLOTS.map((slot) => ({ slot, scheduledAt: '', done: false, notes: '' }));

// `users` and `consultants` come from the Admin Dashboard parent so we reuse
// the already-loaded data instead of refetching. `consultants` can be scoped
// to LUC on the parent — the dialog also fetches the full cross-org list
// on open so Skillhub counselors are available too.
const AdminAddCommitmentDialog = ({ open, onClose, onSaved, users = [], consultants = [] }) => {
    const [loading, setLoading] = useState(false);
    const [allConsultants, setAllConsultants] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const today = format(new Date(), 'yyyy-MM-dd');
    const [form, setForm] = useState({
        organization: 'luc',
        teamLeadId: '',
        consultantId: '',
        studentName: '',
        studentPhone: '',
        commitmentMade: '',
        leadStage: 'Cold',
        commitmentDate: today,
        conversionProbability: 50,
        meetingsDone: 0,
        followUpDate: '',
        expectedConversionDate: '',
        admissionClosed: false,
        admissionClosedDate: '',
        demos: blankDemos(),
    });

    // Reset form every time the dialog opens so stale state doesn't leak
    // across sessions.
    useEffect(() => {
        if (!open) return;
        setForm({
            organization: 'luc',
            teamLeadId: '',
            consultantId: '',
            studentName: '',
            studentPhone: '',
            commitmentMade: '',
            leadStage: 'Cold',
            commitmentDate: format(new Date(), 'yyyy-MM-dd'),
            conversionProbability: 50,
            meetingsDone: 0,
            followUpDate: '',
            expectedConversionDate: '',
            admissionClosed: false,
            admissionClosedDate: '',
            demos: blankDemos(),
        });
        setError('');
    }, [open]);

    // Fetch the full cross-org consultants list on open so Skillhub
    // counselors are reachable even if the parent only loaded LUC.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const consRes = await consultantService.getConsultants();
                if (cancelled) return;
                setAllConsultants(consRes?.data || []);
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Failed to load consultants');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open]);

    // Prefer the fetched cross-org list; fall back to whatever the parent
    // passed in.
    const effectiveConsultants = allConsultants.length ? allConsultants : consultants;

    // Team-lead list comes from the users array passed by the parent.
    // LUC → team_lead role; Skillhub Training/Institute → skillhub branch login.
    const teamLeadOptions = useMemo(() => {
        const rows = (users || []).filter((u) => {
            if (u.isActive === false) return false;
            if (u.organization !== form.organization) return false;
            if (form.organization === 'luc') return u.role === 'team_lead';
            return u.role === 'skillhub';
        });
        return rows
            .map((u) => ({ _id: u._id, name: u.name || 'Unknown', teamName: u.teamName || '' }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, form.organization]);

    // Consultants filtered by both organization and the selected team lead.
    const consultantOptions = useMemo(() => {
        if (!form.teamLeadId) return [];
        return effectiveConsultants
            .filter((c) => c.organization === form.organization && c.isActive !== false)
            .filter((c) => {
                const tlId = c.teamLead && (c.teamLead._id || c.teamLead);
                return tlId === form.teamLeadId;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [effectiveConsultants, form.organization, form.teamLeadId]);

    const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

    const updateDemo = (idx, field, value) =>
        setForm((f) => ({
            ...f,
            demos: f.demos.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
        }));

    const validate = () => {
        if (!form.teamLeadId) return 'Please select a team lead';
        if (!form.consultantId) return 'Please select a consultant/counselor';
        if (!form.commitmentMade.trim()) return 'Commitment description is required';
        if (!form.commitmentDate) return 'Commitment date is required';
        if (isSkillhubOrg(form.organization)) {
            for (const d of form.demos) {
                if (d.done && !d.scheduledAt) {
                    return `${d.slot}: cannot be marked Done without a scheduled time.`;
                }
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setError('');

        const consultant = consultantOptions.find((c) => c._id === form.consultantId);
        const teamLead = teamLeadOptions.find((t) => t._id === form.teamLeadId);
        if (!consultant || !teamLead) { setError('Invalid consultant/team lead'); return; }

        // Derive week bounds from the chosen commitment date. Admin is not
        // constrained to the week of weekStartDate — whatever date they pick
        // drives the week.
        const d = new Date(form.commitmentDate + 'T00:00:00');
        const weekStart = startOfWeek(d, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
        const weekNumber = getWeek(d, { weekStartsOn: 1 });

        const payload = {
            organization: form.organization,
            teamLead: teamLead._id,
            teamName: consultant.teamName || teamLead.teamName,
            consultantName: consultant.name,
            studentName: form.studentName || undefined,
            studentPhone: form.studentPhone || undefined,
            commitmentMade: form.commitmentMade,
            leadStage: form.leadStage,
            conversionProbability: form.conversionProbability,
            meetingsDone: form.meetingsDone,
            followUpDate: form.followUpDate || undefined,
            expectedConversionDate: form.expectedConversionDate || undefined,
            admissionClosed: form.admissionClosed,
            admissionClosedDate: form.admissionClosed
                ? (form.admissionClosedDate || format(new Date(), 'yyyy-MM-dd'))
                : undefined,
            commitmentDate: form.commitmentDate,
            weekStartDate: format(weekStart, 'yyyy-MM-dd'),
            weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
            weekNumber,
            year: d.getFullYear(),
            dayCommitted: format(d, 'EEEE'),
        };

        if (isSkillhubOrg(form.organization)) {
            payload.demos = form.demos
                .filter((x) => x.scheduledAt || x.done || x.notes)
                .map((x) => ({
                    slot: x.slot,
                    scheduledAt: x.scheduledAt ? new Date(x.scheduledAt).toISOString() : null,
                    done: x.done,
                    notes: x.notes,
                }));
        }

        setSaving(true);
        try {
            await commitmentService.createCommitment(payload);
            if (onSaved) onSaved();
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to create commitment');
        } finally {
            setSaving(false);
        }
    };

    const scheduledCount = form.demos.filter((d) => d.scheduledAt).length;
    const doneCount = form.demos.filter((d) => d.done).length;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { maxHeight: '95vh' } }}
        >
            <DialogTitle>
                <Typography variant="h6" component="span">Add Commitment (Admin)</Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    Log a commitment on behalf of any team lead / consultant across any organization.
                </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ overflowY: 'auto' }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {/* Guard: if the logged-in token isn't for an admin, the API
                    returns scoped results and this form is useless. Detect
                    that and tell the user what to do. */}
                {!loading && teamLeadOptions.length === 0 && form.organization === 'luc' && (users?.length ?? 0) <= 1 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Your session does not have admin privileges. Please log out and log back in as an admin to add commitments across organizations.
                    </Alert>
                )}

                <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                    {/* Scope: Org → Team Lead → Consultant */}
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, mb: 0.5 }}>
                            Scope
                        </Typography>
                        <Divider />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Organization</InputLabel>
                            <Select
                                label="Organization"
                                value={form.organization}
                                onChange={(e) => setForm((f) => ({
                                    ...f,
                                    organization: e.target.value,
                                    teamLeadId: '',
                                    consultantId: '',
                                }))}
                            >
                                {ORG_OPTIONS.map((o) => (
                                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth required disabled={loading}>
                            <InputLabel>Team Lead</InputLabel>
                            <Select
                                label="Team Lead"
                                value={form.teamLeadId}
                                onChange={(e) => setForm((f) => ({
                                    ...f,
                                    teamLeadId: e.target.value,
                                    consultantId: '',
                                }))}
                            >
                                {teamLeadOptions.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        {loading ? 'Loading…' : 'No team leads found for this org'}
                                    </MenuItem>
                                ) : (
                                    teamLeadOptions.map((t) => (
                                        <MenuItem key={t._id} value={t._id}>
                                            {t.name}{t.teamName ? ` — ${t.teamName}` : ''}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                        {loading && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <CircularProgress size={14} />
                                <Typography variant="caption" color="text.secondary">Loading…</Typography>
                            </Box>
                        )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth required disabled={!form.teamLeadId || loading}>
                            <InputLabel>Consultant / Counselor</InputLabel>
                            <Select
                                label="Consultant / Counselor"
                                value={form.consultantId}
                                onChange={(e) => set('consultantId', e.target.value)}
                            >
                                {consultantOptions.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        {!form.teamLeadId
                                            ? 'Pick a team lead first'
                                            : 'No consultants for this team lead'}
                                    </MenuItem>
                                ) : (
                                    consultantOptions.map((c) => (
                                        <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Commitment core fields */}
                    <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                            Commitment
                        </Typography>
                        <Divider />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            required
                            label="Commitment Date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={form.commitmentDate}
                            onChange={(e) => set('commitmentDate', e.target.value)}
                            helperText="Admin — any date allowed. Week is derived from this."
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Student Name"
                            value={form.studentName}
                            onChange={(e) => set('studentName', e.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Student Phone"
                            value={form.studentPhone}
                            onChange={(e) => set('studentPhone', e.target.value)}
                            placeholder="+1234567890"
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            required
                            multiline
                            rows={3}
                            label="Commitment Made"
                            value={form.commitmentMade}
                            onChange={(e) => set('commitmentMade', e.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <FormControl fullWidth>
                            <InputLabel>Lead Stage</InputLabel>
                            <Select
                                label="Lead Stage"
                                value={form.leadStage}
                                onChange={(e) => set('leadStage', e.target.value)}
                            >
                                {LEAD_STAGES_LIST.map((s) => (
                                    <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Follow-up Date"
                            InputLabelProps={{ shrink: true }}
                            value={form.followUpDate}
                            onChange={(e) => set('followUpDate', e.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Expected Conversion Date"
                            InputLabelProps={{ shrink: true }}
                            value={form.expectedConversionDate}
                            onChange={(e) => set('expectedConversionDate', e.target.value)}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Meetings Done"
                            type="number"
                            InputProps={{ inputProps: { min: 0 } }}
                            value={form.meetingsDone}
                            onChange={(e) => set('meetingsDone', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, md: 8 }}>
                        <Box sx={{ px: 1 }}>
                            <Typography gutterBottom>
                                Conversion Probability: {form.conversionProbability}%
                            </Typography>
                            <Slider
                                value={form.conversionProbability}
                                onChange={(_, v) => set('conversionProbability', v)}
                                min={0}
                                max={100}
                                step={5}
                                marks={[
                                    { value: 0, label: '0%' },
                                    { value: 50, label: '50%' },
                                    { value: 100, label: '100%' },
                                ]}
                            />
                        </Box>
                    </Grid>

                    {/* Skillhub Demo Slots — rendered only for skillhub orgs. */}
                    {isSkillhubOrg(form.organization) && (
                        <>
                            <Grid size={{ xs: 12 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 0.5 }}>
                                    <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
                                        Demo Slots
                                    </Typography>
                                    <Chip
                                        size="small"
                                        label={`${scheduledCount}/4 scheduled · ${doneCount}/4 done`}
                                        sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 600 }}
                                    />
                                </Box>
                                <Divider />
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    "Done" can only be ticked once a scheduled time is set.
                                </Typography>
                            </Grid>
                            {form.demos.map((d, idx) => (
                                <Grid size={{ xs: 12 }} key={d.slot}>
                                    <Box
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 1.5,
                                            border: '1px solid rgba(0,0,0,0.08)',
                                            bgcolor: d.done
                                                ? 'rgba(22, 163, 74, 0.05)'
                                                : d.scheduledAt
                                                    ? 'rgba(37, 99, 235, 0.04)'
                                                    : '#fafafa',
                                        }}
                                    >
                                        <Grid container spacing={1.5} alignItems="center">
                                            <Grid size={{ xs: 12, sm: 2 }}>
                                                <Typography sx={{ fontWeight: 700 }}>{d.slot}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField
                                                    fullWidth size="small" type="datetime-local"
                                                    label="Scheduled"
                                                    InputLabelProps={{ shrink: true }}
                                                    value={d.scheduledAt}
                                                    onChange={(e) => updateDemo(idx, 'scheduledAt', e.target.value)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField
                                                    fullWidth size="small" label="Notes"
                                                    value={d.notes}
                                                    onChange={(e) => updateDemo(idx, 'notes', e.target.value)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 2 }}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={d.done}
                                                            disabled={!d.scheduledAt}
                                                            onChange={(e) => updateDemo(idx, 'done', e.target.checked)}
                                                        />
                                                    }
                                                    label={<Typography variant="body2">Done</Typography>}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Grid>
                            ))}
                        </>
                    )}

                    {/* Admission Closed */}
                    <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={form.admissionClosed}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setForm((f) => ({
                                            ...f,
                                            admissionClosed: checked,
                                            admissionClosedDate: checked
                                                ? (f.admissionClosedDate || format(new Date(), 'yyyy-MM-dd'))
                                                : '',
                                        }));
                                    }}
                                    color="success"
                                />
                            }
                            label="Admission Closed (Student admitted)"
                        />
                    </Grid>

                    {form.admissionClosed && (
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                required
                                type="date"
                                label="Admission Closed Date"
                                InputLabelProps={{ shrink: true }}
                                value={form.admissionClosedDate}
                                onChange={(e) => set('admissionClosedDate', e.target.value)}
                            />
                        </Grid>
                    )}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={saving}>
                    {saving ? 'Saving…' : 'Add Commitment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminAddCommitmentDialog;
