import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    MenuItem,
    Chip,
    CircularProgress,
    Tooltip,
    Snackbar,
    Alert,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Logout as LogoutIcon,
    Videocam as VideocamIcon,
    DirectionsCar as DirectionsCarIcon,
    Business as BusinessIcon,
    School as SchoolIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import meetingService from '../services/meetingService';
import userService from '../services/userService';
import { LEAD_STAGES, MEETING_MODES, getLeadStageColor } from '../utils/constants';
import MeetingFormDialog from '../components/MeetingFormDialog';

const MODE_ICONS = {
    Zoom: { Icon: VideocamIcon, color: '#4f46e5' },
    'Out Meeting': { Icon: DirectionsCarIcon, color: '#7c3aed' },
    'Office Meeting': { Icon: BusinessIcon, color: '#16a34a' },
    'Student Meeting': { Icon: SchoolIcon, color: '#ea580c' },
};

const PAGE_SIZE = 20;

const MeetingTrackerPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const [filters, setFilters] = useState({
        startDate: null,
        endDate: null,
        teamLead: '',
        status: '',
        mode: '',
    });

    const [teamLeads, setTeamLeads] = useState([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);

    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

    const loadTeamLeads = useCallback(async () => {
        if (!isAdmin) return;
        try {
            // Force org=luc so the global admin-org interceptor doesn't scope
            // this to Skillhub if that's the admin's last-used tab.
            const res = await userService.getUsers({ organization: 'luc' });
            const all = res.data || res || [];
            setTeamLeads(
                all.filter(
                    (u) =>
                        u.role === 'team_lead' &&
                        (u.organization || 'luc') === 'luc' &&
                        u.isActive !== false
                )
            );
        } catch (_e) {
            setTeamLeads([]);
        }
    }, [isAdmin]);

    const loadMeetings = useCallback(async () => {
        setLoading(true);
        setFetchError('');
        try {
            const res = await meetingService.getMeetings({
                page: page + 1,
                limit: PAGE_SIZE,
                // Meeting Tracker is LUC-only. Pin the scope explicitly so the
                // admin-org interceptor can't narrow this down to a Skillhub
                // tab accidentally.
                organization: 'luc',
                startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
                endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
                teamLead: filters.teamLead || undefined,
                status: filters.status || undefined,
                mode: filters.mode || undefined,
            });
            setRows(res.data || []);
            setTotal(res.pagination?.total || 0);
        } catch (err) {
            setFetchError(err?.response?.data?.message || err?.message || 'Failed to load meetings');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [page, filters]);

    useEffect(() => {
        loadTeamLeads();
    }, [loadTeamLeads]);

    useEffect(() => {
        loadMeetings();
    }, [loadMeetings]);

    const handleFilterChange = (field) => (event) => {
        setPage(0);
        setFilters((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleDateFilterChange = (field) => (date) => {
        setPage(0);
        setFilters((prev) => ({ ...prev, [field]: date }));
    };

    const clearFilters = () => {
        setPage(0);
        setFilters({ startDate: null, endDate: null, teamLead: '', status: '', mode: '' });
    };

    const openCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setDialogOpen(true);
    };

    const handleSubmit = async (data) => {
        if (editing) {
            await meetingService.updateMeeting(editing._id, data);
            setSnack({ open: true, message: 'Meeting updated', severity: 'success' });
        } else {
            await meetingService.createMeeting(data);
            setSnack({ open: true, message: 'Meeting created', severity: 'success' });
        }
        await loadMeetings();
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete meeting for ${row.studentName}?`)) return;
        try {
            await meetingService.deleteMeeting(row._id);
            setSnack({ open: true, message: 'Meeting deleted', severity: 'success' });
            // If we just deleted the last row on this page, step back a page.
            if (rows.length === 1 && page > 0) {
                setPage(page - 1);
            } else {
                loadMeetings();
            }
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Delete failed',
                severity: 'error',
            });
        }
    };

    const handleBack = () => {
        if (isAdmin) navigate('/admin/dashboard');
        else if (user?.role === 'team_lead') navigate('/team-lead/dashboard');
        else navigate('/');
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ minHeight: '100vh', backgroundColor: '#A0D2EB' }}>
                <Box
                    sx={{
                        backgroundColor: '#1976d2',
                        color: 'white',
                        py: 2,
                        px: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton onClick={handleBack} sx={{ color: 'white' }} aria-label="Back">
                            <ArrowBackIcon />
                        </IconButton>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Meeting Tracker
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                        >
                            Add Meeting
                        </Button>
                        <IconButton onClick={handleLogout} sx={{ color: 'white' }} aria-label="Logout">
                            <LogoutIcon />
                        </IconButton>
                    </Box>
                </Box>

                <Container maxWidth="xl" sx={{ py: 3 }}>
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(2, minmax(0, 1fr))',
                                    md: `repeat(${isAdmin ? 6 : 5}, minmax(0, 1fr))`,
                                },
                                gap: 2,
                                alignItems: 'center',
                            }}
                        >
                            <DatePicker
                                label="From"
                                value={filters.startDate}
                                onChange={handleDateFilterChange('startDate')}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                            />
                            <DatePicker
                                label="To"
                                value={filters.endDate}
                                onChange={handleDateFilterChange('endDate')}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                            />
                            {isAdmin && (
                                <TextField
                                    fullWidth
                                    select
                                    size="small"
                                    label="Team Lead"
                                    value={filters.teamLead}
                                    onChange={handleFilterChange('teamLead')}
                                >
                                    <MenuItem value="">All</MenuItem>
                                    {teamLeads.map((tl) => (
                                        <MenuItem key={tl._id} value={tl._id}>
                                            {tl.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <TextField
                                fullWidth
                                select
                                size="small"
                                label="Status"
                                value={filters.status}
                                onChange={handleFilterChange('status')}
                            >
                                <MenuItem value="">All</MenuItem>
                                {LEAD_STAGES.filter((s) => s.value !== 'Meeting Scheduled').map((s) => (
                                    <MenuItem key={s.value} value={s.value}>
                                        {s.label}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                fullWidth
                                select
                                size="small"
                                label="Mode"
                                value={filters.mode}
                                onChange={handleFilterChange('mode')}
                            >
                                <MenuItem value="">All</MenuItem>
                                {MEETING_MODES.map((m) => {
                                    const iconMeta = MODE_ICONS[m.value];
                                    const Icon = iconMeta?.Icon;
                                    return (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {Icon && (
                                                    <Icon fontSize="small" sx={{ color: iconMeta.color }} />
                                                )}
                                                {m.label}
                                            </Box>
                                        </MenuItem>
                                    );
                                })}
                            </TextField>
                            <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                                <Button onClick={clearFilters} size="small">
                                    Clear filters
                                </Button>
                            </Box>
                        </Box>
                    </Paper>

                    {fetchError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {fetchError}
                        </Alert>
                    )}

                    <Paper>
                        <TableContainer>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Student Name</TableCell>
                                        <TableCell>Program</TableCell>
                                        <TableCell>Mode</TableCell>
                                        <TableCell>Consultant</TableCell>
                                        <TableCell>Team Lead</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Remarks</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                                                <CircularProgress />
                                            </TableCell>
                                        </TableRow>
                                    ) : rows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                                                <Typography color="text.secondary">
                                                    No meetings match the current filters.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        rows.map((r) => (
                                            <TableRow key={r._id} hover>
                                                <TableCell>
                                                    {r.meetingDate
                                                        ? format(new Date(r.meetingDate), 'dd/MM/yyyy')
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>{r.studentName}</TableCell>
                                                <TableCell>{r.program}</TableCell>
                                                <TableCell>
                                                    {(() => {
                                                        const iconMeta = MODE_ICONS[r.mode];
                                                        const Icon = iconMeta?.Icon;
                                                        return (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                                {Icon && (
                                                                    <Icon fontSize="small" sx={{ color: iconMeta.color }} />
                                                                )}
                                                                {r.mode}
                                                            </Box>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell>{r.consultantName || r.consultant?.name || '—'}</TableCell>
                                                <TableCell>
                                                    {r.teamLeadName || r.teamLead?.name || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={r.status}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: getLeadStageColor(r.status),
                                                            color: '#fff',
                                                            fontWeight: 500,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        maxWidth: 240,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    <Tooltip title={r.remarks || ''}>
                                                        <span>{r.remarks || '—'}</span>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" onClick={() => openEdit(r)} aria-label="Edit">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    {isAdmin && (
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDelete(r)}
                                                            aria-label="Delete"
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={(_e, next) => setPage(next)}
                            rowsPerPage={PAGE_SIZE}
                            rowsPerPageOptions={[PAGE_SIZE]}
                        />
                    </Paper>
                </Container>

                <MeetingFormDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    onSubmit={handleSubmit}
                    initialData={editing}
                />

                <Snackbar
                    open={snack.open}
                    autoHideDuration={3000}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
                        {snack.message}
                    </Alert>
                </Snackbar>
            </Box>
        </LocalizationProvider>
    );
};

export default MeetingTrackerPage;
