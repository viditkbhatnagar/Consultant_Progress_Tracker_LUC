import React, { useRef, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
    Alert, AlertTitle, CircularProgress, Chip, Divider, Table, TableBody, TableCell,
    TableHead, TableRow, Paper, TableContainer,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import instituteService from '../../services/instituteService';

const ACCEPT = '.xlsx,.xls';

// Upload a schedule workbook (one sheet per teacher) → preview what was read →
// confirm. The preview step matters: if a teacher's sheet is laid out
// differently, they see the misread BEFORE anything is written.
const ImportScheduleDialog = ({ open, onClose, onImported }) => {
    const inputRef = useRef(null);
    // Bumped on every reset/new pick so a slow in-flight preview can't land on
    // top of newer state (pick file A, cancel, pick B → A's response is stale).
    const requestRef = useRef(0);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState('');

    const reset = () => {
        requestRef.current += 1;
        setFile(null); setPreview(null); setError(''); setLoading(false); setApplying(false);
        if (inputRef.current) inputRef.current.value = '';
    };
    // Closing mid-preview is fine (the stale response is ignored); closing
    // mid-apply is not, since the write is already in flight.
    const close = () => { if (!applying) { reset(); onClose(); } };

    const pick = async (e) => {
        const f = e.target.files?.[0];
        // Clear the input immediately so re-picking the SAME filename still
        // fires a change event — that's the fix-the-sheet-and-retry loop.
        if (inputRef.current) inputRef.current.value = '';
        if (!f) return;
        const ticket = ++requestRef.current;
        setFile(f); setPreview(null); setError(''); setLoading(true);
        try {
            const res = await instituteService.importTimetable(f, { dryRun: true });
            if (requestRef.current !== ticket) return; // superseded
            setPreview(res.data);
        } catch (err) {
            if (requestRef.current !== ticket) return;
            setError(err.response?.data?.message || err.message || 'Could not read that file.');
        } finally {
            if (requestRef.current === ticket) setLoading(false);
        }
    };

    const apply = async () => {
        if (!file) return;
        setApplying(true); setError('');
        try {
            const res = await instituteService.importTimetable(file, { dryRun: false });
            const n = res.data?.inserted ?? 0;
            reset();
            onImported(`Imported ${n} session${n === 1 ? '' : 's'}`);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Import failed.');
            setApplying(false);
        }
    };

    return (
        <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>Upload Schedule</DialogTitle>
            <DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Typography sx={{ fontSize: 13, color: 'var(--d-text-3, #57564E)', mb: 2 }}>
                    Excel file with <strong>one sheet per teacher</strong> (the sheet name is the
                    teacher&apos;s name), and columns for Day, Time, Grade&nbsp;/&nbsp;Student,
                    Subject and Curriculum. You&apos;ll see what was read before anything is saved.
                </Typography>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={pick}
                    style={{ display: 'none' }}
                />
                <Button
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    onClick={() => inputRef.current?.click()}
                    disabled={loading || applying}
                >
                    {file ? 'Choose a different file' : 'Choose Excel file'}
                </Button>
                {file && (
                    <Typography component="span" sx={{ ml: 1.5, fontSize: 13, fontWeight: 600 }}>
                        {file.name}
                    </Typography>
                )}

                {loading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
                        <CircularProgress size={22} />
                        <Typography sx={{ fontSize: 13 }}>Reading the file…</Typography>
                    </Box>
                )}

                {preview && !loading && (
                    <>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                            <Chip label={`${preview.teachers.length} teacher${preview.teachers.length === 1 ? '' : 's'}`} sx={{ fontWeight: 700 }} />
                            <Chip label={`${preview.totalSessions} sessions`} sx={{ fontWeight: 700 }} />
                            {preview.grades.length > 0 && <Chip label={`${preview.grades.length} grades`} />}
                            {preview.subjects.length > 0 && <Chip label={`${preview.subjects.length} subjects`} />}
                        </Box>

                        {preview.replacingSessions > 0 && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                <AlertTitle sx={{ fontWeight: 700 }}>This replaces existing sessions</AlertTitle>
                                {preview.replacingSessions} existing session
                                {preview.replacingSessions === 1 ? '' : 's'} for these teachers will be
                                replaced by the {preview.totalSessions} in this file. Other teachers&apos;
                                schedules are not touched.
                            </Alert>
                        )}

                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '10px', mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ '& th': { bgcolor: 'var(--d-surface-muted, #f1efea)', fontWeight: 700 } }}>
                                        <TableCell>Teacher</TableCell>
                                        <TableCell align="right">Sessions</TableCell>
                                        <TableCell>Subjects</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {preview.teachers.map((t) => (
                                        <TableRow key={t.name}>
                                            <TableCell sx={{ fontWeight: 600 }}>
                                                {t.name}
                                                {t.isNew && (
                                                    <Chip label="new" size="small" sx={{ ml: 1, height: 18, fontSize: 10, fontWeight: 700 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">{t.sessions}</TableCell>
                                            <TableCell sx={{ fontSize: 12, color: 'var(--d-text-3, #57564E)' }}>
                                                {(t.subjects || []).join(', ') || '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {preview.grades.length > 0 && (
                            <Typography sx={{ fontSize: 12.5, color: 'var(--d-text-3, #57564E)', mb: 1 }}>
                                <strong>Grades:</strong> {preview.grades.join(', ')}
                            </Typography>
                        )}

                        {preview.warnings?.length > 0 && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <AlertTitle sx={{ fontWeight: 700 }}>Skipped sheets</AlertTitle>
                                {preview.warnings.map((w) => (
                                    <Typography key={w} sx={{ fontSize: 12.5 }}>{w}</Typography>
                                ))}
                            </Alert>
                        )}

                        {preview.unmatchedStudents?.length > 0 && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <AlertTitle sx={{ fontWeight: 700 }}>
                                    {preview.unmatchedStudents.length} name(s) not matched to a student record
                                </AlertTitle>
                                <Typography sx={{ fontSize: 12.5 }}>
                                    These still import and show on the timetable — they just aren&apos;t
                                    linked to a student profile: {preview.unmatchedStudents.join(', ')}
                                </Typography>
                            </Alert>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={close} disabled={applying} color="inherit">Cancel</Button>
                <Button
                    variant="contained"
                    onClick={apply}
                    disabled={!preview || loading || applying}
                >
                    {applying
                        ? 'Importing…'
                        : preview
                            ? `Import ${preview.totalSessions} session${preview.totalSessions === 1 ? '' : 's'}`
                            : 'Import'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ImportScheduleDialog;
