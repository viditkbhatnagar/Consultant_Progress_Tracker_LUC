import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Chip, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Alert, Typography, Menu,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { format } from 'date-fns';
import instituteService from '../../services/instituteService';
import { exportRawSheet } from '../../services/xlsxBuilder';

const StatusChip = ({ status }) => (
    <Chip label={status} size="small" sx={{
        fontWeight: 700, fontSize: 11,
        color: status === 'Present' ? '#1F7A35' : '#DC2626',
        backgroundColor: status === 'Present' ? 'rgba(31,122,53,0.14)' : 'rgba(220,38,38,0.14)',
    }} />
);

// Per-student (or whole-grade) attendance report with an optional date range,
// summary, and Excel/CSV export — e.g. to send a student's record to parents.
const AttendanceReportTab = () => {
    const [meta, setMeta] = useState({ gradesOrYears: [], subjects: [] });
    const [gradeOrYear, setGradeOrYear] = useState('');
    const [roster, setRoster] = useState([]);
    const [studentName, setStudentName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [downloadAnchor, setDownloadAnchor] = useState(null);

    useEffect(() => {
        instituteService.getAttendanceMeta().then((r) => setMeta(r.data || { gradesOrYears: [], subjects: [] })).catch(() => {});
    }, []);

    // Roster for the student picker when the grade changes.
    useEffect(() => {
        if (!gradeOrYear) { setRoster([]); setStudentName(''); return; }
        instituteService.getRoster(gradeOrYear).then((r) => setRoster(r.data || [])).catch(() => setRoster([]));
        setStudentName('');
    }, [gradeOrYear]);

    const load = useCallback(async () => {
        if (!gradeOrYear) { setRows([]); return; }
        setLoading(true); setError('');
        try {
            const res = await instituteService.getAttendance({
                gradeOrYear,
                studentName: studentName || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            });
            const sorted = (res.data || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
            setRows(sorted);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [gradeOrYear, studentName, startDate, endDate]);
    useEffect(() => { load(); }, [load]);

    const summary = useMemo(() => {
        const present = rows.filter((r) => r.status === 'Present').length;
        const absent = rows.filter((r) => r.status === 'Absent').length;
        const total = present + absent;
        return { present, absent, total, pct: total ? Math.round((present / total) * 100) : 0 };
    }, [rows]);

    const download = (kind) => {
        setDownloadAnchor(null);
        const cols = [
            { key: 'date', lbl: 'Date', date: true },
            ...(studentName ? [] : [{ key: 'studentName', lbl: 'Student' }]),
            { key: 'subject', lbl: 'Subject' },
            { key: 'status', lbl: 'Status' },
        ];
        const base = `attendance-${(studentName || gradeOrYear).replace(/[^\w-]+/g, '_')}`;
        exportRawSheet(rows, cols, base, kind, { sheetName: 'Attendance' });
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Grade / Year</InputLabel>
                    <Select label="Grade / Year" value={gradeOrYear} onChange={(e) => setGradeOrYear(e.target.value)}>
                        {meta.gradesOrYears.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Student</InputLabel>
                    <Select label="Student" value={studentName} onChange={(e) => setStudentName(e.target.value)}>
                        <MenuItem value=""><em>All students</em></MenuItem>
                        {roster.map((r) => <MenuItem key={r.studentName} value={r.studentName}>{r.studentName}</MenuItem>)}
                    </Select>
                </FormControl>
                <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} disabled={!rows.length} onClick={(e) => setDownloadAnchor(e.currentTarget)}>Export</Button>
                <Menu anchorEl={downloadAnchor} open={!!downloadAnchor} onClose={() => setDownloadAnchor(null)}>
                    <MenuItem onClick={() => download('xlsx')}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => download('csv')}>CSV (.csv)</MenuItem>
                </Menu>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!gradeOrYear ? (
                <Alert severity="info">Pick a grade / year (and optionally a student + date range).</Alert>
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : (
                <>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                        <Chip label={`Present: ${summary.present}`} sx={{ fontWeight: 700, color: '#1F7A35', bgcolor: 'rgba(31,122,53,0.12)' }} />
                        <Chip label={`Absent: ${summary.absent}`} sx={{ fontWeight: 700, color: '#DC2626', bgcolor: 'rgba(220,38,38,0.12)' }} />
                        <Chip label={`Attendance: ${summary.pct}%`} sx={{ fontWeight: 700 }} />
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 12.5, color: 'var(--d-text-3, #57564E)', alignSelf: 'center' }}>{rows.length} records</Typography>
                    </Box>
                    {rows.length === 0 ? (
                        <Alert severity="info">No attendance found for this selection.</Alert>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { bgcolor: 'var(--d-surface-muted, #f1efea)', fontWeight: 700 } }}>
                                        <TableCell>Date</TableCell>
                                        {!studentName && <TableCell>Student</TableCell>}
                                        <TableCell>Subject</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((r) => (
                                        <TableRow key={r._id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{r.date ? format(new Date(r.date), 'dd MMM yyyy') : '—'}</TableCell>
                                            {!studentName && <TableCell>{r.studentName}</TableCell>}
                                            <TableCell>{r.subject || '—'}</TableCell>
                                            <TableCell><StatusChip status={r.status} /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}
        </Box>
    );
};

export default AttendanceReportTab;
