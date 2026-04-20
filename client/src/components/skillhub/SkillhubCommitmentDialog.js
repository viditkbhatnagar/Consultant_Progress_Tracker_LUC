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
    FormControlLabel,
    Checkbox,
    Box,
    Typography,
    Alert,
    Slider,
    Divider,
    Chip,
} from '@mui/material';
import { LEAD_STAGES_LIST } from '../../utils/constants';
import { getWeekInfo } from '../../utils/weekUtils';
import { format, startOfWeek, endOfWeek, getWeek } from 'date-fns';

// Bound the commitment date picker to the selected week's Mon–Sun range.
function weekBoundsFor(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    return {
        min: format(start, 'yyyy-MM-dd'),
        max: format(end, 'yyyy-MM-dd'),
    };
}

const DEMO_SLOTS = ['Demo 1', 'Demo 2', 'Demo 3', 'Demo 4'];

const blankDemos = () =>
    DEMO_SLOTS.map((slot) => ({
        slot,
        scheduledAt: '',
        done: false,
        doneAt: null,
        notes: '',
    }));

const toInputDatetime = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    // yyyy-MM-ddTHH:mm (local, for datetime-local input)
    return format(d, "yyyy-MM-dd'T'HH:mm");
};

const SkillhubCommitmentDialog = ({ open, onClose, onSave, commitment, teamConsultants = [], user }) => {
    const currentWeek = getWeekInfo();

    const [formData, setFormData] = useState({
        consultantName: '',
        studentName: '',
        studentPhone: '',
        commitmentMade: '',
        leadStage: 'Cold',
        achievementPercentage: 0,
        admissionClosed: false,
        prospectForWeek: 0,
        commitmentVsAchieved: '',
        weekNumber: currentWeek.weekNumber,
        year: currentWeek.year,
        selectedDate: format(new Date(), 'yyyy-MM-dd'),
        dayOfWeek: format(new Date(), 'EEEE'),
        conversionProbability: 50,
        followUpDate: '',
        expectedConversionDate: '',
        admissionClosedDate: '',
        demos: blankDemos(),
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        if (commitment) {
            // Prefer commitmentDate (the actual date the user picked); fall
            // back to weekStartDate only for legacy rows that predate it.
            const source = commitment.commitmentDate || commitment.weekStartDate;
            const dateStr = source
                ? format(new Date(source), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd');

            // Merge stored demos into the 4-slot template so all 4 rows always render.
            const byLabel = new Map();
            for (const d of commitment.demos || []) byLabel.set(d.slot, d);
            const mergedDemos = DEMO_SLOTS.map((slot) => {
                const d = byLabel.get(slot);
                return d
                    ? {
                          slot,
                          scheduledAt: toInputDatetime(d.scheduledAt),
                          done: !!d.done,
                          doneAt: d.doneAt || null,
                          notes: d.notes || '',
                      }
                    : { slot, scheduledAt: '', done: false, doneAt: null, notes: '' };
            });

            setFormData((f) => ({
                ...f,
                consultantName: commitment.consultantName || '',
                studentName: commitment.studentName || '',
                studentPhone: commitment.studentPhone || '',
                commitmentMade: commitment.commitmentMade || '',
                leadStage: commitment.leadStage || 'Cold',
                achievementPercentage: commitment.achievementPercentage || 0,
                admissionClosed: !!commitment.admissionClosed,
                prospectForWeek: commitment.prospectForWeek || 0,
                commitmentVsAchieved: commitment.commitmentVsAchieved || '',
                weekNumber: commitment.weekNumber || currentWeek.weekNumber,
                year: commitment.year || currentWeek.year,
                selectedDate: dateStr,
                dayOfWeek: format(new Date(dateStr), 'EEEE'),
                conversionProbability: commitment.conversionProbability ?? 50,
                followUpDate: commitment.followUpDate ? commitment.followUpDate.substring(0, 10) : '',
                expectedConversionDate: commitment.expectedConversionDate
                    ? commitment.expectedConversionDate.substring(0, 10)
                    : '',
                admissionClosedDate: commitment.admissionClosedDate
                    ? commitment.admissionClosedDate.substring(0, 10)
                    : '',
                demos: mergedDemos,
            }));
        } else {
            setFormData((f) => ({
                ...f,
                consultantName: '',
                studentName: '',
                studentPhone: '',
                commitmentMade: '',
                leadStage: 'Cold',
                achievementPercentage: 0,
                admissionClosed: false,
                prospectForWeek: 0,
                commitmentVsAchieved: '',
                demos: blankDemos(),
                followUpDate: '',
                expectedConversionDate: '',
                admissionClosedDate: '',
            }));
        }
        setError('');
    }, [commitment, open]); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (field, value) => setFormData((f) => ({ ...f, [field]: value }));
    const updateDemo = (idx, field, value) =>
        setFormData((f) => ({
            ...f,
            demos: f.demos.map((d, i) => {
                if (i !== idx) return d;
                const next = { ...d, [field]: value };
                // Unchecking done clears scheduledAt's displayed stamp but we
                // keep scheduledAt. Only doneAt is cleared here (server also clears).
                if (field === 'done' && !value) next.doneAt = null;
                return next;
            }),
        }));

    const validate = () => {
        if (!formData.consultantName) return 'Please select a counselor.';
        if (!formData.commitmentMade.trim()) return 'Commitment description is required.';
        for (const d of formData.demos) {
            if (d.done && !d.scheduledAt) {
                return `${d.slot}: cannot be marked Done without a scheduled time.`;
            }
        }
        return null;
    };

    const handleSave = async () => {
        setError('');
        const err = validate();
        if (err) return setError(err);

        setSaving(true);
        try {
            // Build a clean payload. Trim empty demos to avoid sending rows with
            // nothing to save — server is forgiving but cleaner payload is nicer.
            const cleanDemos = formData.demos
                .filter((d) => d.scheduledAt || d.done || d.notes)
                .map((d) => ({
                    slot: d.slot,
                    scheduledAt: d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null,
                    done: d.done,
                    notes: d.notes,
                }));

            // Derive week bounds from the picked commitment date so week &
            // date can never disagree on the server.
            const selectedDate = new Date(formData.selectedDate + 'T00:00:00');
            const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
            const weekNumber = getWeek(selectedDate, { weekStartsOn: 1 });

            const payload = {
                consultantName: formData.consultantName,
                studentName: formData.studentName,
                studentPhone: formData.studentPhone,
                commitmentMade: formData.commitmentMade,
                leadStage: formData.leadStage,
                achievementPercentage: formData.achievementPercentage,
                admissionClosed: formData.admissionClosed,
                prospectForWeek: formData.prospectForWeek,
                commitmentVsAchieved: formData.commitmentVsAchieved,
                weekNumber,
                year: selectedDate.getFullYear(),
                weekStartDate: weekStart,
                weekEndDate: weekEnd,
                commitmentDate: formData.selectedDate,
                dayCommitted: formData.dayOfWeek,
                conversionProbability: formData.conversionProbability,
                followUpDate: formData.followUpDate || undefined,
                expectedConversionDate: formData.expectedConversionDate || undefined,
                admissionClosedDate: formData.admissionClosedDate || undefined,
                demos: cleanDemos,
            };

            await onSave(payload);
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const scheduledCount = formData.demos.filter((d) => d.scheduledAt).length;
    const doneCount = formData.demos.filter((d) => d.done).length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {commitment ? 'Edit Commitment' : 'New Commitment'}
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    Week {formData.weekNumber} / {formData.year}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Basics</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth required>
                            <InputLabel>Counselor</InputLabel>
                            <Select
                                label="Counselor"
                                value={formData.consultantName}
                                onChange={(e) => set('consultantName', e.target.value)}
                            >
                                {teamConsultants.map((c) => (
                                    <MenuItem key={c._id} value={c.name}>
                                        {c.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth label="Student Name"
                            value={formData.studentName}
                            onChange={(e) => set('studentName', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth label="Student Phone"
                            value={formData.studentPhone}
                            onChange={(e) => set('studentPhone', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth required multiline minRows={2}
                            label="Commitment"
                            value={formData.commitmentMade}
                            onChange={(e) => set('commitmentMade', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth>
                            <InputLabel>Lead Stage</InputLabel>
                            <Select
                                label="Lead Stage"
                                value={formData.leadStage}
                                onChange={(e) => set('leadStage', e.target.value)}
                            >
                                {LEAD_STAGES_LIST.map((s) => (
                                    <MenuItem key={s} value={s}>{s}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    {/* Commitment Date — bounded to the week it belongs to.
                        To log for a different week, pick a date in that week. */}
                    <Grid size={{ xs: 12, sm: 4 }}>
                        {(() => {
                            const { min, max } = weekBoundsFor(formData.selectedDate);
                            return (
                                <TextField
                                    fullWidth type="date" label="Commitment Date" required
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ min, max }}
                                    value={formData.selectedDate}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        // Clamp so typing a date outside the week snaps inside it.
                                        const clamped = v < min ? min : v > max ? max : v;
                                        const day = format(new Date(clamped + 'T00:00:00'), 'EEEE');
                                        const wkNum = getWeek(new Date(clamped + 'T00:00:00'), { weekStartsOn: 1 });
                                        setFormData((f) => ({
                                            ...f,
                                            selectedDate: clamped,
                                            dayOfWeek: day,
                                            weekNumber: wkNum,
                                        }));
                                    }}
                                    helperText={`Pick any day in ${min} – ${max}`}
                                />
                            );
                        })()}
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth type="date" label="Follow-up Date" InputLabelProps={{ shrink: true }}
                            value={formData.followUpDate}
                            onChange={(e) => set('followUpDate', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            fullWidth type="date" label="Expected Conversion Date" InputLabelProps={{ shrink: true }}
                            value={formData.expectedConversionDate}
                            onChange={(e) => set('expectedConversionDate', e.target.value)}
                        />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle2">Demos</Typography>
                    <Chip
                        label={`${scheduledCount}/4 scheduled · ${doneCount}/4 done`}
                        size="small"
                        sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 600 }}
                    />
                </Box>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 2 }}>
                    Schedule up to 4 demos with the student. "Done" can only be ticked once a time is set —
                    the done timestamp is captured automatically.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                    {formData.demos.map((d, idx) => (
                        <Box
                            key={d.slot}
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
                                    {d.doneAt && (
                                        <Typography variant="caption" sx={{ color: '#16a34a' }}>
                                            Done {format(new Date(d.doneAt), 'd MMM · HH:mm')}
                                        </Typography>
                                    )}
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
                                        fullWidth size="small"
                                        label="Notes"
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
                    ))}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="subtitle2" sx={{ mb: 1 }}>Progress</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            Achievement: {formData.achievementPercentage}%
                        </Typography>
                        <Slider
                            value={formData.achievementPercentage}
                            min={0} max={100} step={5}
                            onChange={(_, v) => set('achievementPercentage', v)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            Conversion Probability: {formData.conversionProbability}%
                        </Typography>
                        <Slider
                            value={formData.conversionProbability}
                            min={0} max={100} step={5}
                            onChange={(_, v) => set('conversionProbability', v)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth type="number" label="Prospect for Week"
                            value={formData.prospectForWeek}
                            onChange={(e) => set('prospectForWeek', Number(e.target.value) || 0)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth label="Commitment vs Achieved"
                            value={formData.commitmentVsAchieved}
                            onChange={(e) => set('commitmentVsAchieved', e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.admissionClosed}
                                    onChange={(e) => set('admissionClosed', e.target.checked)}
                                />
                            }
                            label="Admission Closed (irreversible)"
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : commitment ? 'Save Changes' : 'Create Commitment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SkillhubCommitmentDialog;
