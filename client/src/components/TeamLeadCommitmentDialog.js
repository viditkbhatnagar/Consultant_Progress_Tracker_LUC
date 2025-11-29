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
} from '@mui/material';
import { LEAD_STAGES_LIST } from '../utils/constants';

const TeamLeadCommitmentDialog = ({ open, onClose, onSave, commitment, teamConsultants, user }) => {
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
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {commitment ? 'Edit Commitment' : 'Add New Commitment'}
            </DialogTitle>
            <DialogContent dividers>
                {validationError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {validationError}
                    </Alert>
                )}

                <Grid container spacing={2} sx={{ mt: 1 }}>
                    {/* Consultant Selector */}
                    <Grid item xs={12}>
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
