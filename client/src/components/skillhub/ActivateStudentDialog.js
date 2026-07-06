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

// Layered theme fallbacks — this dialog renders in a MUI portal (at
// document.body), and the Skillhub Student DB page publishes the tracker
// tokens (--t-*), not the dashboard tokens (--d-*). Using bare var(--d-*)
// with no fallback made the whole dialog render TRANSPARENT there. We mirror
// SkillhubStudentFormDialog: try --d-*, then --t-*, then a hard-coded colour
// so the surface is always opaque in both light and dark mode.
const SURFACE = 'var(--d-surface, var(--t-surface, #FFFFFF))';
const SURFACE_MUTED = 'var(--d-surface-muted, var(--t-surface-muted, #F7F9FC))';
const SURFACE_ELEV = 'var(--d-surface-elev, var(--t-surface-elev, #FDFEFF))';
const TEXT = 'var(--d-text, var(--t-text, #1F2937))';
const TEXT_3 = 'var(--d-text-3, var(--t-text-3, #6B7280))';
const TEXT_MUTED = 'var(--d-text-muted, var(--t-text-muted, #6B7280))';
const BORDER = 'var(--d-border, var(--t-border, #E5E7EB))';
const BORDER_SOFT = 'var(--d-border-soft, var(--t-border-soft, var(--t-border, #E5E7EB)))';
const SUCCESS_BG = 'var(--d-success-bg, var(--t-success-bg, #ECFDF5))';
const SUCCESS_TEXT = 'var(--d-success-text, var(--t-success-text, #1F7A35))';

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
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: SURFACE,
                    color: TEXT,
                    border: `1px solid ${BORDER}`,
                },
            }}
        >
            <DialogTitle
                sx={{
                    backgroundColor: SUCCESS_BG,
                    color: SUCCESS_TEXT,
                    fontWeight: 700,
                    borderBottom: `1px solid ${BORDER_SOFT}`,
                }}
            >
                Mark as Active Student
            </DialogTitle>
            <DialogContent
                dividers
                sx={{
                    backgroundColor: SURFACE_MUTED,
                    color: TEXT,
                    borderColor: BORDER,
                    '& .MuiInputBase-input': { color: TEXT },
                    '& .MuiInputLabel-root': { color: TEXT_MUTED },
                    '& .MuiOutlinedInput-root': { backgroundColor: SURFACE },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
                }}
            >
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Typography variant="body2" sx={{ mb: 2, color: TEXT_3 }}>
                    Confirm activation for <strong style={{ color: 'inherit' }}>{student?.studentName}</strong>
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
            <DialogActions
                sx={{
                    backgroundColor: SURFACE_ELEV,
                    borderTop: `1px solid ${BORDER}`,
                }}
            >
                <Button onClick={onClose} sx={{ color: TEXT_3 }}>Cancel</Button>
                <Button onClick={handleConfirm} variant="contained" color="success" disabled={saving}>
                    {saving ? 'Activating…' : 'Mark Active'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ActivateStudentDialog;
