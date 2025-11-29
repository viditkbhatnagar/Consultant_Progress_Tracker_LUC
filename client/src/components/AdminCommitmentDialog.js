import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Chip,
    Divider,
} from '@mui/material';
import { AdminPanelSettings as AdminIcon, SupervisorAccount as TLIcon } from '@mui/icons-material';

const AdminCommitmentDialog = ({ open, onClose, commitment, onSave }) => {
    const [adminComment, setAdminComment] = useState(commitment?.adminComment || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(commitment._id, { adminComment });
            onClose();
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setSaving(false);
        }
    };

    if (!commitment) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6">Admin Comment & Review</Typography>
                    <Chip
                        label={commitment.status}
                        color={commitment.admissionClosed ? 'success' : 'default'}
                        size="small"
                    />
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {/* Commitment Details */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Commitment Details
                    </Typography>
                    <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                        <Typography variant="body2"><strong>Team:</strong> {commitment.teamName}</Typography>
                        <Typography variant="body2"><strong>Consultant:</strong> {commitment.consultant?.name}</Typography>
                        <Typography variant="body2"><strong>Student:</strong> {commitment.studentName || 'N/A'}</Typography>
                        <Typography variant="body2"><strong>Commitment:</strong> {commitment.commitmentMade}</Typography>
                        <Typography variant="body2">
                            <strong>Lead Stage:</strong> {commitment.leadStage} |
                            <strong> Achievement:</strong> {commitment.achievementPercentage || 0}% |
                            <strong> Meetings:</strong> {commitment.meetingsDone || 0}
                        </Typography>
                    </Box>
                </Box>

                {/* Team Lead Comment (Read-only) */}
                {commitment.correctiveActionByTL && (
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TLIcon sx={{ mr: 1, color: 'primary.main', fontSize: 20 }} />
                            <Typography variant="subtitle2" color="text.secondary">
                                Team Lead Comment
                            </Typography>
                        </Box>
                        <Box sx={{ bgcolor: 'info.light', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
                            <Typography variant="body2" sx={{ color: 'info.contrastText' }}>
                                {commitment.correctiveActionByTL}
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Visible to: Admin, Team Lead, Consultant
                        </Typography>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                {/* Admin Comment (Editable) */}
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <AdminIcon sx={{ mr: 1, color: 'secondary.main', fontSize: 20 }} />
                        <Typography variant="subtitle2" color="text.secondary">
                            Admin Comment
                        </Typography>
                    </Box>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        placeholder="Add admin-level comments or directives... This will be visible to Team Lead and Consultant"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: 'background.paper',
                            }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Visible to: Admin, Team Lead, Consultant
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Comment'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AdminCommitmentDialog;
