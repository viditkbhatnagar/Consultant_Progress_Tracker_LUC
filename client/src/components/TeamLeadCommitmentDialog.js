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
        studentPhone: '',
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
        expectedConversionDate: '',
        expectedConversionDay: '',
        admissionClosedDate: '',
    });
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    useEffect(() => {
        if (commitment) {
            // Editing existing commitment - pre-fill ALL fields
            const commitmentDate = commitment.weekStartDate
                ? format(new Date(commitment.weekStartDate), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd');

            const dayName = commitmentDate
                ? format(new Date(commitmentDate), 'EEEE')
                : format(new Date(), 'EEEE');

            setFormData({
                consultantName: commitment.consultantName || '',
                studentName: commitment.studentName || '',
                studentPhone: commitment.studentPhone || '',
                commitmentMade: commitment.commitmentMade || '',
                leadStage: commitment.leadStage || 'Cold',
                achievementPercentage: commitment.achievementPercentage || 0,
                meetingsDone: commitment.meetingsDone || 0,
                admissionClosed: commitment.admissionClosed || false,
                prospectForWeek: commitment.prospectForWeek || 0,
                commitmentVsAchieved: commitment.commitmentVsAchieved || '',
                // New fields
                weekNumber: commitment.weekNumber || currentWeekInfo.weekNumber,
                year: commitment.year || currentWeekInfo.year,
                selectedDate: commitmentDate,
                dayOfWeek: dayName,
                conversionProbability: commitment.conversionProbability || 50,
                followUpDate: commitment.followUpDate
                    ? format(new Date(commitment.followUpDate), 'yyyy-MM-dd')
                    : '',
                expectedConversionDate: commitment.expectedConversionDate
                    ? format(new Date(commitment.expectedConversionDate), 'yyyy-MM-dd')
                    : '',
                expectedConversionDay: commitment.expectedConversionDate
                    ? format(new Date(commitment.expectedConversionDate), 'EEEE')
                    : '',
                admissionClosedDate: commitment.admissionClosedDate
                    ? format(new Date(commitment.admissionClosedDate), 'yyyy-MM-dd')
                    : '',
            });
        } else {
            // Creating new commitment - use defaults
            setFormData({
                consultantName: '',
                studentName: '',
                studentPhone: '',
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
                conversionProbability: 50,
                followUpDate: '',
                expectedConversionDate: '',
                expectedConversionDay: '',
                admissionClosedDate: '',
            });
        }
        setValidationError('');
    }, [commitment, open]);

    const handleChange = (field, value) => {
        // Special handling for admission closed checkbox
        if (field === 'admissionClosed' && value === true && !formData.admissionClosed) {
            // Show confirmation dialog
            const confirmed = window.confirm(
                '⚠️ WARNING: Closing Admission\n\n' +
                'This action CANNOT be undone!\n\n' +
                'Once you close this admission:\n' +
                '• The closing date will be permanently recorded\n' +
                '• You will NOT be able to reopen it\n' +
                '• This marks the final status of this lead\n\n' +
                'Are you sure you want to close this admission?'
            );

            if (!confirmed) {
                return; // User cancelled, don't change the checkbox
            }
        }

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
        if (!formData.selectedDate) {
            setValidationError('Please select a commitment date');
            return;
        }

        // Calculate week start and end dates based on selected date
        const selectedDateObj = new Date(formData.selectedDate + 'T00:00:00'); // Add time to ensure valid date

        if (isNaN(selectedDateObj.getTime())) {
            setValidationError('Invalid date selected');
            return;
        }

        const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 }); // Sunday

        // Prepare data with calculated fields
        const submitData = {
            ...formData,
            weekStartDate: format(weekStart, 'yyyy-MM-dd'),
            weekEndDate: format(weekEnd, 'yyyy-MM-dd'),
            year: formData.year || new Date().getFullYear(),
            // Handle date fields: convert empty string to undefined for proper MongoDB handling
            followUpDate: formData.followUpDate && formData.followUpDate.trim() !== ''
                ? formData.followUpDate
                : undefined,
            expectedConversionDate: formData.expectedConversionDate && formData.expectedConversionDate.trim() !== ''
                ? formData.expectedConversionDate
                : undefined,
            admissionClosedDate: formData.admissionClosedDate && formData.admissionClosedDate.trim() !== ''
                ? formData.admissionClosedDate
                : undefined,
        };

        setSaving(true);
        try {
            await onSave(submitData);
            onClose();
        } catch (error) {
            setValidationError(error.response?.data?.message || 'Failed to save commitment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { maxHeight: '90vh' }
            }}
        >
            <DialogTitle>
                <Typography variant="h5" component="span">
                    {commitment ? 'Edit Commitment' : 'Add New Commitment'}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    Fill in all details carefully for accurate tracking
                </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ overflowY: 'auto' }}>
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
                    <Grid item xs={12}>
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

                                    // Calculate week dates
                                    const today = new Date();
                                    const daysToSubtract = i * 7;
                                    const weekStart = startOfWeek(new Date(today.getTime() - daysToSubtract * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
                                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

                                    const dateRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

                                    return (
                                        <MenuItem key={i} value={displayWeek}>
                                            {dateRange} {i === 0 ? '(Current)' : ''}
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Date Picker */}
                    <Grid item xs={12}>
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
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Student Name"
                            value={formData.studentName}
                            onChange={(e) => handleChange('studentName', e.target.value)}
                            required
                        />
                    </Grid>

                    {/* Student Phone */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Student Phone Number"
                            value={formData.studentPhone}
                            onChange={(e) => handleChange('studentPhone', e.target.value)}
                            placeholder="+1234567890"
                            helperText="Optional"
                        />
                    </Grid>

                    {/* Lead Stage */}
                    <Grid item xs={12} md={6}>
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
                    </Grid>

                    {/* Commitment Description */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Commitment Made"
                            value={formData.commitmentMade}
                            onChange={(e) => handleChange('commitmentMade', e.target.value)}
                            required
                            multiline
                            rows={3}
                            placeholder="Describe the commitment in detail..."
                        />
                    </Grid>

                    {/* ===== CONVERSION & FOLLOW-UP ===== */}
                    <Grid item xs={12}>
                        <Box sx={{ mb: 2, mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5, color: 'primary.main' }}>
                                📊 Conversion Probability & Follow-up
                            </Typography>
                            <Divider />
                        </Box>
                    </Grid>

                    {/* Meetings Done */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Meetings Done"
                            type="number"
                            value={formData.meetingsDone}
                            onChange={(e) => handleChange('meetingsDone', Math.max(0, parseInt(e.target.value) || 0))}
                            InputProps={{
                                inputProps: { min: 0 }
                            }}
                            helperText="Number of meetings conducted with this student"
                        />
                    </Grid>

                    {/* Follow-up Date */}
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            type="date"
                            label="Follow-up Date"
                            value={formData.followUpDate}
                            onChange={(e) => handleChange('followUpDate', e.target.value)}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            helperText="When should you follow up with this lead?"
                        />
                    </Grid>

                    {/* Conversion Probability Slider */}
                    <Grid item xs={12}>
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

                    {/* Admission Closed */}
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.admissionClosed}
                                    onChange={(e) => {
                                        const isChecked = e.target.checked;
                                        // If checking for the first time and no date set, default to today
                                        if (isChecked && !formData.admissionClosedDate) {
                                            setFormData(prev => ({
                                                ...prev,
                                                admissionClosed: isChecked,
                                                admissionClosedDate: format(new Date(), 'yyyy-MM-dd'),
                                            }));
                                        } else {
                                            handleChange('admissionClosed', isChecked);
                                        }
                                    }}
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

                    {/* Admission Closed Date - Show when checkbox is checked */}
                    {formData.admissionClosed && (
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Admission Closed Date"
                                value={formData.admissionClosedDate}
                                onChange={(e) => handleChange('admissionClosedDate', e.target.value)}
                                InputLabelProps={{
                                    shrink: true,
                                }}
                                helperText="When was the admission actually closed?"
                                required
                            />
                        </Grid>
                    )}
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
