import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    FormControlLabel,
    Switch,
    Alert,
    MenuItem,
} from '@mui/material';

const ConsultantManagementDialog = ({ open, onClose, onSave, consultant = null, teamLeads = [], currentUserRole, currentUserTeamName }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        teamName: '',
        teamLead: '',
        isActive: true,
    });
    const [error, setError] = useState('');
    const isEditing = !!consultant;
    const isTeamLead = currentUserRole === 'team_lead';

    useEffect(() => {
        if (consultant) {
            setFormData({
                name: consultant.name || '',
                email: consultant.email || '',
                phone: consultant.phone || '',
                teamName: consultant.teamName || '',
                teamLead: consultant.teamLead?._id || consultant.teamLead || '',
                isActive: consultant.isActive !== false,
            });
        } else {
            setFormData({
                name: '',
                email: '',
                phone: '',
                teamName: isTeamLead ? currentUserTeamName : '',
                teamLead: '',
                isActive: true,
            });
        }
        setError('');
    }, [consultant, open, isTeamLead, currentUserTeamName]);

    const handleChange = (field) => (e) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Auto-set team name when team lead is selected (for admin)
        if (field === 'teamLead' && !isTeamLead) {
            const selectedTL = teamLeads.find(tl => tl._id === value);
            if (selectedTL) {
                setFormData(prev => ({
                    ...prev,
                    teamName: selectedTL.teamName
                }));
            }
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.name) {
            setError('Consultant name is required');
            return;
        }

        if (!isTeamLead && !formData.teamLead) {
            setError('Please select a team lead');
            return;
        }

        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                setError('Please enter a valid email address');
                return;
            }
        }

        try {
            await onSave(formData);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save consultant');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditing ? 'Edit Consultant' : 'Add New Consultant'}</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        fullWidth
                        label="Consultant Name"
                        value={formData.name}
                        onChange={handleChange('name')}
                        required
                        placeholder="e.g., John Doe"
                    />

                    <TextField
                        fullWidth
                        label="Email (Optional)"
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        placeholder="john.doe@example.com"
                    />

                    <TextField
                        fullWidth
                        label="Phone (Optional)"
                        value={formData.phone}
                        onChange={handleChange('phone')}
                        placeholder="+1 234 567 8900"
                    />

                    {!isTeamLead && (
                        <>
                            <TextField
                                select
                                fullWidth
                                label="Team Lead"
                                value={formData.teamLead}
                                onChange={handleChange('teamLead')}
                                required
                                disabled={isEditing}
                            >
                                <MenuItem value="">Select Team Lead</MenuItem>
                                {teamLeads.map((tl) => (
                                    <MenuItem key={tl._id} value={tl._id}>
                                        {tl.name} ({tl.teamName})
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                fullWidth
                                label="Team Name"
                                value={formData.teamName}
                                disabled
                                helperText="Auto-filled based on selected team lead"
                            />
                        </>
                    )}

                    {isTeamLead && (
                        <TextField
                            fullWidth
                            label="Team Name"
                            value={formData.teamName}
                            disabled
                            helperText="Your team"
                        />
                    )}

                    {isEditing && (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                />
                            }
                            label="Active Consultant"
                        />
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                    {isEditing ? 'Update' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConsultantManagementDialog;
