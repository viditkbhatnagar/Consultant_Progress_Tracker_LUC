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
} from '@mui/material';

const UserManagementDialog = ({ open, onClose, onSave, user = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        teamName: '',
        isActive: true,
    });
    const [error, setError] = useState('');
    const isEditing = !!user;

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                password: '', // Don't populate password when editing
                teamName: user.teamName || '',
                isActive: user.isActive !== false,
            });
        } else {
            setFormData({
                name: '',
                email: '',
                password: '',
                teamName: '',
                isActive: true,
            });
        }
        setError('');
    }, [user, open]);

    const handleChange = (field) => (e) => {
        setFormData(prev => ({
            ...prev,
            [field]: e.target.value
        }));
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.name || !formData.email || !formData.teamName) {
            setError('Name, Email, and Team Name are required');
            return;
        }

        if (!isEditing && !formData.password) {
            setError('Password is required for new users');
            return;
        }

        if (formData.password && formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }

        try {
            await onSave(formData);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save user');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEditing ? 'Edit Team Lead' : 'Add New Team Lead'}</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        fullWidth
                        label="Name"
                        value={formData.name}
                        onChange={handleChange('name')}
                        required
                    />

                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        required
                        disabled={isEditing} // Email can't be changed
                    />

                    <TextField
                        fullWidth
                        label={isEditing ? 'New Password (leave blank to keep current)' : 'Password'}
                        type="password"
                        value={formData.password}
                        onChange={handleChange('password')}
                        required={!isEditing}
                        helperText="Minimum 6 characters"
                    />

                    <TextField
                        fullWidth
                        label="Team Name"
                        value={formData.teamName}
                        onChange={handleChange('teamName')}
                        required
                        helperText="e.g., Sales Team A, Marketing Team B"
                    />

                    {isEditing && (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                />
                            }
                            label="Active User"
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

export default UserManagementDialog;
