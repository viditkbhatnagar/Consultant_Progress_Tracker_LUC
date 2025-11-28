import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Grid,
    MenuItem,
    Slider,
    Typography,
    Box,
    InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LEAD_STAGES, DAYS_OF_WEEK } from '../utils/constants';
import { getWeekInfo } from '../utils/weekUtils';

const CommitmentFormDialog = ({ open, onClose, onSubmit, initialData = null }) => {
    const weekInfo = getWeekInfo();

    const [formData, setFormData] = useState({
        studentName: initialData?.studentName || '',
        commitmentMade: initialData?.commitmentMade || '',
        leadStage: initialData?.leadStage || 'Cold',
        conversionProbability: initialData?.conversionProbability || 50,
        followUpDate: initialData?.followUpDate ? new Date(initialData.followUpDate) : null,
        followUpNotes: initialData?.followUpNotes || '',
        dayCommitted: initialData?.dayCommitted || 'Monday',
        weekNumber: initialData?.weekNumber || weekInfo.weekNumber,
        year: initialData?.year || weekInfo.year,
        weekStartDate: initialData?.weekStartDate || weekInfo.weekStartDate,
        weekEndDate: initialData?.weekEndDate || weekInfo.weekEndDate,
    });

    const [errors, setErrors] = useState({});

    const handleChange = (field) => (event) => {
        setFormData({
            ...formData,
            [field]: event.target.value,
        });
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors({
                ...errors,
                [field]: '',
            });
        }
    };

    const handleSliderChange = (field) => (event, value) => {
        setFormData({
            ...formData,
            [field]: value,
        });
    };

    const handleDateChange = (field) => (date) => {
        setFormData({
            ...formData,
            [field]: date,
        });
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.commitmentMade.trim()) {
            newErrors.commitmentMade = 'Commitment description is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        onSubmit(formData);
        onClose();
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    {initialData ? 'Edit Commitment' : 'Create New Commitment'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Student Name (Optional)"
                                    value={formData.studentName}
                                    onChange={handleChange('studentName')}
                                    helperText="For reference only"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Day Committed"
                                    value={formData.dayCommitted}
                                    onChange={handleChange('dayCommitted')}
                                >
                                    {DAYS_OF_WEEK.map((day) => (
                                        <MenuItem key={day} value={day}>
                                            {day}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    required
                                    multiline
                                    rows={3}
                                    label="Commitment Description"
                                    value={formData.commitmentMade}
                                    onChange={handleChange('commitmentMade')}
                                    error={!!errors.commitmentMade}
                                    helperText={errors.commitmentMade || 'Describe what you commit to achieve this week'}
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    select
                                    label="Lead Stage"
                                    value={formData.leadStage}
                                    onChange={handleChange('leadStage')}
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
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography gutterBottom>
                                    Conversion Probability: {formData.conversionProbability}%
                                </Typography>
                                <Slider
                                    value={formData.conversionProbability}
                                    onChange={handleSliderChange('conversionProbability')}
                                    min={0}
                                    max={100}
                                    marks={[
                                        { value: 0, label: '0%' },
                                        { value: 50, label: '50%' },
                                        { value: 100, label: '100%' },
                                    ]}
                                    valueLabelDisplay="auto"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <DatePicker
                                    label="Follow-up Date"
                                    value={formData.followUpDate}
                                    onChange={handleDateChange('followUpDate')}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            helperText: 'When to follow up with this lead',
                                        },
                                    }}
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={2}
                                    label="Follow-up Notes"
                                    value={formData.followUpNotes}
                                    onChange={handleChange('followUpNotes')}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" color="primary">
                        {initialData ? 'Update' : 'Create'} Commitment
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default CommitmentFormDialog;
