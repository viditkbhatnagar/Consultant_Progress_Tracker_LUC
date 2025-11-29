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
} from '@mui/material';
import { LEAD_STAGES_LIST } from '../utils/constants';
import { getWeekInfo } from '../utils/weekUtils';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';

const TeamLeadCommitmentDialog = ({ open, onClose, onSave, commitment, teamConsultants, user }) => {
    const currentWeekInfo = getWeekInfo();

    const [formData, setFormData] = useState({
        consultantName: '',
        studentName: '',
        commitmentMade: '',
        leadStage: 'Cold',
        achievementPercentage: 0,
        meetingsDone: 0,
        admissionClosed: false,
        prospectForWeek: 0,
        commitmentVsAchieved: '',
        // New fields
        weekNumber: currentWeekInfo.weekNumber,
        year: currentWeekInfo.year,
        selectedDate: format(new Date(), 'yyyy-MM-dd'),
        dayOfWeek: format(new Date(), 'EEEE'),
        conversionProbability: 50, // Default to 50%
        followUpDate: '',
    });
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (commitment) {
            // Editing existing commitment
            setFormData({
                consultantName: commitment.consultantName || '',
                studentName: commitment.studentName || '',
                commitmentMade: commitment.commitmentMade || '',
                leadStage: commitment.leadStage || 'Cold',
                achievementPercentage: commitment.achievementPercentage || 0,
                meetingsDone: commitment.meetingsDone || 0,
                admissionClosed: commitment.admissionClosed || false,
                prospectForWeek: commitment.prospectForWeek || 0,
                commitmentVsAchieved: commitment.commitmentVsAchieved || '',
            });
        } else {
            // Creating new commitment
            setFormData({
                consultantName: '',
                studentName: '',
                commitmentMade: '',
                leadStage: 'Cold',
                achievementPercentage: 0,
                meetingsDone: 0,
                admissionClosed: false,
                prospectForWeek: 0,
                commitmentVsAchieved: '',
            });
        }
        setValidationError('');
    }, [commitment, open]);

    const handleChange = (field, value) => {
        let updates = { [field]: value };

        // Auto-close when leadStage is set to "Admission"
        if (field === 'leadStage' && value === 'Admission') {
            updates.admissionClosed = true;
        }

        setFormData(prev => ({
            ...prev,
            ...updates,
        }));
        setValidationError('');
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.consultantName) {
            setValidationError('Please select a consultant');
            return;
        }
        if (!formData.studentName || !formData.commitmentMade) {
            setValidationError('Student name and commitment are required');
            return;
        }

        setSaving(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            setValidationError(error.response?.data?.message || 'Failed to save commitment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
            <DialogTitle>
                <Typography variant="h5" component="span">
                    {commitment ? 'Edit Commitment' : 'Add New Commitment'}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    Fill in all details carefully for accurate tracking
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {validationError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {validationError}
                    </Alert>
                )}

                <Grid container spacing={3} sx={{ mt: 1 }}>
                    {/* ===== WEEK & DATE SELECTION ===== */}
                    <Grid item xs={12}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
                                📅 Week & Date Selection
                            </Typography>
                            <Divider />
                        </Box>
                    </Grid>

                    {/* Week Selector */}
                    <Grid item xs={12} sm={4}>
                        <FormControl fullWidth>
                            <InputLabel>Week</InputLabel>
                            <Select
                                value={formData.weekNumber}
                                onChange={(e) => handleChange('weekNumber', e.target.value)}
                                label="Week"
                            >
                                {/* Show current week and previous 4 weeks */}
                                {[...Array(5)].map((_, i) => {
                                    const weekNum = currentWeekInfo.weekNumber - i;
                                    const year = weekNum > 0 ? currentWeekInfo.year : currentWeekInfo.year - 1;
                                    const displayWeek = weekNum > 0 ? weekNum : 52 + weekNum;
                                    return (
                                        <MenuItem key={i} value={displayWeek}>
                                            Week {displayWeek} {i === 0 ? '(Current)' : `(${i} weeks ago)`}
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Date Picker */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Commitment Date"
                            type="date"
                            value={formData.selectedDate}
                            onChange={(e) => {
                                const selectedDate = e.target.value;
                                const dayName = format(new Date(selectedDate), 'EEEE');
                                setFormData(prev => ({
                                    ...prev,
                                    selectedDate,
                                    dayOfWeek: dayName,
                                }));
                            }}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            helperText="Choose the date of this commitment"
                        />
                    </Grid>

                    {/* Day Display */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Day of Week"
                            value={formData.dayOfWeek}
                            InputProps={{
                                readOnly: true,
                            }}
                            helperText="Automatically calculated"
                        />
                    </Grid>

                    {/* ===== CONSULTANT & LEAD INFO ===== */}
                    <Grid item xs={12}>
                        <Box sx={{ mb: 2, mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
                                👤 Consultant & Lead Details
                            </Typography>
                            <Divider />
                        </Box>
                    </Grid>

                    {/* Consultant Selector */}
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth required>
                            <InputLabel>Consultant (Who is this commitment for?)</InputLabel>
                            <Select
                                value={formData.consultantName}
                                onChange={(e) => handleChange('consultantName', e.target.value)}
                                label="Consultant (Who is this commitment for?)"
                                disabled={!!commitment} // Can't change consultant when editing
                            >
                                {teamConsultants.map((consultant) => (
                                    <MenuItem key={consultant.name} value={consultant.name}>
                                        {consultant.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {commitment ? 'Consultant cannot be changed for existing commitments' : 'Select the team member this commitment is for'}
                        </Typography>
                    </Grid>

                    {/* Student Name */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Student Name"
                            value={formData.studentName}
                            onChange={(e) => handleChange('studentName', e.target.value)}
                            required
                        />
                    </Grid>

                    {/* Lead Stage */}
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                            <InputLabel>Lead Stage</InputLabel>
                            <Select
                                value={formData.leadStage}
                                onChange={(e) => handleChange('leadStage', e.target.value)}
                                label="Lead Stage"
                            >
                                {LEAD_STAGES_LIST.map((stage) => (
                                    <MenuItem key={stage} value={stage}>
                                        {stage}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {formData.leadStage === 'Admission' && (
                            <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block' }}>
                                ✓ Lead will be automatically closed when stage is Admission
                            </Typography>
                        )}
                    </Grid>

                    {/* Commitment */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Commitment Made"
                            value={formData.commitmentMade}
                            onChange={(e) => handleChange('commitmentMade', e.target.value)}
                            multiline
                            rows={2}
                            required
                            placeholder="e.g., Follow up with student, Schedule meeting, Submit documents..."
                        />
                    </Grid>

                    {/* Achievement Percentage */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Achievement %"
                            type="number"
                            value={formData.achievementPercentage}
                            onChange={(e) => handleChange('achievementPercentage', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                            InputProps={{
                                inputProps: { min: 0, max: 100 }
                            }}
                        />
                    </Grid>

                    {/* Meetings Done */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Meetings Done"
                            type="number"
                            value={formData.meetingsDone}
                            onChange={(e) => handleChange('meetingsDone', Math.max(0, parseInt(e.target.value) || 0))}
                            InputProps={{
                                inputProps: { min: 0 }
                            }}
                        />
                    </Grid>

                    {/* Prospect Rating */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Prospect Rating"
                            type="number"
                            value={formData.prospectForWeek}
                            onChange={(e) => handleChange('prospectForWeek', Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                            InputProps={{
                                inputProps: { min: 0, max: 10 }
                            }}
                        />
                    </Grid>

                    {/* Commitment vs Achieved */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Commitment vs Achieved (Notes)"
                            value={formData.commitmentVsAchieved}
                            onChange={(e) => handleChange('commitmentVsAchieved', e.target.value)}
                            multiline
                            rows={2}
                            placeholder="Optional: Add notes about progress..."
                        />
                    </Grid>

                    {/* ===== PROBABILITY & FOLLOW-UP ===== */}
                    <Grid item xs={12}>
                        <Box sx={{ mb: 2, mt: 3 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
                                📊 Conversion Probability & Follow-up
                            </Typography>
                            <Divider />
                        </Box>
                    </Grid>

                    {/* Conversion Probability Slider */}
                    <Grid item xs={12} md={6}>
                        <Box sx={{ px: 2 }}>
                            <Typography gutterBottom>
                                Conversion Probability: {formData.conversionProbability}%
                            </Typography>
                            <Slider
                                value={formData.conversionProbability}
                                onChange={(e, value) => handleChange('conversionProbability', value)}
                                min={0}
                                max={100}
                                step={5}
                                marks={[
                                    { value: 0, label: '0%' },
                                    { value: 50, label: '50%' },
                                    { value: 100, label: '100%' },
                                ]}
                                valueLabelDisplay="auto"
                                sx={{
                                    '& .MuiSlider-thumb': {
                                        backgroundColor:
                                            formData.conversionProbability >= 70 ? '#4caf50' :
                                                formData.conversionProbability >= 40 ? '#ff9800' : '#f44336',
                                    },
                                    '& .MuiSlider-track': {
                                        backgroundColor:
                                            formData.conversionProbability >= 70 ? '#4caf50' :
                                                formData.conversionProbability >= 40 ? '#ff9800' : '#f44336',
                                    },
                                }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                What's the likelihood this lead will convert?
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Follow-up Date */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Follow-up Date"
                            type="date"
                            value={formData.followUpDate}
                            onChange={(e) => handleChange('followUpDate', e.target.value)}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            helperText="When should you follow up with this lead?"
                        />
                    </Grid>

                    {/* Admission Closed */}
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.admissionClosed}
                                    onChange={(e) => handleChange('admissionClosed', e.target.checked)}
                                    disabled={formData.leadStage === 'Admission'} // Auto-set when Admission
                                    color="success"
                                />
                            }
                            label={
                                formData.leadStage === 'Admission'
                                    ? "Admission Closed (Auto-set for Admission stage)"
                                    : "Admission Closed (Student admitted)"
                            }
                        />
                    </Grid>
                </Grid>

                <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="caption" color="info.contrastText">
                        <strong>Note:</strong> This commitment will be created for the current week and assigned to the selected consultant.
                        You are adding this as: <strong>{user?.name}</strong> (Team Lead)
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={saving}
                >
                    {saving ? 'Saving...' : (commitment ? 'Update Commitment' : 'Add Commitment')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TeamLeadCommitmentDialog;
