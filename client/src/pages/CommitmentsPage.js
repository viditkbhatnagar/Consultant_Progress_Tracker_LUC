import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    IconButton,
    Snackbar,
    Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import userService from '../services/userService';
import consultantService from '../services/consultantService';
import instituteService from '../services/instituteService';
import { exportRawSheet } from '../services/xlsxBuilder';
import CommitmentsKPIStrip from '../components/commitments/CommitmentsKPIStrip';
import CommitmentsToolbar from '../components/commitments/CommitmentsToolbar';
import CommitmentsTableView from '../components/commitments/CommitmentsTableView';
import CommitmentsBoardView from '../components/commitments/CommitmentsBoardView';
import CommitmentsCardsView from '../components/commitments/CommitmentsCardsView';
import CommitmentDetailDrawer from '../components/commitments/CommitmentDetailDrawer';
import CommitmentsAIAnalysisDialog from '../components/commitments/CommitmentsAIAnalysisDialog';
import CommitmentFormDialog from '../components/commitments/CommitmentFormDialog';
import SkillhubCommitmentDialog from '../components/skillhub/SkillhubCommitmentDialog';
import { TrackerThemeProvider, useThemeState } from '../utils/trackerTheme';
import { useAdminOrgScope } from '../utils/adminOrgScope';
import { isSkillhubOrg } from '../utils/hourlyConfig';
import { ORGANIZATION_LABELS } from '../utils/constants';
import { STATUS_META } from '../utils/commitmentDesign';

const PAGE_SIZE = 20;
const STORAGE_KEY = 'commitments-ui-prefs';

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
        /* ignore */
    }
};

const CommitmentsPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    // Resolve the org scope once per render. Admins pick via AdminOrgTabs,
    // team_lead/skillhub users are pinned to their own organization.
    const [adminOrg] = useAdminOrgScope();
    const viewOrg = isAdmin
        ? adminOrg || 'luc'
        : user?.organization || 'luc';
    const isSkillhub = isSkillhubOrg(viewOrg);
    // Skillhub Institute calls this tracker the "Demo Tracker" (their weekly
    // student demos live here); Training + LUC keep "Commitment Tracker".
    const isInstitute = viewOrg === 'skillhub_institute';
    const trackerLabel = isInstitute ? 'Demo Tracker' : 'Commitment Tracker';
    const orgLabel = ORGANIZATION_LABELS[viewOrg] || (isSkillhub ? 'Skillhub' : 'LUC');

    const prefs = useMemo(() => loadPrefs(), []);
    const [view, setView] = useState(prefs.view || 'table');
    const [density, setDensity] = useState(prefs.density || 'compact');

    const { mode, toggle: toggleTheme, tokensSx, contextValue } = useThemeState(
        'commitments-theme-mode'
    );

    useEffect(() => {
        savePrefs({ view, density });
    }, [view, density]);

    // Fetched data. Commitments API doesn't do server-side pagination —
    // we fetch once per filter change and then paginate client-side.
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [page, setPage] = useState(0);

    const [filters, setFilters] = useState({
        leadStage: '',
        status: '',
        teamLead: '',
        consultantName: '',
        // Institute only — the teacher who took the demo (Commitment.demos[].demoDoneBy).
        demoDoneBy: '',
        // No default date window — show everything until the user picks one.
        startDate: null,
        endDate: null,
    });

    const [teamLeads, setTeamLeads] = useState([]);
    const [consultants, setConsultants] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerRow, setDrawerRow] = useState(null);

    const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiText, setAiText] = useState('');
    const [aiError, setAiError] = useState('');

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        // LUC scope lists team leads; Skillhub scope lists the branch's
        // skillhub user (whose role === 'skillhub') so admins can filter
        // by branch owner just like they filter by TL on LUC.
        userService
            .getUsers({ organization: viewOrg })
            .then((res) => {
                const all = res.data || res || [];
                const filtered = all.filter((u) => {
                    const org = u.organization || 'luc';
                    if (org !== viewOrg) return false;
                    if (u.isActive === false) return false;
                    return isSkillhub ? u.role === 'skillhub' : u.role === 'team_lead';
                });
                if (!cancelled) setTeamLeads(filtered);
            })
            .catch(() => { if (!cancelled) setTeamLeads([]); });
        return () => { cancelled = true; };
    }, [isAdmin, viewOrg, isSkillhub]);

    useEffect(() => {
        let cancelled = false;
        consultantService
            .getConsultants(isAdmin ? { organization: viewOrg } : {})
            .then((res) => {
                const list = res.data || res || [];
                if (!cancelled) setConsultants(list.filter((c) => c.isActive !== false));
            })
            .catch(() => { if (!cancelled) setConsultants([]); });
        return () => { cancelled = true; };
    }, [isAdmin, viewOrg]);

    // Institute demos record which teacher took them, so the tracker gets a
    // "Demo done by" filter alongside Consultant. Only the Institute has faculty.
    useEffect(() => {
        if (!isInstitute) { setTeachers([]); return undefined; }
        let cancelled = false;
        instituteService
            .getTeachers()
            .then((res) => {
                const list = res.data || [];
                if (!cancelled) setTeachers(list.filter((t) => t.isActive !== false));
            })
            .catch(() => { if (!cancelled) setTeachers([]); });
        return () => { cancelled = true; };
    }, [isInstitute]);

    const fetchParams = useMemo(
        () => ({
            startDate: filters.startDate ? filters.startDate.toISOString() : undefined,
            endDate: filters.endDate ? filters.endDate.toISOString() : undefined,
            teamLead: filters.teamLead || undefined,
            consultantName: filters.consultantName || undefined,
            leadStage: filters.leadStage || undefined,
            status: filters.status || undefined,
        }),
        [filters]
    );

    // `keepPage` is used by the inline popovers — refetching after a one-click
    // edit shouldn't yank the user back to page 1, away from the row they
    // just changed. Filter/org changes still reset to the first page.
    const loadCommitments = useCallback(async ({ keepPage = false } = {}) => {
        setLoading(true);
        setFetchError('');
        try {
            // With a date range → use /commitments/date-range (server-side
            // range filter). Without → fall back to /commitments so we get
            // everything in the user's scope. All other filters (stage,
            // status, TL, consultant) apply client-side below.
            const res = fetchParams.startDate && fetchParams.endDate
                ? await commitmentService.getCommitmentsByDateRange(
                      fetchParams.startDate,
                      fetchParams.endDate,
                      null,
                      viewOrg
                  )
                : await commitmentService.getCommitments({ organization: viewOrg });
            setAllRows(res.data || []);
            if (!keepPage) setPage(0);
        } catch (err) {
            setFetchError(err?.response?.data?.message || err?.message || 'Failed to load commitments');
            setAllRows([]);
        } finally {
            setLoading(false);
        }
    }, [fetchParams.startDate, fetchParams.endDate, viewOrg]);

    useEffect(() => {
        loadCommitments();
    }, [loadCommitments]);

    // Apply the non-date filters client-side.
    const filteredRows = useMemo(() => {
        let list = allRows;
        if (filters.leadStage) list = list.filter((r) => r.leadStage === filters.leadStage);
        if (filters.status) list = list.filter((r) => r.status === filters.status);
        if (filters.teamLead) {
            list = list.filter((r) => {
                const tl = r.teamLead?._id || r.teamLead;
                return tl && tl.toString() === filters.teamLead.toString();
            });
        }
        if (filters.consultantName) {
            list = list.filter((r) => r.consultantName === filters.consultantName);
        }
        // A row matches if ANY of its demos was done by the chosen teacher —
        // one commitment can carry several demos.
        if (filters.demoDoneBy) {
            list = list.filter((r) =>
                (r.demos || []).some((d) => (d.demoDoneBy || '').trim() === filters.demoDoneBy)
            );
        }
        return list;
    }, [allRows, filters]);

    // Export exactly what's on screen (all active filters applied), so
    // filtering by a teacher and downloading gives that teacher's demos. The
    // "Demo done by" column is what makes a per-teacher count possible in Excel.
    const handleExport = (kind) => {
        const rows = filteredRows.map((r) => ({
            date: r.commitmentDate || r.weekStartDate || r.createdAt,
            studentName: r.studentName || '',
            consultantName: r.consultantName || '',
            demoDoneBy: [
                ...new Set((r.demos || []).map((d) => (d.demoDoneBy || '').trim()).filter(Boolean)),
            ].join(', '),
            commitmentMade: r.commitmentMade || '',
            leadStage: r.leadStage || '',
            status: r.admissionClosed ? 'Admitted & Closed' : (r.status || ''),
            conversionProbability: r.conversionProbability ?? 0,
            meetingsDone: r.meetingsDone ?? 0,
            followUpDate: r.followUpDate || '',
            admissionClosedDate: r.admissionClosedDate || '',
            teamName: r.teamName || '',
            correctiveActionByTL: r.correctiveActionByTL || '',
            adminComment: r.adminComment || '',
        }));
        const cols = [
            { key: 'date', lbl: 'Date', date: true },
            { key: 'studentName', lbl: 'Student' },
            { key: 'consultantName', lbl: 'Consultant' },
            ...(isInstitute ? [{ key: 'demoDoneBy', lbl: 'Demo done by' }] : []),
            { key: 'commitmentMade', lbl: isInstitute ? 'Demo' : 'Commitment' },
            { key: 'leadStage', lbl: 'Lead stage' },
            { key: 'status', lbl: 'Status' },
            { key: 'conversionProbability', lbl: 'Probability %' },
            { key: 'meetingsDone', lbl: 'Meetings' },
            { key: 'followUpDate', lbl: 'Follow-up date', date: true },
            { key: 'admissionClosedDate', lbl: 'Closed date', date: true },
            ...(isAdmin ? [{ key: 'teamName', lbl: 'Team' }] : []),
            { key: 'correctiveActionByTL', lbl: 'TL comment' },
            { key: 'adminComment', lbl: 'Admin comment' },
        ];
        const base = isInstitute ? 'demo-tracker' : 'commitment-tracker';
        const suffix = filters.demoDoneBy ? `-${filters.demoDoneBy.replace(/[^\w-]+/g, '_')}` : '';
        exportRawSheet(rows, cols, `${base}${suffix}`, kind, {
            sheetName: isInstitute ? 'Demos' : 'Commitments',
        });
    };

    const handleFilterChange = (field, value) => {
        setPage(0);
        setFilters((prev) => ({ ...prev, [field]: value }));
    };
    const clearFilters = () => {
        setPage(0);
        setFilters({
            leadStage: '',
            status: '',
            teamLead: '',
            consultantName: '',
            demoDoneBy: '',
            startDate: null,
            endDate: null,
        });
    };

    const tableRows = useMemo(
        () => filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
        [filteredRows, page]
    );

    const openCreate = () => { setEditing(null); setDialogOpen(true); };
    const openEdit = (row) => { setEditing(row); setDialogOpen(true); };
    const openDrawer = (row) => { setDrawerRow(row); setDrawerOpen(true); };
    const closeDrawer = () => setDrawerOpen(false);

    const handleFormSubmit = async (data) => {
        if (editing) {
            await commitmentService.updateCommitment(editing._id, data);
            setSnack({ open: true, message: 'Commitment updated', severity: 'success' });
        } else {
            await commitmentService.createCommitment(data);
            setSnack({ open: true, message: 'Commitment created', severity: 'success' });
        }
        loadCommitments();
    };

    // The server auto-closes an admission (irreversibly) as soon as a row is
    // BOTH leadStage='Admission' and status='achieved' — it merges the patch
    // over the stored doc, so either edit order trips it. Both inline popovers
    // funnel through here so neither can close a record without asking.
    const confirmIrreversibleClose = (row, { nextStage, nextStatus }) => {
        const stage = nextStage !== undefined ? nextStage : row.leadStage;
        const status = nextStatus !== undefined ? nextStatus : row.status;
        if (stage !== 'Admission' || status !== 'achieved' || row.admissionClosed) return true;
        return window.confirm(
            `This will CLOSE the admission for "${row.studentName || 'this row'}".\n\n` +
            'Closing an admission is irreversible. Continue?'
        );
    };

    const handleStageChange = async (row, nextStage) => {
        if (!confirmIrreversibleClose(row, { nextStage })) return;
        try {
            await commitmentService.updateCommitment(row._id, { leadStage: nextStage });
            setSnack({ open: true, message: `Lead stage → ${nextStage}`, severity: 'success' });
            loadCommitments({ keepPage: true });
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Failed to update lead stage',
                severity: 'error',
            });
        }
    };

    const handleDrawerSave = async (row, patch) => {
        await commitmentService.updateCommitment(row._id, patch);
        loadCommitments();
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete ${isInstitute ? 'demo' : 'commitment'} for ${row.studentName || 'this row'}?`)) return;
        try {
            await commitmentService.deleteCommitment(row._id);
            setSnack({ open: true, message: 'Commitment deleted', severity: 'success' });
            if (drawerOpen) closeDrawer();
            loadCommitments();
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Delete failed',
                severity: 'error',
            });
        }
    };

    // Inline status change from the table, mirroring the lead-stage popover.
    // A closed admission is locked at 'achieved' (the server enforces this too,
    // so every other edit route is covered); otherwise confirm before an edit
    // that would irreversibly close the admission.
    const handleStatusChange = async (row, nextStatus) => {
        if (row.admissionClosed && nextStatus !== 'achieved') {
            setSnack({
                open: true,
                message: 'This admission is closed — its status stays Achieved.',
                severity: 'warning',
            });
            return;
        }
        const willCloseAdmission =
            row.leadStage === 'Admission' && nextStatus === 'achieved' && !row.admissionClosed;
        if (!confirmIrreversibleClose(row, { nextStatus })) return;
        try {
            await commitmentService.updateCommitment(row._id, { status: nextStatus });
            const label = STATUS_META[nextStatus]?.label || nextStatus;
            setSnack({
                open: true,
                message: willCloseAdmission ? `Status → ${label} · admission closed` : `Status → ${label}`,
                severity: 'success',
            });
            loadCommitments({ keepPage: true });
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Failed to update status',
                severity: 'error',
            });
        }
    };

    const handleCloseAdmission = async (row) => {
        const amountStr = window.prompt('Closed amount (leave blank for 0):', '');
        if (amountStr === null) return;
        const closedAmount = Number(amountStr) || 0;
        try {
            await commitmentService.closeAdmission(row._id, new Date().toISOString(), closedAmount);
            setSnack({ open: true, message: 'Admission closed', severity: 'success' });
            closeDrawer();
            loadCommitments();
        } catch (err) {
            setSnack({
                open: true,
                message: err?.response?.data?.message || 'Failed to close admission',
                severity: 'error',
            });
        }
    };

    const runAIAnalysis = useCallback(async () => {
        setAiLoading(true);
        setAiText('');
        setAiError('');
        try {
            const res = await commitmentService.getAIAnalysis(fetchParams);
            setAiText(res.analysis || 'No analysis was generated.');
        } catch (err) {
            setAiError(err?.response?.data?.message || err?.message || 'Failed to generate analysis');
        } finally {
            setAiLoading(false);
        }
    }, [fetchParams]);

    const openAI = () => {
        setAiOpen(true);
        runAIAnalysis();
    };

    const handleBack = () => {
        if (isAdmin) navigate('/admin/dashboard');
        else if (user?.role === 'team_lead') navigate('/team-lead/dashboard');
        else if (user?.role === 'skillhub') navigate('/skillhub/dashboard');
        else navigate('/');
    };
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const viewRows = view === 'table' ? tableRows : filteredRows;
    const viewLoading = loading;

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
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                {trackerLabel}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: 11.5,
                                    opacity: 0.82,
                                    letterSpacing: '.05em',
                                    textTransform: 'uppercase',
                                    fontWeight: 600,
                                }}
                            >
                                {orgLabel}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={handleLogout} sx={{ color: 'white' }} aria-label="Logout">
                        <LogoutIcon />
                    </IconButton>
                </Box>

                <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3.5 } }}>
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
                            {filteredRows.length} of {allRows.length} commitments
                            {view === 'table'
                                ? ` · page ${page + 1} of ${Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))}`
                                : ''}
                        </span>
                    </Box>

                    {fetchError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {fetchError}
                        </Alert>
                    )}

                    <CommitmentsKPIStrip rows={filteredRows} />

                    <CommitmentsToolbar
                        view={view}
                        onViewChange={setView}
                        density={density}
                        onDensityChange={setDensity}
                        filters={filters}
                        onFilterChange={handleFilterChange}
                        onClearFilters={clearFilters}
                        teamLeads={teamLeads}
                        consultants={consultants}
                        teachers={teachers}
                        isInstitute={isInstitute}
                        isAdmin={isAdmin}
                        onExport={handleExport}
                        exportDisabled={!filteredRows.length}
                        onAdd={openCreate}
                        onAIAnalysis={openAI}
                        mode={mode}
                        onToggleMode={toggleTheme}
                    />

                    {view === 'table' && (
                        <CommitmentsTableView
                            rows={tableRows}
                            total={filteredRows.length}
                            page={page}
                            pageSize={PAGE_SIZE}
                            onPageChange={setPage}
                            loading={viewLoading}
                            density={density}
                            isAdmin={isAdmin}
                            onOpenDetail={openDrawer}
                            onEdit={openEdit}
                            onDelete={handleDelete}
                            onStageChange={handleStageChange}
                            onStatusChange={handleStatusChange}
                            isInstitute={isInstitute}
                        />
                    )}

                    {view === 'board' && (
                        <CommitmentsBoardView
                            rows={viewRows}
                            loading={viewLoading}
                            onOpen={openDrawer}
                        />
                    )}

                    {view === 'cards' && (
                        <CommitmentsCardsView
                            rows={viewRows}
                            loading={viewLoading}
                            onOpen={openDrawer}
                        />
                    )}
                </Container>

                {/* Skillhub commitments use a different dialog (4 demo slots,
                    counselor picker, week-bounded date picker). LUC uses the
                    standard CommitmentFormDialog. Both hit the same service. */}
                {isSkillhub ? (
                    <SkillhubCommitmentDialog
                        open={dialogOpen}
                        onClose={() => setDialogOpen(false)}
                        onSave={handleFormSubmit}
                        commitment={editing}
                        teamConsultants={consultants}
                        user={user}
                        viewOrg={viewOrg}
                    />
                ) : (
                    <CommitmentFormDialog
                        open={dialogOpen}
                        onClose={() => setDialogOpen(false)}
                        onSubmit={handleFormSubmit}
                        initialData={editing}
                    />
                )}

                <CommitmentDetailDrawer
                    open={drawerOpen}
                    row={drawerRow}
                    onClose={closeDrawer}
                    onSave={handleDrawerSave}
                    onEdit={(row) => { closeDrawer(); openEdit(row); }}
                    onDelete={handleDelete}
                    onCloseAdmission={handleCloseAdmission}
                    isAdmin={isAdmin}
                />

                <CommitmentsAIAnalysisDialog
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

export default CommitmentsPage;
