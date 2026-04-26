import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Snackbar,
    Alert,
    Autocomplete,
    TextField,
    Checkbox,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    ArrowBack as ArrowBackIcon,
    SaveAlt as ExportCenterIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import studentService from '../services/studentService';
import consultantService from '../services/consultantService';
import { getUsers } from '../services/authService';
import xlsxBuilder from '../services/xlsxBuilder';
import { lucColumns } from '../config/exportColumns/students';
import { useAdminOrgScope, getAdminOrgScope } from '../utils/adminOrgScope';
import AdminOrgTabs from '../components/AdminOrgTabs';
import StudentFormDialog from '../components/StudentFormDialog';
import {
    TrackerThemeProvider,
    useThemeState,
} from '../utils/trackerTheme';
import {
    LUC_UNIVERSITIES,
    LUC_SOURCES,
    MONTHS,
    getFilterPrograms,
} from '../utils/studentDesign';
import StudentsToolbar, {
    FilterChip,
} from '../components/students/StudentsToolbar';
import StudentsKPIStrip from '../components/students/StudentsKPIStrip';
import StudentsAIAnalysisDialog from '../components/students/StudentsAIAnalysisDialog';
import LucStudentsTableView from '../components/students/LucStudentsTableView';
import LucStudentsCardsView from '../components/students/LucStudentsCardsView';
import LucStudentDetailDrawer from '../components/students/LucStudentDetailDrawer';

const PAGE_SIZE = 50;
const CARDS_LIMIT = 500;

const LucStudentDatabasePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [adminOrg] = useAdminOrgScope();
    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';

    const { mode, toggle: toggleTheme, tokensSx, contextValue } = useThemeState(
        'students-theme-mode'
    );

    const [view, setView] = useState('table');
    const [consultants, setConsultants] = useState([]);
    const [teamLeads, setTeamLeads] = useState([]);

    const [students, setStudents] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Server-aggregated stats. Re-fetched whenever a filter changes so the
    // KPI strip reflects the currently-narrowed window (or the full dataset
    // when no filter is set).
    const [stats, setStats] = useState(null);

    // Default to no date filter — the user wants the full dataset visible
    // unless they explicitly narrow it. Pagination on the server still keeps
    // payloads bounded.
    const [filters, setFilters] = useState({
        startDate: null,
        endDate: null,
        consultant: [],
        university: '',
        team: [],
        month: [],
        program: '',
        source: '',
        search: '',
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerStudent, setDrawerStudent] = useState(null);

    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiError, setAiError] = useState('');

    const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' });
    const showToast = (msg, severity = 'success') =>
        setToast({ open: true, msg, severity });

    // ── LOADERS ──
    const loadConsultants = useCallback(async () => {
        try {
            const f = isAdmin ? { organization: adminOrg } : {};
            const res = await consultantService.getConsultants(f);
            setConsultants(res.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, [isAdmin, adminOrg]);

    const loadTeamLeads = useCallback(async () => {
        if (isAdmin) {
            try {
                const data = await getUsers();
                const users = data.data || data || [];
                setTeamLeads(users.filter((u) => u.role === 'team_lead'));
            } catch (err) {
                console.error('Failed to load team leads:', err);
            }
        } else if (user?.role === 'team_lead') {
            setTeamLeads([
                {
                    _id: user._id || user.id,
                    name: user.name,
                    teamName: user.teamName,
                    role: user.role,
                },
            ]);
        }
    }, [isAdmin, user]);

    const loadStats = useCallback(async () => {
        try {
            const organization = isAdmin ? getAdminOrgScope() : undefined;
            const res = await studentService.getStudentStats({
                startDate: filters.startDate
                    ? format(filters.startDate, 'yyyy-MM-dd')
                    : undefined,
                endDate: filters.endDate
                    ? format(filters.endDate, 'yyyy-MM-dd')
                    : undefined,
                consultant: filters.consultant.length > 0
                    ? filters.consultant.join(',')
                    : undefined,
                university: filters.university || undefined,
                team: filters.team.length > 0 ? filters.team.join(',') : undefined,
                month: filters.month.length > 0 ? filters.month : undefined,
                program: filters.program || undefined,
                source: filters.source || undefined,
                organization,
            });
            setStats(res.data?.overview || null);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }, [isAdmin, filters]);

    const loadStudents = useCallback(async () => {
        try {
            setLoading(true);
            const organization = isAdmin ? getAdminOrgScope() : undefined;
            const res = await studentService.getStudents({
                startDate: filters.startDate
                    ? format(filters.startDate, 'yyyy-MM-dd')
                    : undefined,
                endDate: filters.endDate
                    ? format(filters.endDate, 'yyyy-MM-dd')
                    : undefined,
                consultant: filters.consultant.length > 0
                    ? filters.consultant.join(',')
                    : undefined,
                university: filters.university || undefined,
                team: filters.team.length > 0 ? filters.team.join(',') : undefined,
                month: filters.month.length > 0 ? filters.month : undefined,
                program: filters.program || undefined,
                source: filters.source || undefined,
                organization,
                page: view === 'table' ? page : 1,
                limit: view === 'table' ? PAGE_SIZE : CARDS_LIMIT,
            });
            setStudents(res.data || []);
            setTotal(res.pagination?.total ?? res.count ?? res.data?.length ?? 0);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [isAdmin, filters, view, page]);

    useEffect(() => {
        loadConsultants();
        loadTeamLeads();
    }, [loadConsultants, loadTeamLeads]);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    // Reset to page 1 when filters change (but not when view/page itself changes)
    useEffect(() => {
        setPage(1);
    }, [
        filters.startDate,
        filters.endDate,
        filters.consultant,
        filters.university,
        filters.team,
        filters.month,
        filters.program,
        filters.source,
    ]);

    // ── CLIENT-SIDE SEARCH ──
    const displayed = students.filter((s) => {
        if (!filters.search) return true;
        const q = filters.search.toLowerCase();
        return (
            s.studentName?.toLowerCase().includes(q) ||
            s.consultantName?.toLowerCase().includes(q) ||
            s.university?.toLowerCase().includes(q) ||
            s.program?.toLowerCase().includes(q) ||
            s.campaignName?.toLowerCase().includes(q)
        );
    });

    // ── KPI ──
    // Driven by server stats so we can show true "all-time" totals when no
    // filter is set. Avg Conversion hides (shows em-dash) until the user
    // narrows the window via any filter — the number is not meaningful for
    // the whole history.
    const hasAnyFilter = !!(
        filters.startDate ||
        filters.endDate ||
        (filters.consultant && filters.consultant.length > 0) ||
        filters.university ||
        (filters.team && filters.team.length > 0) ||
        (filters.month && filters.month.length > 0) ||
        filters.program ||
        filters.source ||
        filters.search
    );

    // Dynamic "coverage" sub-label under each KPI — tells the user which
    // date window the numbers represent. If a date filter is active we use
    // those bounds; otherwise we fall back to the earliest closingDate in
    // the scope paired with today.
    const fmtDate = (d) => {
        if (!d) return null;
        try {
            return format(new Date(d), 'd MMM yyyy');
        } catch {
            return null;
        }
    };
    const windowSub = (() => {
        if (filters.startDate && filters.endDate) {
            return `${fmtDate(filters.startDate)} – ${fmtDate(filters.endDate)}`;
        }
        if (filters.startDate) {
            return `${fmtDate(filters.startDate)} – ${fmtDate(new Date())}`;
        }
        if (filters.endDate) {
            const min = stats?.minClosingDate;
            return `${min ? fmtDate(min) : '—'} – ${fmtDate(filters.endDate)}`;
        }
        const min = stats?.minClosingDate;
        return min ? `${fmtDate(min)} – ${fmtDate(new Date())}` : null;
    })();

    const kpiCards = [
        {
            label: 'Total Students',
            value: stats ? stats.totalStudents.toLocaleString() : '—',
            color: '#2563EB',
            sub: windowSub,
        },
        {
            label: 'Revenue',
            value: stats
                ? `AED ${Math.round(stats.totalRevenue || 0).toLocaleString()}`
                : 'AED 0',
            color: '#16A34A',
            sub: windowSub,
        },
        {
            label: 'Avg Conversion',
            value:
                hasAnyFilter && stats && stats.avgConversionTime
                    ? `${Math.round(stats.avgConversionTime)}d`
                    : '—',
            color: '#D97706',
            sub: hasAnyFilter ? windowSub : 'apply a filter to view',
        },
    ];

    // ── CRUD ──
    const handleAdd = () => {
        setSelectedStudent(null);
        setDialogOpen(true);
    };
    const handleEdit = (s) => {
        setDrawerOpen(false);
        setSelectedStudent(s);
        setDialogOpen(true);
    };
    const handleDelete = async (s) => {
        if (!window.confirm(`Delete "${s.studentName}"? This cannot be undone.`)) return;
        try {
            await studentService.deleteStudent(s._id);
            setDrawerOpen(false);
            loadStudents();
            showToast('Student deleted');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete', 'error');
        }
    };
    const handleSave = async (data) => {
        if (selectedStudent) {
            await studentService.updateStudent(selectedStudent._id, data);
            showToast('Student updated');
        } else {
            await studentService.createStudent(data);
            showToast('Student created');
        }
        await loadStudents();
    };

    // ── AI ──
    const runAIAnalysis = async () => {
        setAiOpen(true);
        setAiLoading(true);
        setAiAnalysis('');
        setAiError('');
        try {
            const res = await studentService.getStudentAnalysis({
                startDate: filters.startDate
                    ? format(filters.startDate, 'yyyy-MM-dd')
                    : undefined,
                endDate: filters.endDate
                    ? format(filters.endDate, 'yyyy-MM-dd')
                    : undefined,
            });
            setAiAnalysis(res.analysis || 'No analysis available.');
        } catch (err) {
            setAiError(err.response?.data?.message || 'Failed to generate analysis');
        } finally {
            setAiLoading(false);
        }
    };

    // ── EXPORT ──
    // Delegates to xlsxBuilder against the canonical Students column config
    // (LUC variant). The legacy `buildExportRows` and inline date/money
    // shaping moved into xlsxBuilder + the column config; this handler now
    // just hands the displayed rows over.
    const doExport = (kind) => {
        xlsxBuilder.exportRawSheet(displayed, lucColumns, 'student_database', kind);
        showToast(`Exported ${kind.toUpperCase()}`);
    };

    // ── FILTER CHIPS ──
    const universityOptions = LUC_UNIVERSITIES.map((u) => ({ value: u, label: u }));
    const sourceOptions = LUC_SOURCES.map((s) => ({ value: s, label: s }));
    const teamOptions = teamLeads.map((tl) => ({
        value: tl.teamName,
        label: tl.teamName,
    }));
    // Narrow consultants by selected teams. Match on the consultant's
    // teamName (which is what the chip value is). When no teams are
    // picked, show every consultant in scope. team_lead users hit this
    // page with the team chip hidden — their consultants list is already
    // server-scoped to their own team.
    const teamFilterSet = new Set(filters.team);
    const scopedConsultants =
        teamFilterSet.size > 0
            ? consultants.filter((c) => teamFilterSet.has(c.teamName))
            : consultants;
    const consultantOptions = scopedConsultants.map((c) => ({
        value: c.name,
        label: c.name,
    }));
    const programOptions = getFilterPrograms(filters.university).map((p) => ({
        value: p,
        label: p,
    }));

    // When the team selection changes, drop consultant picks that are no
    // longer reachable (their team is no longer selected). Keeps the
    // consultant chip from showing stale "X selected" against an empty
    // option list.
    const handleTeamChange = (nextTeams) => {
        setFilters((p) => {
            const teamSet = new Set(nextTeams);
            const validNames = new Set(
                teamSet.size > 0
                    ? consultants
                          .filter((c) => teamSet.has(c.teamName))
                          .map((c) => c.name)
                    : consultants.map((c) => c.name)
            );
            const nextConsultant = (p.consultant || []).filter((name) =>
                validNames.has(name)
            );
            return { ...p, team: nextTeams, consultant: nextConsultant };
        });
    };

    const chipRow = (
        <>
            {isAdmin && (
                <FilterChip
                    label="Team"
                    value={filters.team}
                    options={teamOptions}
                    onChange={handleTeamChange}
                    multiple
                />
            )}
            <FilterChip
                label="Consultant"
                value={filters.consultant}
                options={consultantOptions}
                onChange={(v) => setFilters((p) => ({ ...p, consultant: v }))}
                multiple
            />
            <FilterChip
                label="University"
                value={filters.university}
                options={universityOptions}
                onChange={(v) =>
                    setFilters((p) => {
                        const next = { ...p, university: v };
                        if (v && p.program) {
                            const programs = getFilterPrograms(v);
                            if (!programs.includes(p.program)) next.program = '';
                        }
                        return next;
                    })
                }
            />
            <FilterChip
                label="Program"
                value={filters.program}
                options={programOptions}
                onChange={(v) => setFilters((p) => ({ ...p, program: v }))}
            />
            <FilterChip
                label="Source"
                value={filters.source}
                options={sourceOptions}
                onChange={(v) => setFilters((p) => ({ ...p, source: v }))}
            />
            <Autocomplete
                multiple
                size="small"
                options={MONTHS}
                value={filters.month}
                onChange={(_e, v) => setFilters((p) => ({ ...p, month: v }))}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                    <li {...props}>
                        <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                        {option}
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={filters.month.length === 0 ? 'Months' : ''}
                        size="small"
                        sx={{
                            minWidth: 180,
                            '& .MuiInputBase-input': {
                                fontSize: 12,
                                color: 'var(--t-text)',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'var(--t-border)',
                            },
                        }}
                    />
                )}
                sx={{ minWidth: 180 }}
            />
        </>
    );

    const clearFilters = () =>
        setFilters({
            startDate: null,
            endDate: null,
            consultant: [],
            university: '',
            team: [],
            month: [],
            program: '',
            source: '',
            search: '',
        });

    return (
        <TrackerThemeProvider value={contextValue}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box
                    sx={{
                        ...tokensSx,
                        minHeight: '100vh',
                        backgroundColor: 'var(--t-page-bg)',
                        color: 'var(--t-text)',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Top brand bar */}
                    <Box
                        sx={{
                            backgroundColor: '#1976D2',
                            color: '#fff',
                            py: 1.5,
                            px: 3,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {!isManager && (
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={() =>
                                        navigate(
                                            isAdmin
                                                ? '/admin/dashboard'
                                                : '/team-lead/dashboard'
                                        )
                                    }
                                    sx={{ color: '#fff', textTransform: 'none' }}
                                >
                                    Back
                                </Button>
                            )}
                            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                                Student Database
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {isManager && (
                                <Button
                                    startIcon={<ExportCenterIcon />}
                                    onClick={() => navigate('/exports')}
                                    sx={{ color: '#fff', textTransform: 'none' }}
                                >
                                    Open Export Center →
                                </Button>
                            )}
                            <Typography sx={{ fontSize: 13 }}>
                                {user?.name} (
                                {isAdmin
                                    ? 'Admin'
                                    : isManager
                                    ? 'Manager'
                                    : user?.teamName}
                                )
                            </Typography>
                            <Button
                                startIcon={<LogoutIcon />}
                                onClick={() => {
                                    logout();
                                    navigate('/login');
                                }}
                                sx={{ color: '#fff', textTransform: 'none' }}
                            >
                                Logout
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ px: 3, py: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {isAdmin && (
                            <Box sx={{ mb: 1.5 }}>
                                <AdminOrgTabs />
                            </Box>
                        )}

                        <StudentsKPIStrip cards={kpiCards} />

                        <StudentsToolbar
                            view={view}
                            onViewChange={setView}
                            filters={filters}
                            onClearFilters={clearFilters}
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                            onStartDateChange={(d) =>
                                setFilters((p) => ({ ...p, startDate: d }))
                            }
                            onEndDateChange={(d) =>
                                setFilters((p) => ({ ...p, endDate: d }))
                            }
                            searchValue={filters.search}
                            onSearchChange={(v) =>
                                setFilters((p) => ({ ...p, search: v }))
                            }
                            onAdd={handleAdd}
                            addLabel="New student"
                            showAdd={!isManager}
                            onExportXlsx={() => doExport('xlsx')}
                            onExportCsv={() => doExport('csv')}
                            onAIAnalysis={runAIAnalysis}
                            mode={mode}
                            onToggleMode={toggleTheme}
                            chipRow={chipRow}
                        />

                        {error && (
                            <Alert
                                severity="error"
                                sx={{ mb: 1.5 }}
                                onClose={() => setError('')}
                            >
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                            {view === 'table' ? (
                                <LucStudentsTableView
                                    students={displayed}
                                    loading={loading}
                                    page={page}
                                    limit={PAGE_SIZE}
                                    total={total}
                                    onPageChange={setPage}
                                    onRowClick={(s) => {
                                        setDrawerStudent(s);
                                        setDrawerOpen(true);
                                    }}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    canEdit={!isManager}
                                    canDelete={!isManager}
                                />
                            ) : (
                                <LucStudentsCardsView
                                    students={displayed}
                                    loading={loading}
                                    onRowClick={(s) => {
                                        setDrawerStudent(s);
                                        setDrawerOpen(true);
                                    }}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    canEdit={!isManager}
                                    canDelete={!isManager}
                                />
                            )}
                        </Box>
                    </Box>

                    <StudentFormDialog
                        open={dialogOpen}
                        onClose={() => {
                            setDialogOpen(false);
                            setSelectedStudent(null);
                        }}
                        onSave={handleSave}
                        student={selectedStudent}
                        consultants={consultants}
                        teamLeads={teamLeads}
                        currentUserRole={user?.role}
                        currentUser={user}
                    />

                    <LucStudentDetailDrawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        student={drawerStudent}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        canEdit={!isManager}
                        canDelete={!isManager}
                    />

                    <StudentsAIAnalysisDialog
                        open={aiOpen}
                        onClose={() => setAiOpen(false)}
                        loading={aiLoading}
                        analysis={aiAnalysis}
                        onRefresh={runAIAnalysis}
                        error={aiError}
                        title="Student Database AI analysis"
                    />

                    <Snackbar
                        open={toast.open}
                        autoHideDuration={3000}
                        onClose={() => setToast((t) => ({ ...t, open: false }))}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        <Alert
                            severity={toast.severity}
                            onClose={() => setToast((t) => ({ ...t, open: false }))}
                            sx={{ width: '100%' }}
                        >
                            {toast.msg}
                        </Alert>
                    </Snackbar>
                </Box>
            </LocalizationProvider>
        </TrackerThemeProvider>
    );
};

export default LucStudentDatabasePage;
