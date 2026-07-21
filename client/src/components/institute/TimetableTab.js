import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Paper, ToggleButtonGroup, ToggleButton, FormControl, InputLabel, Select, MenuItem,
    IconButton, CircularProgress, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Typography, Snackbar, Menu,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import instituteService from '../../services/instituteService';
import { exportRawSheet } from '../../services/xlsxBuilder';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EntryDialog = ({ open, entry, teachers, subjects = [], onClose, onSaved }) => {
    const [f, setF] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!open) return;
        setF({
            teacher: entry?.teacher || '', dayOfWeek: entry?.dayOfWeek || 'Monday', time: entry?.time || '',
            gradeOrYear: entry?.gradeOrYear || '', curriculum: entry?.curriculum || '', subject: entry?.subject || '',
            studentLabel: entry?.studentLabel || '',
        });
        setError('');
    }, [open, entry]);
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const save = async () => {
        if (!f.teacher || !f.time.trim()) return setError('Teacher and time are required');
        setSaving(true);
        try {
            if (entry) await instituteService.updateEntry(entry._id, f);
            else await instituteService.createEntry(f);
            onSaved(); onClose();
        } catch (e) { setError(e.response?.data?.message || e.message); } finally { setSaving(false); }
    };
    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>{entry ? 'Edit Session' : 'New Session'}</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Teacher</InputLabel>
                        <Select label="Teacher" value={f.teacher} onChange={set('teacher')}>
                            {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Day</InputLabel>
                        <Select label="Day" value={f.dayOfWeek} onChange={set('dayOfWeek')}>
                            {DAYS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField size="small" label="Time" value={f.time} onChange={set('time')} placeholder="12.30 pm - 1.30 pm" />
                    <TextField size="small" label="Grade / Year" value={f.gradeOrYear} onChange={set('gradeOrYear')} placeholder="Grade 9 / Year 10" />
                    <FormControl fullWidth size="small">
                        <InputLabel>Subject</InputLabel>
                        <Select label="Subject" value={f.subject || ''} onChange={set('subject')}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {subjects.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            {/* Keep a retired/legacy value (e.g. CHRM) selectable on an
                                existing row so editing it doesn't silently blank it. */}
                            {f.subject && !subjects.includes(f.subject) && (
                                <MenuItem value={f.subject}>{f.subject} (legacy)</MenuItem>
                            )}
                        </Select>
                    </FormControl>
                    <TextField size="small" label="Curriculum" value={f.curriculum} onChange={set('curriculum')} placeholder="CBSE / IGCSE Edexcel" />
                    <TextField size="small" label="Grade / Student label" value={f.studentLabel} onChange={set('studentLabel')} sx={{ gridColumn: '1 / -1' }} placeholder="e.g. Mitali  /  Grade 9" />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
                <Button onClick={save} disabled={saving} variant="contained">{saving ? 'Saving…' : 'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
};

const SessionCard = ({ e, mode, onEdit, onDelete }) => (
    <Box sx={{ p: 1, mb: 1, borderRadius: '8px', bgcolor: 'var(--d-surface, #fff)', border: '1px solid var(--d-border, #e5e7eb)', borderLeft: '3px solid var(--d-accent, #2383E2)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{e.time}</Typography>
            <Box sx={{ whiteSpace: 'nowrap' }}>
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onEdit(e)}><EditIcon sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onDelete(e)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
            </Box>
        </Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{e.studentLabel || e.gradeOrYear}</Typography>
        <Typography sx={{ fontSize: 11, color: 'var(--d-text-3, #57564E)' }}>
            {[mode === 'grade' ? e.teacherName : e.subject, e.curriculum].filter(Boolean).join(' · ')}
        </Typography>
    </Box>
);

const TimetableTab = () => {
    const [teachers, setTeachers] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('teacher'); // 'teacher' | 'grade'
    const [sel, setSel] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [toast, setToast] = useState(null);
    const [downloadAnchor, setDownloadAnchor] = useState(null);
    const [subjects, setSubjects] = useState([]);

    const load = useCallback(() => {
        Promise.all([instituteService.getTeachers(), instituteService.getTimetable()])
            .then(([t, e]) => { setTeachers((t.data || []).filter((x) => x.isActive !== false)); setEntries(e.data || []); setLoading(false); })
            .catch((err) => { setError(err.response?.data?.message || err.message); setLoading(false); });
    }, []);
    useEffect(() => { setLoading(true); load(); }, [load]);

    // Canonical subject list for the session dialog — typing subjects freehand
    // is what produced the duplicate spellings in the first place.
    useEffect(() => {
        instituteService.getAttendanceMeta()
            .then((r) => setSubjects(r.data?.subjects || []))
            .catch(() => {});
    }, []);

    const grades = useMemo(() => [...new Set(entries.map((e) => e.gradeOrYear).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [entries]);

    // Default the selector to the first option when data loads.
    useEffect(() => {
        if (mode === 'teacher' && !sel && teachers.length) setSel(teachers[0]._id);
        if (mode === 'grade' && !sel && grades.length) setSel(grades[0]);
    }, [mode, sel, teachers, grades]);

    const filtered = useMemo(() => {
        if (mode === 'teacher') return entries.filter((e) => String(e.teacher) === String(sel));
        return entries.filter((e) => e.gradeOrYear === sel);
    }, [entries, mode, sel]);

    const byDay = useMemo(() => {
        const map = Object.fromEntries(DAYS.map((d) => [d, []]));
        for (const e of filtered) if (map[e.dayOfWeek]) map[e.dayOfWeek].push(e);
        for (const d of DAYS) map[d].sort((a, b) => (a.startMinutes ?? 9999) - (b.startMinutes ?? 9999));
        return map;
    }, [filtered]);

    const del = async (e) => {
        if (!window.confirm('Delete this session?')) return;
        try { await instituteService.deleteEntry(e._id); setToast({ severity: 'success', message: 'Session deleted' }); load(); }
        catch (err) { setToast({ severity: 'error', message: err.response?.data?.message || err.message }); }
    };

    // Exports the schedule currently on screen (the selected teacher / grade),
    // ordered the way the grid reads: day, then start time.
    const download = (kind) => {
        setDownloadAnchor(null);
        const ordered = DAYS.flatMap((d) => byDay[d]);
        const exportRows = ordered.map((e) => ({
            dayOfWeek: e.dayOfWeek, time: e.time, gradeOrYear: e.gradeOrYear,
            subject: e.subject, curriculum: e.curriculum, teacherName: e.teacherName,
            studentLabel: e.studentLabel,
        }));
        const cols = [
            { key: 'dayOfWeek', lbl: 'Day' },
            { key: 'time', lbl: 'Time' },
            { key: 'gradeOrYear', lbl: 'Grade / Year' },
            { key: 'subject', lbl: 'Subject' },
            { key: 'curriculum', lbl: 'Curriculum' },
            { key: 'teacherName', lbl: 'Teacher' },
            { key: 'studentLabel', lbl: 'Grade / Student' },
        ];
        exportRawSheet(exportRows, cols, 'institute-timetable', kind, { sheetName: 'Timetable' });
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <ToggleButtonGroup exclusive size="small" value={mode} onChange={(e, v) => { if (v) { setMode(v); setSel(''); } }}>
                    <ToggleButton value="teacher">By Teacher</ToggleButton>
                    <ToggleButton value="grade">By Grade / Year</ToggleButton>
                </ToggleButtonGroup>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>{mode === 'teacher' ? 'Teacher' : 'Grade / Year'}</InputLabel>
                    <Select label={mode === 'teacher' ? 'Teacher' : 'Grade / Year'} value={sel} onChange={(e) => setSel(e.target.value)}>
                        {mode === 'teacher'
                            ? teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)
                            : grades.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                </FormControl>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} disabled={!filtered.length} onClick={(e) => setDownloadAnchor(e.currentTarget)}>Export</Button>
                <Menu anchorEl={downloadAnchor} open={!!downloadAnchor} onClose={() => setDownloadAnchor(null)}>
                    <MenuItem onClick={() => download('xlsx')}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => download('csv')}>CSV (.csv)</MenuItem>
                </Menu>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditing(null); setDialogOpen(true); }}>New Session</Button>
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: '12px', p: 1.5, overflowX: 'auto' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${DAYS.length}, minmax(150px, 1fr))`, gap: 1 }}>
                    {DAYS.map((d) => (
                        <Box key={d}>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--d-text-3, #57564E)', mb: 1, textAlign: 'center' }}>{d.slice(0, 3)}</Typography>
                            {byDay[d].length ? byDay[d].map((e) => (
                                <SessionCard key={e._id} e={e} mode={mode} onEdit={(x) => { setEditing(x); setDialogOpen(true); }} onDelete={del} />
                            )) : <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #a3a3a3)', textAlign: 'center', mt: 1 }}>—</Typography>}
                        </Box>
                    ))}
                </Box>
            </Paper>

            <EntryDialog open={dialogOpen} entry={editing} teachers={teachers} subjects={subjects} onClose={() => setDialogOpen(false)}
                onSaved={() => { setToast({ severity: 'success', message: editing ? 'Session updated' : 'Session created' }); load(); }} />
            <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default TimetableTab;
