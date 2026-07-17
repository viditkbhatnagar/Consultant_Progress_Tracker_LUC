import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TextField, FormControl, InputLabel, Select, MenuItem, IconButton, Tooltip,
    CircularProgress, Alert, Typography, Snackbar, Menu,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import { useAdminOrgScope } from '../utils/adminOrgScope';
import { resolveViewOrg } from '../utils/hourlyConfig';
import AdminSidebar from '../components/AdminSidebar';
import SkillhubSidebar from '../components/skillhub/SkillhubSidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import StatusPill from '../components/meetings/StatusPill';
import SkillhubMeetingDialog from '../components/skillhub/SkillhubMeetingDialog';
import meetingService from '../services/meetingService';
import consultantService from '../services/consultantService';
import instituteService from '../services/instituteService';
import { exportRawSheet } from '../services/xlsxBuilder';
import { MEETING_MODES } from '../utils/constants';
import { ALL_STATUSES } from '../utils/meetingDesign';

// Server also caps at 20k. Meeting volume per branch is far below this, so
// we pull the whole filtered set and slice client-side.
const SHOW_ALL_LIMIT = 20000;
const EMPTY_FILTERS = { search: '', status: '', mode: '', demoDoneBy: '', startDate: '', endDate: '' };

// Skillhub meeting tracker. Institute-shaped: no LUC Program column, plus
// "Demo done by" (which teacher delivered the demo). Shares the Meeting
// model/API with LUC — the server scopes every read/write to the branch.
const SkillhubMeetingTrackerPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('skillhub-theme-mode');
    const [adminOrgScope] = useAdminOrgScope();
    const isAdmin = user?.role === 'admin';
    const viewOrg = resolveViewOrg(user, adminOrgScope);
    const isInstitute = viewOrg === 'skillhub_institute';

    const [rows, setRows] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dialog, setDialog] = useState({ open: false, meeting: null });
    const [toast, setToast] = useState(null);
    const [downloadAnchor, setDownloadAnchor] = useState(null);

    const setFilter = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await meetingService.getMeetings({
                limit: SHOW_ALL_LIMIT,
                organization: isAdmin ? viewOrg : undefined,
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
                status: filters.status || undefined,
                mode: filters.mode || undefined,
                search: filters.search || undefined,
            });
            setRows(res.data || []);
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, viewOrg, filters.startDate, filters.endDate, filters.status, filters.mode, filters.search]);
    useEffect(() => { load(); }, [load]);

    // Counselors feed the form's owner picker; teachers feed "Demo done by".
    // Teachers are Institute-only — the endpoint 403s for a Training login.
    useEffect(() => {
        consultantService.getConsultants(isAdmin ? { organization: viewOrg } : {})
            .then((r) => setConsultants(r.data || []))
            .catch(() => setConsultants([]));
    }, [isAdmin, viewOrg]);
    useEffect(() => {
        if (!isInstitute) { setTeachers([]); return; }
        instituteService.getTeachers()
            .then((r) => setTeachers(r.data || []))
            .catch(() => setTeachers([]));
    }, [isInstitute]);

    // "Demo done by" isn't a server-side filter — the rest already are.
    const visible = useMemo(() => {
        const list = filters.demoDoneBy
            ? rows.filter((r) => (r.demoDoneBy || '') === filters.demoDoneBy)
            : rows;
        return list.slice().sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));
    }, [rows, filters.demoDoneBy]);

    const kpis = useMemo(() => {
        const now = new Date();
        const thisMonth = visible.filter((r) => {
            const d = new Date(r.meetingDate);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        return {
            total: visible.length,
            thisMonth,
            demos: visible.filter((r) => !!r.demoDoneBy).length,
            admissions: visible.filter((r) => r.status === 'Admission').length,
        };
    }, [visible]);

    const remove = async (row) => {
        if (!window.confirm(`Delete the meeting logged for "${row.studentName}"?`)) return;
        try {
            await meetingService.deleteMeeting(row._id);
            setToast({ severity: 'success', message: 'Meeting deleted' });
            load();
        } catch (e) {
            setToast({ severity: 'error', message: e.response?.data?.message || e.message });
        }
    };

    const download = (kind) => {
        setDownloadAnchor(null);
        const cols = [
            { key: 'meetingDate', lbl: 'Date', date: true },
            { key: 'studentName', lbl: 'Student' },
            { key: 'mode', lbl: 'Mode' },
            { key: 'status', lbl: 'Status' },
            ...(isInstitute ? [{ key: 'demoDoneBy', lbl: 'Demo Done By' }] : []),
            { key: 'consultantName', lbl: 'Counselor' },
            { key: 'remarks', lbl: 'Remarks' },
        ];
        exportRawSheet(visible, cols, 'skillhub-meetings', kind, { sheetName: 'Meetings' });
    };

    const handleLogout = () => { logout(); navigate('/login'); };
    const sidebar = isAdmin ? (
        <AdminSidebar onLogout={handleLogout} onDashboard={() => navigate('/admin/dashboard')} />
    ) : (
        <SkillhubSidebar
            activeView="meetings"
            onNavigate={() => navigate('/skillhub/dashboard')}
            onNewAdmission={() => navigate('/skillhub/dashboard')}
            onLogout={handleLogout}
        />
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow={isInstitute ? 'Skillhub Institute' : 'Skillhub Training'}
                title="Meeting Tracker"
                subtitle="Demos, meetings and their outcomes"
                right={
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, meeting: null })}>
                        Log Meeting
                    </Button>
                }
            />

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`Total: ${kpis.total}`} sx={{ fontWeight: 700 }} />
                <Chip label={`This month: ${kpis.thisMonth}`} sx={{ fontWeight: 700 }} />
                {isInstitute && <Chip label={`Demos: ${kpis.demos}`} sx={{ fontWeight: 700 }} />}
                <Chip label={`Admissions: ${kpis.admissions}`} sx={{ fontWeight: 700, color: '#1F7A35', bgcolor: 'rgba(31,122,53,0.12)' }} />
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <TextField
                    size="small" label="Search student" value={filters.search}
                    onChange={(e) => setFilter('search', e.target.value)} sx={{ minWidth: 190 }}
                />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {ALL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Mode</InputLabel>
                    <Select label="Mode" value={filters.mode} onChange={(e) => setFilter('mode', e.target.value)}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {MEETING_MODES.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                    </Select>
                </FormControl>
                {isInstitute && (
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Demo done by</InputLabel>
                        <Select label="Demo done by" value={filters.demoDoneBy} onChange={(e) => setFilter('demoDoneBy', e.target.value)}>
                            <MenuItem value=""><em>All</em></MenuItem>
                            {teachers.map((t) => <MenuItem key={t._id} value={t.name}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                    value={filters.startDate} onChange={(e) => setFilter('startDate', e.target.value)} />
                <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                    value={filters.endDate} onChange={(e) => setFilter('endDate', e.target.value)} />
                <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</Button>
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} disabled={!visible.length}
                    onClick={(e) => setDownloadAnchor(e.currentTarget)}>Export</Button>
                <Menu anchorEl={downloadAnchor} open={!!downloadAnchor} onClose={() => setDownloadAnchor(null)}>
                    <MenuItem onClick={() => download('xlsx')}>Excel (.xlsx)</MenuItem>
                    <MenuItem onClick={() => download('csv')}>CSV (.csv)</MenuItem>
                </Menu>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : (
                <>
                    <Typography sx={{ fontSize: 12.5, color: 'var(--d-text-3, #57564E)', mb: 1 }}>
                        Showing {visible.length} meeting{visible.length === 1 ? '' : 's'}
                    </Typography>
                    {visible.length === 0 ? (
                        <Alert severity="info">No meetings match these filters.</Alert>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px' }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { bgcolor: 'var(--d-surface-muted, #f1efea)', fontWeight: 700 } }}>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Student</TableCell>
                                        <TableCell>Mode</TableCell>
                                        <TableCell>Status</TableCell>
                                        {isInstitute && <TableCell>Demo done by</TableCell>}
                                        <TableCell>Counselor</TableCell>
                                        <TableCell>Remarks</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {visible.map((r) => (
                                        <TableRow key={r._id} hover>
                                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                {r.meetingDate ? format(new Date(r.meetingDate), 'dd MMM yyyy') : '—'}
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{r.studentName}</TableCell>
                                            <TableCell>{r.mode}</TableCell>
                                            <TableCell><StatusPill status={r.status} size="sm" /></TableCell>
                                            {isInstitute && <TableCell>{r.demoDoneBy || '—'}</TableCell>}
                                            <TableCell>{r.consultantName || '—'}</TableCell>
                                            <TableCell sx={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                <Tooltip title={r.remarks || ''}><span>{r.remarks || '—'}</span></Tooltip>
                                            </TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => setDialog({ open: true, meeting: r })}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {isAdmin && (
                                                    <Tooltip title="Delete">
                                                        <IconButton size="small" onClick={() => remove(r)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}

            <SkillhubMeetingDialog
                open={dialog.open}
                meeting={dialog.meeting}
                consultants={consultants}
                teachers={teachers}
                isInstitute={isInstitute}
                isAdmin={isAdmin}
                viewOrg={viewOrg}
                onClose={() => setDialog({ open: false, meeting: null })}
                onSaved={() => {
                    setDialog({ open: false, meeting: null });
                    setToast({ severity: 'success', message: 'Meeting saved' });
                    load();
                }}
            />

            <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={toast?.severity || 'info'} onClose={() => setToast(null)}>{toast?.message}</Alert>
            </Snackbar>
        </DashboardShell>
    );
};

export default SkillhubMeetingTrackerPage;
