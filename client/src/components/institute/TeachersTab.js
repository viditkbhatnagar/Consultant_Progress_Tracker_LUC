import React, { useCallback, useEffect, useState } from 'react';
import {
    Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, IconButton, Tooltip, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Typography, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import instituteService from '../../services/instituteService';

const TeacherDialog = ({ open, teacher, onClose, onSaved }) => {
    const [name, setName] = useState('');
    const [subjects, setSubjects] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setName(teacher?.name || '');
        setSubjects((teacher?.subjects || []).join(', '));
        setError('');
    }, [open, teacher]);

    const save = async () => {
        if (!name.trim()) return setError('Name is required');
        setSaving(true);
        try {
            const body = { name: name.trim(), subjects: subjects.split(',').map((s) => s.trim()).filter(Boolean) };
            if (teacher) await instituteService.updateTeacher(teacher._id, body);
            else await instituteService.createTeacher(body);
            onSaved();
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>{teacher ? 'Edit Teacher' : 'New Teacher'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth sx={{ mb: 2 }} autoFocus />
                <TextField label="Subjects (comma-separated)" value={subjects} onChange={(e) => setSubjects(e.target.value)} fullWidth placeholder="Maths, Physics" />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
                <Button onClick={save} disabled={saving} variant="contained">{saving ? 'Saving…' : 'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
};

const TeachersTab = () => {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [toast, setToast] = useState(null);

    const load = useCallback(() => {
        instituteService.getTeachers()
            .then((res) => { setTeachers(res.data || []); setLoading(false); })
            .catch((err) => { setError(err.response?.data?.message || err.message); setLoading(false); });
    }, []);
    useEffect(() => { setLoading(true); load(); }, [load]);

    const remove = async (t) => {
        if (!window.confirm(`Deactivate teacher "${t.name}"?`)) return;
        try { await instituteService.deleteTeacher(t._id); setToast({ severity: 'success', message: 'Teacher deactivated' }); load(); }
        catch (e) { setToast({ severity: 'error', message: e.response?.data?.message || e.message }); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 700 }}>{teachers.length} teachers</Typography>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>New Teacher</Button>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #f1efea)' }}>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Subjects</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell align="right" />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {teachers.map((t) => (
                            <TableRow key={t._id} hover sx={t.isActive === false ? { opacity: 0.5 } : null}>
                                <TableCell sx={{ fontWeight: 600 }}>{t.name}</TableCell>
                                <TableCell>
                                    {(t.subjects || []).map((s) => <Chip key={s} label={s} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)}
                                    {(!t.subjects || t.subjects.length === 0) && '—'}
                                </TableCell>
                                <TableCell>{t.isActive === false ? 'Inactive' : 'Active'}</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditing(t); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                    <Tooltip title="Deactivate"><IconButton size="small" onClick={() => remove(t)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TeacherDialog open={dialogOpen} teacher={editing} onClose={() => setDialogOpen(false)}
                onSaved={() => { setToast({ severity: 'success', message: editing ? 'Teacher updated' : 'Teacher created' }); load(); }} />
            <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default TeachersTab;
