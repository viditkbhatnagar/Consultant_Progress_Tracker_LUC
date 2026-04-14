import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    Alert,
    Typography,
} from '@mui/material';

const ActivateStudentDialog = ({ open, onClose, onConfirm, student }) => {
    const [addressEmirate, setAddressEmirate] = useState('');
    const [registrationFee, setRegistrationFee] = useState(0);
    const [dateOfEnrollment, setDateOfEnrollment] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setAddressEmirate(student?.addressEmirate || '');
        setRegistrationFee(student?.registrationFee || 0);
        setDateOfEnrollment(
            student?.dateOfEnrollment
                ? student.dateOfEnrollment.substring(0, 10)
                : new Date().toISOString().substring(0, 10)
        );
        setError('');
    }, [open, student]);

    const handleConfirm = async () => {
        setSaving(true);
        setError('');
        try {
            await onConfirm({
                addressEmirate,
                registrationFee: Number(registrationFee) || 0,
                dateOfEnrollment,
            });
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Activation failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Mark as Active Student</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    Confirm activation for <strong>{student?.studentName}</strong>
                    {student?.enrollmentNumber && (
                        <> ({student.enrollmentNumber})</>
                    )}. This will move the record to the Active Students tab.
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                        <TextField fullWidth label="Address / Emirate"
                            value={addressEmirate}
                            onChange={(e) => setAddressEmirate(e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth type="number" label="Registration Fee"
                            value={registrationFee}
                            onChange={(e) => setRegistrationFee(e.target.value)} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth type="date" label="Date of Enrollment"
                            InputLabelProps={{ shrink: true }}
                            value={dateOfEnrollment}
                            onChange={(e) => setDateOfEnrollment(e.target.value)} />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleConfirm} variant="contained" color="success" disabled={saving}>
                    {saving ? 'Activating…' : 'Mark Active'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ActivateStudentDialog;
