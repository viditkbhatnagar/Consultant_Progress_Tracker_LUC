import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box, Button, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Autocomplete, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip,
    CircularProgress, Alert, Typography, Snackbar, Menu, Dialog, DialogTitle, DialogContent,
    DialogActions, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { format } from 'date-fns';
import instituteService from '../../services/instituteService';
import { exportRawSheet } from '../../services/xlsxBuilder';

const CURRICULA = ['IGCSE', 'CBSE'];

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toIso = (d) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');
const pct = (r) => (r.maxMarks > 0 ? Math.round((r.marksObtained / r.maxMarks) * 100) : null);
const marksLabel = (r) => {
    const p = pct(r);
    if (r.maxMarks > 0) return `${r.marksObtained} / ${r.maxMarks}${p != null ? ` (${p}%)` : ''}`;
    return `${r.marksObtained}`;
};

// Tests are a single weekly sitting, so one date is enough — a From/To range
// only ever added two clicks for the same answer.
const EMPTY_FILTERS = { search: '', gradeOrYear: '', subject: '', teacherName: '', date: '' };

// ── Bulk entry: record one test for a whole grade at once ──────────────────
const RecordTestDialog = ({ open, meta, teachers, onClose, onSaved }) => {
    const [head, setHead] = useState({
        gradeOrYear: '', curriculum: '', subject: '', testTopic: '', date: todayIso(), maxMarks: '', teacher: '',
    });
    // roster + existing load only on grade/date (network); subject/topic filter
    // and mark edits are purely client-side, so typing never refetches.
    const [roster, setRoster] = useState([]);
    const [existing, setExisting] = useState([]);
    const [marks, setMarks] = useState({}); // studentName -> string
    const [manualNames, setManualNames] = useState([]);
    const [newName, setNewName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    // Names the user has actually typed a mark for. Held in a ref so the
    // marks-rebuild effect can read it without re-firing on every keystroke.
    // Their input is preserved across subject/topic/date changes — only
    // untouched, pre-filled marks get refreshed from the server rows.
    const touchedRef = useRef(new Set());

    const setH = (k, v) => setHead((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        if (!open) return;
        setHead({ gradeOrYear: '', curriculum: '', subject: '', testTopic: '', date: todayIso(), maxMarks: '', teacher: '' });
        setRoster([]); setExisting([]); setMarks({}); setManualNames([]); setNewName(''); setError('');
        touchedRef.current = new Set();
    }, [open]);

    // Roster + any results already recorded for this grade on this date.
    // A fresh grade/date is a clean slate, so drop prior manual names + touches.
    useEffect(() => {
        if (!open || !head.gradeOrYear) { setRoster([]); setExisting([]); setManualNames([]); touchedRef.current = new Set(); return; }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [rosterRes, existingRes] = await Promise.all([
                    instituteService.getRoster(head.gradeOrYear),
                    instituteService.getTests({ gradeOrYear: head.gradeOrYear, date: head.date || undefined }),
                ]);
                if (cancelled) return;
                setRoster(rosterRes.data || []);
                setExisting(existingRes.data || []);
                setManualNames([]);
                touchedRef.current = new Set();
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, head.gradeOrYear, head.date]);

    // Rows already recorded for THIS (subject, topic) — client-side filter.
    const existingForKey = useMemo(
        () => existing.filter((r) => (r.subject || '') === head.subject.trim() && (r.testTopic || '') === head.testTopic.trim()),
        [existing, head.subject, head.testTopic]
    );

    // Refresh the pre-filled marks from the server rows that match the current
    // (subject, topic) key — but NEVER discard a mark the user has typed. Marks
    // the user touched are carried over verbatim; untouched ones are replaced
    // by (or cleared to match) the matching server rows. This is what prevents
    // "type marks → then fill Subject" from silently wiping the input.
    useEffect(() => {
        setMarks((prev) => {
            const next = {};
            for (const r of existingForKey) next[r.studentName] = String(r.marksObtained);
            for (const name of touchedRef.current) {
                if (prev[name] !== undefined) next[name] = prev[name];
            }
            return next;
        });
        const sample = existingForKey[0];
        if (sample) {
            setHead((p) => ({
                ...p,
                maxMarks: p.maxMarks === '' && sample.maxMarks != null ? String(sample.maxMarks) : p.maxMarks,
                curriculum: p.curriculum || sample.curriculum || '',
            }));
        }
    }, [existingForKey]);

    // Union of roster names, already-recorded names for this key, and any names
    // typed in ad-hoc — one editable row each.
    const rows = useMemo(() => {
        const names = new Set([
            ...roster.map((r) => r.studentName),
            ...existingForKey.map((r) => r.studentName),
            ...manualNames,
        ].filter(Boolean));
        const refByName = new Map(roster.map((r) => [r.studentName, r.student || null]));
        for (const r of existingForKey) if (r.student && !refByName.get(r.studentName)) refByName.set(r.studentName, r.student);
        return [...names]
            .sort((a, b) => a.localeCompare(b))
            .map((studentName) => ({ studentName, student: refByName.get(studentName) || null }));
    }, [roster, existingForKey, manualNames]);

    const setMark = (name, v) => {
        touchedRef.current.add(name);
        setMarks((p) => ({ ...p, [name]: v }));
    };
    const addStudent = () => {
        const nm = newName.trim();
        if (!nm) return;
        if (!rows.find((r) => r.studentName.toLowerCase() === nm.toLowerCase())) {
            setManualNames((p) => [...p, nm]);
        }
        setNewName('');
    };

    const enteredCount = useMemo(
        () => rows.filter((r) => String(marks[r.studentName] ?? '').trim() !== '').length,
        [rows, marks]
    );

    const save = async () => {
        if (!head.gradeOrYear) return setError('Pick a grade / year');
        if (!head.subject.trim()) return setError('Subject is required');
        const teacher = teachers.find((t) => t._id === head.teacher);
        const entries = rows
            .filter((r) => String(marks[r.studentName] ?? '').trim() !== '' && !Number.isNaN(Number(marks[r.studentName])))
            .map((r) => ({ studentName: r.studentName, student: r.student, marksObtained: Number(marks[r.studentName]) }));
        if (!entries.length) return setError('Enter marks for at least one student');
        setSaving(true); setError('');
        try {
            await instituteService.saveTests({
                date: head.date,
                gradeOrYear: head.gradeOrYear,
                curriculum: head.curriculum,
                subject: head.subject.trim(),
                testTopic: head.testTopic.trim(),
                maxMarks: head.maxMarks === '' ? null : Number(head.maxMarks),
                teacher: teacher?._id || null,
                teacherName: teacher?.name || '',
                entries,
            });
            onSaved(entries.length);
            onClose();
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Record Test</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Grade / Year</InputLabel>
                        <Select label="Grade / Year" value={head.gradeOrYear} onChange={(e) => setH('gradeOrYear', e.target.value)}>
                            {meta.gradesOrYears.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Autocomplete freeSolo options={CURRICULA} value={head.curriculum}
                        onChange={(e, v) => setH('curriculum', v || '')}
                        onInputChange={(e, v) => setH('curriculum', v)}
                        renderInput={(params) => <TextField {...params} size="small" label="Curriculum (IGCSE / CBSE)" />} />
                    <Autocomplete freeSolo options={meta.subjects} value={head.subject}
                        onChange={(e, v) => setH('subject', v || '')}
                        onInputChange={(e, v) => setH('subject', v)}
                        renderInput={(params) => <TextField {...params} size="small" label="Subject" />} />
                    <TextField size="small" label="Test Topic" value={head.testTopic} onChange={(e) => setH('testTopic', e.target.value)} placeholder="e.g. Algebra — Quadratics" />
                    <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={head.date} onChange={(e) => setH('date', e.target.value)} />
                    <TextField size="small" type="number" label="Max Marks (optional)" value={head.maxMarks} onChange={(e) => setH('maxMarks', e.target.value)} inputProps={{ min: 0 }} />
                    <FormControl fullWidth size="small" sx={{ gridColumn: '1 / -1' }}>
                        <InputLabel>Teacher</InputLabel>
                        <Select label="Teacher" value={head.teacher} onChange={(e) => setH('teacher', e.target.value)}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                <Divider sx={{ mb: 1 }} />
                {!head.gradeOrYear ? (
                    <Typography sx={{ color: 'var(--d-text-muted, #8A887E)', py: 2 }}>Pick a grade / year to load its students.</Typography>
                ) : loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                ) : (
                    <>
                        <Typography sx={{ fontSize: 12.5, color: 'var(--d-text-3, #57564E)', mb: 1 }}>
                            {enteredCount}/{rows.length} marks entered{head.maxMarks ? ` · out of ${head.maxMarks}` : ''}
                        </Typography>
                        {rows.length === 0 ? (
                            <Typography sx={{ color: 'var(--d-text-muted, #8A887E)', py: 1 }}>No students yet — add one below.</Typography>
                        ) : rows.map((r) => (
                            <Box key={r.studentName} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderBottom: '1px solid var(--d-border-soft, #f1efea)' }}>
                                <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                                    {r.studentName}{!r.student && <Typography component="span" sx={{ fontSize: 10, color: 'var(--d-text-muted, #a3a3a3)', ml: 1 }}>(unlinked)</Typography>}
                                </Typography>
                                <TextField size="small" type="number" placeholder="—" value={marks[r.studentName] ?? ''}
                                    onChange={(e) => setMark(r.studentName, e.target.value)} inputProps={{ min: 0, style: { width: 70 } }} />
                            </Box>
                        ))}
                        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                            <TextField size="small" placeholder="Add student name…" value={newName} onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }} sx={{ minWidth: 220 }} />
                            <Button size="small" onClick={addStudent}>Add</Button>
                        </Box>
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
                <Button onClick={save} disabled={saving || !head.gradeOrYear} variant="contained">{saving ? 'Saving…' : 'Save Test'}</Button>
            </DialogActions>
        </Dialog>
    );
};

