import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Paper, FormControl, InputLabel, Select, MenuItem, TextField, ToggleButtonGroup,
    ToggleButton, CircularProgress, Alert, Typography, Snackbar, Divider,
} from '@mui/material';
import instituteService from '../../services/instituteService';

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AttendanceTab = () => {
    const [meta, setMeta] = useState({ gradesOrYears: [], subjects: [] });
    const [gradeOrYear, setGradeOrYear] = useState('');
    const [subject, setSubject] = useState('');
    const [date, setDate] = useState(todayIso());
    const [rows, setRows] = useState([]); // { studentName, student, status }
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        instituteService.getAttendanceMeta()
            .then((res) => setMeta(res.data || { gradesOrYears: [], subjects: [] }))
            .catch(() => {});
    }, []);

    // Load roster + existing marks whenever grade/subject/date change.
    const loadRoster = useCallback(async () => {
        if (!gradeOrYear) { setRows([]); return; }
        setLoading(true);
        setError('');
        try {
            const [rosterRes, attRes] = await Promise.all([
                instituteService.getRoster(gradeOrYear),
                instituteService.getAttendance({ gradeOrYear, subject: subject || undefined, date }),
            ]);
            const existing = new Map((attRes.data || []).map((a) => [a.studentName, a.status]));
            const merged = (rosterRes.data || []).map((r) => ({
                studentName: r.studentName, student: r.student || null, status: existing.get(r.studentName) || '',
            }));
            // Include any marked names not in the roster.
            for (const a of attRes.data || []) {
                if (!merged.find((m) => m.studentName === a.studentName)) {
                    merged.push({ studentName: a.studentName, student: a.student || null, status: a.status });
                }
            }
            merged.sort((a, b) => a.studentName.localeCompare(b.studentName));
            setRows(merged);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [gradeOrYear, subject, date]);
    useEffect(() => { loadRoster(); }, [loadRoster]);

    const setStatus = (idx, status) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, status } : r)));
    const addStudent = () => {
        const nm = newName.trim();
        if (!nm) return;
        if (!rows.find((r) => r.studentName.toLowerCase() === nm.toLowerCase())) {
            setRows((p) => [...p, { studentName: nm, student: null, status: '' }].sort((a, b) => a.studentName.localeCompare(b.studentName)));
        }
        setNewName('');
    };

    const markedCount = useMemo(() => rows.filter((r) => r.status).length, [rows]);

    const save = async () => {
        if (!gradeOrYear) return setError('Pick a grade / year');
        const entries = rows.filter((r) => r.status).map((r) => ({ studentName: r.studentName, student: r.student, status: r.status }));
        if (!entries.length) return setError('Mark at least one student');
        setSaving(true); setError('');
        try {
            await instituteService.markAttendance({ date, gradeOrYear, subject, entries });
            setToast({ severity: 'success', message: `Saved attendance for ${entries.length} student(s)` });
            loadRoster();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        } finally {
            setSaving(false);
        }
    };

    const allPresent = () => setRows((p) => p.map((r) => ({ ...r, status: 'Present' })));

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Grade / Year</InputLabel>
                    <Select label="Grade / Year" value={gradeOrYear} onChange={(e) => setGradeOrYear(e.target.value)}>
                        {meta.gradesOrYears.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                        <MenuItem value=""><em>Any / none</em></MenuItem>
                        {meta.subjects.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                </FormControl>
                <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={allPresent} disabled={!rows.length}>All Present</Button>
                <Button variant="contained" size="small" onClick={save} disabled={saving || !gradeOrYear}>{saving ? 'Saving…' : 'Save Attendance'}</Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!gradeOrYear ? (
                <Alert severity="info">Pick a grade / year to load its roster.</Alert>
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : (
                <Paper variant="outlined" sx={{ borderRadius: '12px', p: 1.5 }}>
                    <Typography sx={{ fontSize: 12.5, color: '#57564E', mb: 1 }}>
                        {gradeOrYear}{subject ? ` · ${subject}` : ''} · {date} — {markedCount}/{rows.length} marked
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    {rows.length === 0 ? (
                        <Typography sx={{ color: '#8A887E', py: 2 }}>No students yet — add one below.</Typography>
                    ) : rows.map((r, idx) => (
                        <Box key={r.studentName} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid #f1efea' }}>
                            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                                {r.studentName}{!r.student && <Typography component="span" sx={{ fontSize: 10, color: '#a3a3a3', ml: 1 }}>(unlinked)</Typography>}
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={r.status} onChange={(e, v) => setStatus(idx, v || '')}>
                                <ToggleButton value="Present" sx={{ px: 1.5, '&.Mui-selected': { bgcolor: 'rgba(31,122,53,0.15)', color: '#1F7A35' } }}>Present</ToggleButton>
                                <ToggleButton value="Absent" sx={{ px: 1.5, '&.Mui-selected': { bgcolor: 'rgba(220,38,38,0.15)', color: '#DC2626' } }}>Absent</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    ))}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <TextField size="small" placeholder="Add student name…" value={newName} onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addStudent(); }} sx={{ minWidth: 220 }} />
                        <Button size="small" onClick={addStudent}>Add</Button>
                    </Box>
                </Paper>
            )}

            <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default AttendanceTab;
