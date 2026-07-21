import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Paper, FormControl, InputLabel, Select, MenuItem, TextField, ToggleButtonGroup,
    ToggleButton, CircularProgress, Alert, Typography, Snackbar, Divider, IconButton, Tooltip, Menu,
    Autocomplete,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import BackspaceIcon from '@mui/icons-material/BackspaceOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import instituteService from '../../services/instituteService';
import { exportRawSheet } from '../../services/xlsxBuilder';

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
    // Names that already have a SAVED mark for this (grade, subject, date) —
    // only those can have that single day's entry cancelled.
    const [savedNames, setSavedNames] = useState(new Set());
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);
    const [downloadAnchor, setDownloadAnchor] = useState(null);

    const [studentOptions, setStudentOptions] = useState([]);

    useEffect(() => {
        instituteService.getAttendanceMeta()
            .then((res) => setMeta(res.data || { gradesOrYears: [], subjects: [] }))
            .catch(() => {});
        // Real admission records, so an added student can be linked rather than
        // stored as a loose name.
        instituteService.getInstituteStudents()
            .then((res) => setStudentOptions(res.data || []))
            .catch(() => setStudentOptions([]));
    }, []);

    // Load roster + existing marks whenever grade/subject/date change. The
    // roster is scoped to the chosen subject, so a student only appears in the
    // subjects they actually attend.
    const loadRoster = useCallback(async () => {
        if (!gradeOrYear) { setRows([]); setSavedNames(new Set()); return; }
        setLoading(true);
        setError('');
        try {
            const [rosterRes, attRes] = await Promise.all([
                instituteService.getRoster(gradeOrYear, subject || undefined),
                instituteService.getAttendance({ gradeOrYear, subject: subject || undefined, date }),
            ]);
            const marks = attRes.data || [];
            const existing = new Map(marks.map((a) => [a.studentName, a.status]));
            setSavedNames(new Set(marks.map((a) => a.studentName)));
            const merged = (rosterRes.data || []).map((r) => ({
                studentName: r.studentName, student: r.student || null, status: existing.get(r.studentName) || '',
            }));
            // Include any marked names not in the roster.
            for (const a of marks) {
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

    // Cancel just this student's mark for this date — e.g. marked present on a
    // day the class never ran. Every other date they've been marked survives,
    // so they stay on the roster.
    const cancelEntry = async (studentName) => {
        if (!window.confirm(`Cancel ${studentName}'s attendance for ${date}${subject ? ` (${subject})` : ''}?\n\nOnly this one entry is removed — their other dates are kept.`)) return;
        try {
            await instituteService.deleteAttendanceEntry({ gradeOrYear, subject, date, studentName });
            setToast({ severity: 'success', message: `Cancelled ${studentName}'s mark for ${date}` });
            loadRoster();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        }
    };

    // With a subject selected this removes the student from that subject only.
    // With no subject it removes them from the whole grade/year — which is what
    // "get this student out of Grade 10" has to mean. Either way it clears
    // attendance AND test results in scope, because the roster is built from
    // both and leaving one behind puts the student straight back on the list.
    const removeStudent = async (studentName) => {
        const scopeLabel = subject ? `${gradeOrYear} · ${subject}` : `${gradeOrYear} (ALL subjects)`;
        const detail = subject
            ? `Their attendance and test results for ${subject} in ${gradeOrYear} will be deleted. Other subjects are not affected.`
            : `Their attendance and test results for EVERY subject in ${gradeOrYear} will be deleted. Other grades/years are not affected.`;
        if (!window.confirm(`Remove "${studentName}" from ${scopeLabel}?\n\n${detail}\n\nTo undo just one wrong date instead, use "Cancel this date's mark".`)) return;
        try {
            const res = await instituteService.removeRosterStudent({ gradeOrYear, subject, studentName });
            const { marksRemoved = 0, testsRemoved = 0 } = res.data || {};
            setToast({
                severity: 'success',
                message: `Removed ${studentName} from ${subject || gradeOrYear} — ${marksRemoved} attendance, ${testsRemoved} test record(s) deleted`,
            });
            loadRoster();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        }
    };

    // Adding is persisted immediately. It used to only touch local state, so a
    // student added but not ticked Present/Absent was never saved and vanished
    // on reload. `picked` carries the Student ref when chosen from the list,
    // which is what stops the row rendering as "(unlinked)".
    const addStudent = async (picked) => {
        const nm = (picked?.studentName || newName).trim();
        if (!nm) return;
        if (!subject) return setError('Pick a subject first — a student is added to one subject at a time.');
        if (rows.find((r) => r.studentName.toLowerCase() === nm.toLowerCase())) { setNewName(''); return; }
        try {
            await instituteService.addRosterStudent({
                gradeOrYear, subject, studentName: nm, student: picked?._id || null,
            });
            setNewName('');
            setToast({ severity: 'success', message: `${nm} added to ${gradeOrYear} · ${subject}` });
            loadRoster();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        }
    };

    const markedCount = useMemo(() => rows.filter((r) => r.status).length, [rows]);

    const save = async () => {
        if (!gradeOrYear) return setError('Pick a grade / year');
        // Attendance is per subject. Saving without one would write rows into a
        // blank-subject bucket that then shows up under every subject again —
        // the exact leak we're fixing. (Legacy blank-subject rows can still be
        // viewed under "Any / none" and cancelled row-by-row.)
        if (!subject) return setError('Pick a subject — attendance is marked per subject.');
        const entries = rows.filter((r) => r.status).map((r) => ({ studentName: r.studentName, student: r.student, status: r.status }));
        // Saving with nothing marked is how you clear a whole day that was
        // logged by mistake — allowed, but confirmed since it wipes the sitting.
        if (!entries.length) {
            if (!savedNames.size) return setError('Mark at least one student');
            if (!window.confirm(`Clear ALL attendance for ${gradeOrYear}${subject ? ` · ${subject}` : ''} on ${date}?`)) return;
        }
        setSaving(true); setError('');
        try {
            await instituteService.markAttendance({ date, gradeOrYear, subject, entries });
            setToast({
                severity: 'success',
                message: entries.length ? `Saved attendance for ${entries.length} student(s)` : 'Cleared attendance for this date',
            });
            loadRoster();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        } finally {
            setSaving(false);
        }
    };

    const allPresent = () => setRows((p) => p.map((r) => ({ ...r, status: 'Present' })));

    const download = (kind) => {
        setDownloadAnchor(null);
        const exportRows = rows.map((r) => ({
            date, gradeOrYear, subject: subject || '', studentName: r.studentName, status: r.status || 'Not marked',
        }));
        const cols = [
            { key: 'date', lbl: 'Date' },
            { key: 'gradeOrYear', lbl: 'Grade / Year' },
            { key: 'subject', lbl: 'Subject' },
            { key: 'studentName', lbl: 'Student' },
            { key: 'status', lbl: 'Status' },
        ];
        exportRawSheet(exportRows, cols, 'institute-attendance', kind, { sheetName: 'Attendance' });
    };

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
                <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} disabled={!rows.length} onClick={(e) => setDownloadAnchor(e.currentTarget)}>Export</Button>
                <Menu anchorEl={downloadAnchor} open={!!downloadAnchor} onClose={() => setDownloadAnchor(null)}>
                    <MenuItem onClick={() => download('xlsx')}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => download('csv')}>CSV (.csv)</MenuItem>
                </Menu>
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
                    <Typography sx={{ fontSize: 12.5, color: 'var(--d-text-3, #57564E)', mb: 1 }}>
                        {gradeOrYear}{subject ? ` · ${subject}` : ''} · {date} — {markedCount}/{rows.length} marked
                    </Typography>
                    {!subject && (
                        <Alert severity="info" sx={{ mb: 1, py: 0 }}>
                            Pick a subject to see only the students who take it. Students added here belong to the selected subject only.
                        </Alert>
                    )}
                    <Divider sx={{ mb: 1 }} />
                    {rows.length === 0 ? (
                        <Typography sx={{ color: 'var(--d-text-muted, #8A887E)', py: 2 }}>No students yet — add one below.</Typography>
                    ) : rows.map((r, idx) => (
                        <Box key={r.studentName} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid var(--d-border-soft, #f1efea)' }}>
                            <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                                {r.studentName}{!r.student && <Typography component="span" sx={{ fontSize: 10, color: 'var(--d-text-muted, #a3a3a3)', ml: 1 }}>(unlinked)</Typography>}
                            </Typography>
                            <ToggleButtonGroup exclusive size="small" value={r.status} onChange={(e, v) => setStatus(idx, v || '')}>
                                <ToggleButton value="Present" sx={{ px: 1.5, '&.Mui-selected': { bgcolor: 'rgba(31,122,53,0.15)', color: '#1F7A35' } }}>Present</ToggleButton>
                                <ToggleButton value="Absent" sx={{ px: 1.5, '&.Mui-selected': { bgcolor: 'rgba(220,38,38,0.15)', color: '#DC2626' } }}>Absent</ToggleButton>
                            </ToggleButtonGroup>
                            <Tooltip title={savedNames.has(r.studentName) ? "Cancel this date's mark (keeps the student)" : 'Nothing saved for this date'}>
                                <span>
                                    <IconButton size="small" disabled={!savedNames.has(r.studentName)} onClick={() => cancelEntry(r.studentName)}>
                                        <BackspaceIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title="Remove student from this grade / year (all dates)">
                                <IconButton size="small" onClick={() => removeStudent(r.studentName)}><DeleteIcon fontSize="small" /></IconButton>
                            </Tooltip>
                        </Box>
                    ))}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
                        <Autocomplete
                            freeSolo
                            size="small"
                            sx={{ minWidth: 320 }}
                            options={studentOptions}
                            getOptionLabel={(o) => (typeof o === 'string' ? o : o.studentName || '')}
                            filterOptions={(opts, state) => {
                                const q = state.inputValue.trim().toLowerCase();
                                if (!q) return opts.slice(0, 50);
                                return opts.filter((o) => (o.studentName || '').toLowerCase().includes(q)).slice(0, 50);
                            }}
                            renderOption={(props, o) => (
                                <li {...props} key={o._id}>
                                    <Box>
                                        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{o.studentName}</Typography>
                                        <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)' }}>
                                            {[o.yearOrGrade, (o.subjects || []).join(', ')].filter(Boolean).join(' · ')}
                                        </Typography>
                                    </Box>
                                </li>
                            )}
                            inputValue={newName}
                            onInputChange={(e, v) => setNewName(v)}
                            onChange={(e, v) => { if (v && typeof v !== 'string') addStudent(v); }}
                            renderInput={(params) => (
                                <TextField {...params} placeholder="Add student — pick from the list to link them…"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { e.preventDefault(); addStudent(null); } }} />
                            )}
                        />
                        <Button size="small" onClick={() => addStudent(null)} disabled={!newName.trim()}>Add</Button>
                        <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)' }}>
                            Picking from the list links the student to their admission record.
                        </Typography>
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