// ── Single-row edit (fix a mark / topic / teacher) ─────────────────────────
const EditTestDialog = ({ open, row, teachers, onClose, onSaved }) => {
    const [f, setF] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!open || !row) return;
        setF({
            studentName: row.studentName || '', curriculum: row.curriculum || '', subject: row.subject || '',
            testTopic: row.testTopic || '', marksObtained: String(row.marksObtained ?? ''),
            maxMarks: row.maxMarks != null ? String(row.maxMarks) : '', date: toIso(row.date),
            teacher: row.teacher || '',
        });
        setError('');
    }, [open, row]);
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
    const save = async () => {
        if (String(f.marksObtained).trim() === '' || Number.isNaN(Number(f.marksObtained))) return setError('Marks obtained is required');
        setSaving(true); setError('');
        try {
            const teacher = teachers.find((t) => t._id === f.teacher);
            await instituteService.updateTest(row._id, {
                studentName: f.studentName.trim(), curriculum: f.curriculum, subject: f.subject,
                testTopic: f.testTopic, marksObtained: Number(f.marksObtained),
                maxMarks: f.maxMarks === '' ? null : Number(f.maxMarks), date: f.date,
                teacher: teacher?._id || null, teacherName: teacher?.name ?? row.teacherName ?? '',
            });
            onSaved(); onClose();
        } catch (e) { setError(e.response?.data?.message || e.message); } finally { setSaving(false); }
    };
    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Edit Test Result</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField size="small" label="Student" value={f.studentName || ''} onChange={set('studentName')} sx={{ gridColumn: '1 / -1' }} />
                    <TextField size="small" label="Subject" value={f.subject || ''} onChange={set('subject')} />
                    <TextField size="small" label="Curriculum" value={f.curriculum || ''} onChange={set('curriculum')} />
                    <TextField size="small" label="Test Topic" value={f.testTopic || ''} onChange={set('testTopic')} sx={{ gridColumn: '1 / -1' }} />
                    <TextField size="small" type="number" label="Marks Obtained" value={f.marksObtained || ''} onChange={set('marksObtained')} inputProps={{ min: 0 }} />
                    <TextField size="small" type="number" label="Max Marks" value={f.maxMarks || ''} onChange={set('maxMarks')} inputProps={{ min: 0 }} />
                    <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={f.date || ''} onChange={set('date')} />
                    <FormControl fullWidth size="small">
                        <InputLabel>Teacher</InputLabel>
                        <Select label="Teacher" value={f.teacher || ''} onChange={set('teacher')}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map((t) => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
                <Button onClick={save} disabled={saving} variant="contained">{saving ? 'Saving…' : 'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
};

const TestsTab = () => {
    const [meta, setMeta] = useState({ gradesOrYears: [], subjects: [] });
    const [teachers, setTeachers] = useState([]);
    const [rows, setRows] = useState([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [recordOpen, setRecordOpen] = useState(false);
    const [editRow, setEditRow] = useState(null);
    const [toast, setToast] = useState(null);
    const [downloadAnchor, setDownloadAnchor] = useState(null);

    const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

    useEffect(() => {
        instituteService.getTestMeta().then((r) => setMeta(r.data || { gradesOrYears: [], subjects: [] })).catch(() => {});
        instituteService.getTeachers().then((r) => setTeachers((r.data || []).filter((t) => t.isActive !== false))).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await instituteService.getTests({
                gradeOrYear: filters.gradeOrYear || undefined,
                subject: filters.subject || undefined,
                teacherName: filters.teacherName || undefined,
                date: filters.date || undefined,
            });
            setRows(res.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [filters.gradeOrYear, filters.subject, filters.teacherName, filters.date]);
    useEffect(() => { load(); }, [load]);

    // Student search is client-side (substring, case-insensitive).
    const visible = useMemo(() => {
        const q = filters.search.trim().toLowerCase();
        return q ? rows.filter((r) => (r.studentName || '').toLowerCase().includes(q)) : rows;
    }, [rows, filters.search]);

    const summary = useMemo(() => {
        const withMax = visible.filter((r) => r.maxMarks > 0);
        const avg = withMax.length
            ? Math.round(withMax.reduce((s, r) => s + (r.marksObtained / r.maxMarks) * 100, 0) / withMax.length)
            : null;
        return { count: visible.length, avg };
    }, [visible]);

    const remove = async (row) => {
        if (!window.confirm(`Delete ${row.studentName}'s result for "${row.testTopic || row.subject}"?`)) return;
        try {
            await instituteService.deleteTest(row._id);
            setToast({ severity: 'success', message: 'Result deleted' });
            load();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        }
    };

    const download = (kind) => {
        setDownloadAnchor(null);
        const exportRows = visible.map((r) => ({
            date: r.date, studentName: r.studentName, gradeOrYear: r.gradeOrYear, curriculum: r.curriculum,
            subject: r.subject, testTopic: r.testTopic, marksObtained: r.marksObtained,
            maxMarks: r.maxMarks ?? '', percentage: pct(r) ?? '', teacherName: r.teacherName,
        }));
        const cols = [
            { key: 'date', lbl: 'Date', date: true },
            { key: 'studentName', lbl: 'Student' },
            { key: 'gradeOrYear', lbl: 'Grade / Year' },
            { key: 'curriculum', lbl: 'Curriculum' },
            { key: 'subject', lbl: 'Subject' },
            { key: 'testTopic', lbl: 'Test Topic' },
            { key: 'marksObtained', lbl: 'Marks Obtained' },
            { key: 'maxMarks', lbl: 'Max Marks' },
            { key: 'percentage', lbl: 'Percentage' },
            { key: 'teacherName', lbl: 'Teacher' },
        ];
        exportRawSheet(exportRows, cols, 'institute-tests', kind, { sheetName: 'Tests' });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <TextField size="small" label="Search student" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} sx={{ minWidth: 180 }} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Grade / Year</InputLabel>
                    <Select label="Grade / Year" value={filters.gradeOrYear} onChange={(e) => setFilter('gradeOrYear', e.target.value)}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {meta.gradesOrYears.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select label="Subject" value={filters.subject} onChange={(e) => setFilter('subject', e.target.value)}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {meta.subjects.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Teacher</InputLabel>
                    <Select label="Teacher" value={filters.teacherName} onChange={(e) => setFilter('teacherName', e.target.value)}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {teachers.map((t) => <MenuItem key={t._id} value={t.name}>{t.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={filters.date} onChange={(e) => setFilter('date', e.target.value)} />
                <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</Button>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} disabled={!visible.length} onClick={(e) => setDownloadAnchor(e.currentTarget)}>Export</Button>
                <Menu anchorEl={downloadAnchor} open={!!downloadAnchor} onClose={() => setDownloadAnchor(null)}>
                    <MenuItem onClick={() => download('xlsx')}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => download('csv')}>CSV (.csv)</MenuItem>
                    <MenuItem onClick={() => download('pdf')}>PDF (.pdf)</MenuItem>
                </Menu>
                <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setRecordOpen(true)}>Record Test</Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Chip label={`${summary.count} results`} sx={{ fontWeight: 700 }} />
                {summary.avg != null && <Chip label={`Avg: ${summary.avg}%`} sx={{ fontWeight: 700 }} />}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : visible.length === 0 ? (
                <Alert severity="info">No test results match these filters. Use “Record Test” to add one.</Alert>
            ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow sx={{ '& th': { bgcolor: 'var(--d-surface-muted, #f1efea)', fontWeight: 700 } }}>
                                <TableCell>Date</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Grade</TableCell>
                                <TableCell>Curriculum</TableCell>
                                <TableCell>Subject</TableCell>
                                <TableCell>Test Topic</TableCell>
                                <TableCell>Marks</TableCell>
                                <TableCell>Teacher</TableCell>
                                <TableCell align="right" />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((r) => (
                                <TableRow key={r._id} hover>
                                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.date ? format(new Date(r.date), 'dd MMM yyyy') : '—'}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{r.studentName}</TableCell>
                                    <TableCell>{r.gradeOrYear || '—'}</TableCell>
                                    <TableCell>{r.curriculum || '—'}</TableCell>
                                    <TableCell>{r.subject || '—'}</TableCell>
                                    <TableCell>{r.testTopic || '—'}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{marksLabel(r)}</TableCell>
                                    <TableCell>{r.teacherName || '—'}</TableCell>
                                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                        <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditRow(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                        <Tooltip title="Delete"><IconButton size="small" onClick={() => remove(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <RecordTestDialog open={recordOpen} meta={meta} teachers={teachers}
                onClose={() => setRecordOpen(false)}
                onSaved={(n) => { setToast({ severity: 'success', message: `Saved ${n} result${n === 1 ? '' : 's'}` }); load(); instituteService.getTestMeta().then((r) => setMeta(r.data || meta)).catch(() => {}); }} />
            <EditTestDialog open={!!editRow} row={editRow} teachers={teachers}
                onClose={() => setEditRow(null)}
                onSaved={() => { setToast({ severity: 'success', message: 'Result updated' }); load(); }} />

            <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default TestsTab;
