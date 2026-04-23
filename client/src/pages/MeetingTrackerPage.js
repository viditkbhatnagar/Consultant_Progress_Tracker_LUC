import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    IconButton,
    Snackbar,
    Alert,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Logout as LogoutIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import meetingService from '../services/meetingService';
import userService from '../services/userService';
import consultantService from '../services/consultantService';
import MeetingFormDialog from '../components/MeetingFormDialog';
import MeetingsKPIStrip from '../components/meetings/MeetingsKPIStrip';
import MeetingsToolbar from '../components/meetings/MeetingsToolbar';
import MeetingsTableView from '../components/meetings/MeetingsTableView';
import MeetingsBoardView from '../components/meetings/MeetingsBoardView';
import MeetingsCardsView from '../components/meetings/MeetingsCardsView';
import MeetingDetailDrawer from '../components/meetings/MeetingDetailDrawer';
import MeetingsAIAnalysisDialog from '../components/meetings/MeetingsAIAnalysisDialog';
import { TrackerThemeProvider, useThemeState } from '../utils/trackerTheme';

// Default = show everything. User can type a number into the Rows/page
// input to switch to paginated mode. SHOW_ALL_LIMIT is a hard cap the
// server also honours (20k); well above any realistic meeting volume.
const SHOW_ALL_LIMIT = 20000;
const STORAGE_KEY = 'meetings-ui-prefs';

const loadPrefs = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) || {};
    } catch {
        return {};
    }
};
const savePrefs = (prefs) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        /* ignore quota */
    }
};

const MeetingTrackerPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    const prefs = useMemo(() => loadPrefs(), []);
    const [view, setView] = useState(prefs.view || 'table');
    const [density, setDensity] = useState(prefs.density || 'compact');

    // Rows-per-page control for the Table view. `pageSizeInput` is the
    // string the user is typing; `pageSize` is the committed positive int
    // used by the data fetcher. pageSize === null means "show all".
    const [pageSizeInput, setPageSizeInput] = useState(
        typeof prefs.pageSize === 'number' && prefs.pageSize > 0
            ? String(prefs.pageSize)
            : ''
    );
    const [pageSize, setPageSize] = useState(
        typeof prefs.pageSize === 'number' && prefs.pageSize > 0
            ? prefs.pageSize
            : null
    );

    // Theme (light/dark) for this page only — persisted separately.
    const { mode, toggle: toggleTheme, tokensSx, contextValue } = useThemeState(
        'meetings-theme-mode'
    );

    useEffect(() => {
        savePrefs({ view, density, pageSize });
    }, [view, density, pageSize]);

    // Data state — Table view uses paginated rows; Board/Cards use allRows.
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState('');

    const [allRows, setAllRows] = useState([]);
    const [allLoading, setAllLoading] = useState(false);

    // KPI rows — lean {meetingDate, status} across the full filter window,
    // independent of pagination. Pulled from /api/meetings/stats so the
    // KPI strip reflects every matching meeting, not just the current
    // page.
    const [kpiRows, setKpiRows] = useState([]);

    const [filters, setFilters] = useState({
        status: '',
        mode: '',
        teamLead: '',
        consultant: '',
        startDate: null,
        endDate: null,
    });

    const [teamLeads, setTeamLeads] = useState([]);
    const [consultants, setConsultants] = useState([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerRow, setDrawerRow] = useState(null);

    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

    // AI analysis dialog
    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiText, setAiText] = useState('');
    const [aiError, setAiError] = useState('');

    // Load TLs (admin only)
    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        userService
            .getUsers({ organization: 'luc' })
            .then((res) => {
                const all = res.data || res || [];
                const tls = all.filter(
                    (u) =>
                        u.role === 'team_lead' &&
                        (u.organization || 'luc') === 'luc' &&
                        u.isActive !== false
                );
                if (!cancelled) setTeamLeads(tls);
            })
            .catch(() => { if (!cancelled) setTeamLeads([]); });
        return () => { cancelled = true; };
    }, [isAdmin]);

    // Load consultants (for filter chip). For admin, pull all LUC consultants;
    // for TL, the backend auto-scopes to their team.
    useEffect(() => {
        let cancelled = false;
        consultantService
            .getConsultants(isAdmin ? { organization: 'luc' } : {})
            .then((res) => {
                const list = res.data || res || [];
                if (!cancelled) setConsultants(list.filter((c) => c.isActive !== false));
            })
            .catch(() => { if (!cancelled) setConsultants([]); });
        return () => { cancelled = true; };
    }, [isAdmin]);

    const commonFilterParams = useMemo(
        () => ({
            organization: 'luc',
            startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
            endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
            teamLead: filters.teamLead || undefined,
            consultant: filters.consultant || undefined,
            status: filters.status || undefined,
            mode: filters.mode || undefined,
        }),
        [filters]
    );

    // Table fetcher — paginated when pageSize is set; otherwise one big
    // page with every matching row (server caps at SHOW_ALL_LIMIT).
    const loadTable = useCallback(async () => {
        setLoading(true);
        setFetchError('');
        try {
            const res = await meetingService.getMeetings({
                ...commonFilterParams,
                page: pageSize ? page + 1 : 1,
                limit: pageSize || SHOW_ALL_LIMIT,
            });
            setRows(res.data || []);
            setTotal(res.pagination?.total || (res.data || []).length);
        } catch (err) {
            setFetchError(err?.response?.data?.message || err?.message || 'Failed to load meetings');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [commonFilterParams, page, pageSize]);

    // Board/Cards fetcher — always show every matching row in the window.
    const loadAll = useCallback(async () => {
        setAllLoading(true);
        setFetchError('');
        try {
            const res = await meetingService.getMeetings({
                ...commonFilterParams,
                page: 1,
                limit: SHOW_ALL_LIMIT,
            });
            setAllRows(res.data || []);
        } catch (err) {
            setFetchError(err?.response?.data?.message || err?.message || 'Failed to load meetings');
            setAllRows([]);
        } finally {
            setAllLoading(false);
        }
    }, [commonFilterParams]);

    // KPI fetcher — pulls the full filtered dataset (lean projection) so
    // KPI cards show all-time / all-filtered numbers independent of
    // whatever pagination the user has set.
    const loadKpis = useCallback(async () => {
        try {
            const res = await meetingService.getMeetingStats(commonFilterParams);
            setKpiRows(res.data || []);
        } catch {
            setKpiRows([]);
        }
    }, [commonFilterParams]);

    useEffect(() => {
        if (view === 'table') loadTable();
        else loadAll();
    }, [view, loadTable, loadAll]);

    useEffect(() => {
        loadKpis();
    }, [loadKpis]);

    const handleFilterChange = (field, value) => {
        setPage(0);
        setFilters((prev) => ({ ...prev, [field]: value }));
    };
    const clearFilters = () => {
        setPage(0);
        setFilters({ status: '', mode: '', teamLead: '', consultant: '', startDate: null, endDate: null });
    };

    const refreshCurrent = () => {
        if (view === 'table') loadTable();
        else loadAll();
        loadKpis();
    };

    const openCreate = () => { setEditing(null); setDialogOpen(true); };
    const openEdit = (row) => { setEditing(row); setDialogOpen(true); };
    const openDrawer = (row) => { setDrawerRow(row); setDrawerOpen(true); };
    const closeDrawer = () => { setDrawerOpen(false); };

    const handleFormSubmit = async (data) => {
        if (editing) {
            await meetingService.updateMeeting(editing._id, data);
            setSnack({ open: true, message: 'Meeting updated', severity: 'success' });
        } else {
            await meetingService.createMeeting(data);
            setSnack({ open: true, message: 'Meeting created', severity: 'success' });
        }
        refreshCurrent();
    };

    const handleStatusChange = async (row, nextStatus) => {
        try {
            await meetingService.updateMeeting(row._id, { status: nextStatus });
            setSnack({ open: true, message: `Status → ${nextStatus}`, severity: 'success' });
            refreshCurrent();
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Failed to update status',
                severity: 'error',
            });
        }
    };

    const handleDrawerSave = async (row, patch) => {
        await meetingService.updateMeeting(row._id, patch);
        refreshCurrent();
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete meeting for ${row.studentName}?`)) return;
        try {
            await meetingService.deleteMeeting(row._id);
            setSnack({ open: true, message: 'Meeting deleted', severity: 'success' });
            if (view === 'table' && pageSize && rows.length === 1 && page > 0) {
                setPage(page - 1);
            } else {
                refreshCurrent();
            }
            loadKpis();
            if (drawerOpen) closeDrawer();
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Delete failed',
                severity: 'error',
            });
        }
    };

    const runAIAnalysis = useCallback(async () => {
        setAiLoading(true);
        setAiText('');
        setAiError('');
        try {
            const res = await meetingService.getAIAnalysis(commonFilterParams);
            setAiText(res.analysis || 'No analysis was generated.');
        } catch (err) {
            setAiError(
                err?.response?.data?.message ||
                    err?.message ||
                    'Failed to generate analysis'
            );
        } finally {
            setAiLoading(false);
        }
    }, [commonFilterParams]);

    const openAI = () => {
        setAiOpen(true);
        runAIAnalysis();
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

    const currentViewRows = view === 'table' ? rows : allRows;
    const currentViewLoading = view === 'table' ? loading : allLoading;

    // Commit the typed pageSize string into the effective pageSize number
    // on blur/Enter. Empty or 0 → "show all" (pageSize = null).
    const commitPageSize = useCallback(() => {
        const n = parseInt(pageSizeInput, 10);
        if (Number.isFinite(n) && n > 0) {
            setPageSize(n);
            setPage(0);
        } else {
            setPageSize(null);
            setPage(0);
            if (pageSizeInput !== '') setPageSizeInput('');
        }
    }, [pageSizeInput]);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
        <TrackerThemeProvider value={contextValue}>
            <Box
                sx={{
                    ...tokensSx,
                    minHeight: '100vh',
                    backgroundColor: 'var(--t-page-bg)',
                    color: 'var(--t-text)',
                    transition: 'background-color 180ms ease, color 180ms ease',
                }}
            >
                {/* Existing app header — unchanged chrome */}
                <Box
                    sx={{
                        backgroundColor: '#1976d2',
                        color: 'white',
                        py: 1.5,
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
                    <IconButton onClick={handleLogout} sx={{ color: 'white' }} aria-label="Logout">
                        <LogoutIcon />
                    </IconButton>
                </Box>

                <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3.5 } }}>
                    {/* Count line */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            mb: 2,
                            color: 'var(--t-text-muted)',
                            fontSize: 12,
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                backgroundColor: '#22C55E',
                                boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
                            }}
                        />
                        <span>
                            {view === 'table'
                                ? pageSize
                                    ? `${rows.length} of ${total} meetings · page ${page + 1}`
                                    : `${total.toLocaleString()} meeting${total === 1 ? '' : 's'}`
                                : `${allRows.length} meetings in view`}
                        </span>
                    </Box>

                    {fetchError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {fetchError}
                        </Alert>
                    )}

                    <MeetingsKPIStrip rows={kpiRows} />

                    <MeetingsToolbar
                        view={view}
                        onViewChange={setView}
                        density={density}
                        onDensityChange={setDensity}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={clearFilters}
                        teamLeads={teamLeads}
                        consultants={consultants}
                        isAdmin={isAdmin}
                        onAdd={openCreate}
                        onAIAnalysis={openAI}
                        mode={mode}
                        onToggleMode={toggleTheme}
                        pageSizeInput={pageSizeInput}
                        onPageSizeInputChange={setPageSizeInput}
                        onPageSizeCommit={commitPageSize}
                    />

                    {view === 'table' && (
                        <MeetingsTableView
                            rows={rows}
                            total={total}
                            page={page}
                            pageSize={pageSize}
                            onPageChange={setPage}
                            loading={loading}
                            density={density}
                            isAdmin={isAdmin}
                            onOpenDetail={openDrawer}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                        />
                    )}

                    {view === 'board' && (
                        <MeetingsBoardView
                            rows={currentViewRows}
                            loading={currentViewLoading}
                            onOpen={openDrawer}
                        />
                    )}

                    {view === 'cards' && (
                        <MeetingsCardsView
                            rows={currentViewRows}
                            loading={currentViewLoading}
                            onOpen={openDrawer}
                        />
                    )}
                </Container>

                <MeetingFormDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    onSubmit={handleFormSubmit}
                    initialData={editing}
                />

                <MeetingDetailDrawer
                    open={drawerOpen}
                    row={drawerRow}
                    onClose={closeDrawer}
                    onSave={handleDrawerSave}
                    onEdit={(row) => { closeDrawer(); openEdit(row); }}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
                />

                <MeetingsAIAnalysisDialog
                    open={aiOpen}
                    onClose={() => setAiOpen(false)}
                    loading={aiLoading}
                    analysis={aiText}
                    error={aiError}
                    onRefresh={runAIAnalysis}
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
        </TrackerThemeProvider>
        </LocalizationProvider>
    );
};

export default MeetingTrackerPage;
