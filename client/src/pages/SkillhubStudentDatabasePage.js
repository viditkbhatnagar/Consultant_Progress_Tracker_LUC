import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Snackbar,
    Alert,
    ToggleButton,
    ToggleButtonGroup,
    Menu,
    MenuItem,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,
    ExpandMore as ExpandIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import studentService from '../services/studentService';
import consultantService from '../services/consultantService';
import xlsxBuilder from '../services/xlsxBuilder';
import { skillhubColumns } from '../config/exportColumns/students';
import { useAdminOrgScope, getAdminOrgScope } from '../utils/adminOrgScope';
import AdminOrgTabs from '../components/AdminOrgTabs';
import SkillhubStudentFormDialog from '../components/skillhub/SkillhubStudentFormDialog';
import ActivateStudentDialog from '../components/skillhub/ActivateStudentDialog';
import {
    TrackerThemeProvider,
    useThemeState,
} from '../utils/trackerTheme';
import {
    SKILLHUB_STATUS_META,
} from '../utils/studentDesign';
import StudentsToolbar, {
    FilterChip,
} from '../components/students/StudentsToolbar';
import StudentsKPIStrip from '../components/students/StudentsKPIStrip';
import StudentsAIAnalysisDialog from '../components/students/StudentsAIAnalysisDialog';
import SkillhubStudentsTableView from '../components/students/skillhub/SkillhubStudentsTableView';
import SkillhubStudentsCardsView from '../components/students/skillhub/SkillhubStudentsCardsView';
import SkillhubStudentDetailDrawer from '../components/students/skillhub/SkillhubStudentDetailDrawer';

const PAGE_SIZE = 50;
const CARDS_LIMIT = 500;

const SkillhubStudentDatabasePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [adminOrg] = useAdminOrgScope();
    const isAdmin = user?.role === 'admin';

    const { mode, toggle: toggleTheme, tokensSx, contextValue } = useThemeState(
        'students-theme-mode'
    );

    const [view, setView] = useState('table');
    const [curriculum, setCurriculum] = useState('CBSE');
    const [statusTab, setStatusTab] = useState('new_admission');
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        startDate: null,
        endDate: null,
        consultant: '',
    });

    const [counselors, setCounselors] = useState([]);
    const [students, setStudents] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Server-aggregated stats for the KPI strip — re-fetched when any
    // filter/tab changes so cards reflect the currently-narrowed window.
    // Curriculum + statusTab are the base scope; date + consultant
    // narrow further.
    const [stats, setStats] = useState(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [createStatus, setCreateStatus] = useState('new_admission');

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerStudent, setDrawerStudent] = useState(null);

    const [activateOpen, setActivateOpen] = useState(false);
    const [activatingStudent, setActivatingStudent] = useState(null);

    const [moveAnchor, setMoveAnchor] = useState(null);
    const [movingStudent, setMovingStudent] = useState(null);

    const [addAnchor, setAddAnchor] = useState(null);

    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiError, setAiError] = useState('');

    const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' });
    const showToast = (msg, severity = 'success') =>
        setToast({ open: true, msg, severity });

    // Org for admin context — the admin's current LUC/Skillhub scope must
    // be a Skillhub branch; we pass it explicitly to reads/writes.
    const scopeOrg = isAdmin ? getAdminOrgScope() : undefined;

    // ── LOADERS ──
    const loadCounselors = useCallback(async () => {
        try {
            const f = isAdmin ? { organization: adminOrg } : {};
            const res = await consultantService.getConsultants(f);
            setCounselors(res.data || []);
        } catch (err) {
            console.error('Failed to load counselors:', err);
        }
    }, [isAdmin, adminOrg]);

    const loadStats = useCallback(async () => {
        try {
            const res = await studentService.getStudentStats({
                studentStatus: statusTab,
                curriculumSlug: curriculum,
                startDate: filters.startDate
                    ? format(filters.startDate, 'yyyy-MM-dd')
                    : undefined,
                endDate: filters.endDate
                    ? format(filters.endDate, 'yyyy-MM-dd')
                    : undefined,
                consultant: filters.consultant || undefined,
                organization: scopeOrg,
            });
            setStats(res.data?.overview || null);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    }, [statusTab, curriculum, filters, scopeOrg]);

    const loadStudents = useCallback(async () => {
        try {
            setLoading(true);
            const res = await studentService.getStudents({
                studentStatus: statusTab,
                curriculumSlug: curriculum,
                startDate: filters.startDate
                    ? format(filters.startDate, 'yyyy-MM-dd')
                    : undefined,
                endDate: filters.endDate
                    ? format(filters.endDate, 'yyyy-MM-dd')
                    : undefined,
                consultant: filters.consultant || undefined,
                organization: scopeOrg,
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
    }, [statusTab, curriculum, filters, scopeOrg, view, page]);

    useEffect(() => {
        loadCounselors();
    }, [loadCounselors]);

    useEffect(() => {
        loadStudents();
    }, [loadStudents]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        setPage(1);
    }, [statusTab, curriculum, filters.startDate, filters.endDate, filters.consultant]);

    // ── CLIENT-SIDE SEARCH ──
    const displayed = students.filter((s) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return [
            s.studentName,
            s.enrollmentNumber,
            s.school,
            s.consultantName,
            s.phones?.student,
        ]
            .filter(Boolean)
            .some((f) => String(f).toLowerCase().includes(q));
    });

    // ── KPI ──
    // Stats-driven so the strip shows true totals. Curriculum + statusTab are
    // the base scope (always applied). Additional filters (date, consultant)
    // narrow further — without them the cards show the full current tab.
    const statusMeta = SKILLHUB_STATUS_META[statusTab];
    const sumFee = stats?.totalRevenue || 0;
    const sumOutstanding = stats?.totalOutstanding || 0;

    // Coverage sub-label: if a date filter is active, show that window;
    // otherwise show earliest createdAt in scope up to today.
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
            const min = stats?.minCreatedAt;
            return `${min ? fmtDate(min) : '—'} – ${fmtDate(filters.endDate)}`;
        }
        const min = stats?.minCreatedAt;
        return min ? `${fmtDate(min)} – ${fmtDate(new Date())}` : null;
    })();

    const kpiCards = [
        {
            label: statusMeta?.lbl || 'Students',
            value: stats ? stats.totalStudents.toLocaleString() : '—',
            color: statusMeta?.color || '#2563EB',
            sub: windowSub,
        },
        {
            label: 'Course Fees',
            value: `AED ${Math.round(sumFee).toLocaleString()}`,
            color: '#16A34A',
            sub: windowSub,
        },
        {
            label: 'Outstanding',
            value: `AED ${Math.round(sumOutstanding).toLocaleString()}`,
            color: sumOutstanding > 0 ? '#BE185D' : 'var(--t-text-faint)',
            sub: windowSub,
        },
        {
            label: 'Counselors',
            value: stats ? stats.consultantCount : '—',
            color: '#7C3AED',
            sub: windowSub,
        },
    ];

    // ── CRUD ──
    const handleCreate = (status) => {
        setEditingStudent(null);
        setCreateStatus(status);
        setFormOpen(true);
        setAddAnchor(null);
    };
    const handleEdit = (s) => {
        setDrawerOpen(false);
        setEditingStudent(s);
        setFormOpen(true);
    };
    const handleDelete = async (s) => {
        if (!window.confirm(`Delete student "${s.studentName}"?`)) return;
        try {
            await studentService.deleteStudent(s._id);
            setDrawerOpen(false);
            loadStudents();
            showToast('Student deleted');
        } catch (err) {
            showToast(err.response?.data?.message || 'Delete failed', 'error');
        }
    };
    const handleSave = async (formData) => {
        // Admin creates inside a branch -> derive teamLeadId from counselor
        let payload = formData;
        if (scopeOrg && !editingStudent) {
            const chosen = counselors.find((c) => c._id === formData.consultantId);
            const teamLeadId =
                chosen?.teamLead?._id || chosen?.teamLead || undefined;
            payload = {
                ...formData,
                organization: scopeOrg,
                ...(teamLeadId ? { teamLeadId } : {}),
            };
        }
        if (editingStudent) {
            await studentService.updateStudent(editingStudent._id, payload);
            showToast('Student updated');
        } else {
            await studentService.createStudent(payload);
            showToast('Student created');
        }
        await loadStudents();
    };

    // Shared menu opener — table/cards/drawer all route through this.
    // The Table's own internal Menu is separate; this one is for drawer/cards.
    const openMoveMenuFromAnchor = (e, s) => {
        setMovingStudent(s);
        setMoveAnchor(e?.currentTarget || null);
    };
    const closeMoveMenu = () => {
        setMoveAnchor(null);
        setMovingStudent(null);
    };
    const handleMove = async (student, target) => {
        if (!student) return;
        // new_admission → active keeps the rich Activate dialog (emirate /
        // registrationFee / dateOfEnrollment / EMIs).
        if (student.studentStatus === 'new_admission' && target === 'active') {
            setActivatingStudent(student);
            setActivateOpen(true);
            return;
        }
        try {
            await studentService.changeStudentStatus(student._id, target);
            setDrawerOpen(false);
            loadStudents();
            showToast(`Moved to ${SKILLHUB_STATUS_META[target].lbl}`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Move failed', 'error');
        }
    };
    const handleActivate = async (payload) => {
        await studentService.activateStudent(activatingStudent._id, payload);
        setDrawerOpen(false);
        loadStudents();
        showToast('Student activated');
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
                curriculumSlug: curriculum,
            });
            setAiAnalysis(res.analysis || 'No analysis available.');
        } catch (err) {
            setAiError(err.response?.data?.message || 'Failed to generate analysis');
        } finally {
            setAiLoading(false);
        }
    };

    // ── EXPORT ──
    // Earlier version exported only `displayed` rows (the current page).
    // Admin reported the download was always "first page only". Now we
    // fetch every page that matches the server-side filters, then apply
    // the client-side search predicate, then hand the full set to
    // xlsxBuilder.
    const [exporting, setExporting] = useState(false);
    const doExport = async (kind) => {
        if (exporting) return;
        setExporting(true);
        const EXPORT_PAGE_SIZE = 500;
        const baseFilters = {
            studentStatus: statusTab,
            curriculumSlug: curriculum,
            startDate: filters.startDate
                ? format(filters.startDate, 'yyyy-MM-dd')
                : undefined,
            endDate: filters.endDate
                ? format(filters.endDate, 'yyyy-MM-dd')
                : undefined,
            consultant: filters.consultant || undefined,
            organization: scopeOrg,
            limit: EXPORT_PAGE_SIZE,
        };
        try {
            showToast('Preparing export…');
            const all = [];
            let p = 1;
            const MAX_PAGES = 100;
            while (p <= MAX_PAGES) {
                const res = await studentService.getStudents({ ...baseFilters, page: p });
                const rows = res?.data || [];
                all.push(...rows);
                const pages = res?.pagination?.pages ?? 1;
                if (p >= pages || rows.length === 0) break;
                p++;
            }
            const q = search.trim().toLowerCase();
            const exportRows = q
                ? all.filter((s) => [
                    s.studentName,
                    s.enrollmentNumber,
                    s.school,
                    s.consultantName,
                    s.phones?.student,
                ]
                    .filter(Boolean)
                    .some((f) => String(f).toLowerCase().includes(q))
                )
                : all;
            const filename = `skillhub_${curriculum}_${statusTab}`;
            xlsxBuilder.exportRawSheet(exportRows, skillhubColumns, filename, kind);
            showToast(`Exported ${exportRows.length} rows (${kind.toUpperCase()})`);
        } catch (err) {
            showToast(err?.response?.data?.message || 'Export failed', 'error');
        } finally {
            setExporting(false);
        }
    };

    const counselorOptions = counselors.map((c) => ({
        value: c.name,
        label: c.name,
    }));

    const chipRow = (
        <FilterChip
            label="Counselor"
            value={filters.consultant}
            options={counselorOptions}
            onChange={(v) => setFilters((p) => ({ ...p, consultant: v }))}
        />
    );

    // Extra toolbar content: curriculum + status tabs go in `renderViewExtra`
    const renderViewExtra = (
        <>
            <ToggleButtonGroup
                value={curriculum}
                exclusive
                onChange={(_e, v) => v && setCurriculum(v)}
                size="small"
                sx={{
                    ml: 1,
                    backgroundColor: 'var(--t-surface-muted)',
                    border: '1px solid var(--t-border)',
                    borderRadius: '10px',
                    padding: '3px',
                    '& .MuiToggleButton-root': {
                        border: 0,
                        borderRadius: '8px !important',
                        color: 'var(--t-text-3)',
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        px: 1.25,
                        py: 0.5,
                    },
                    '& .MuiToggleButton-root.Mui-selected': {
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        boxShadow: 'var(--t-shadow-card-sm)',
                    },
                }}
            >
                <ToggleButton value="CBSE">CBSE</ToggleButton>
                <ToggleButton value="IGCSE">IGCSE</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
                value={statusTab}
                exclusive
                onChange={(_e, v) => v && setStatusTab(v)}
                size="small"
                sx={{
                    backgroundColor: 'var(--t-surface-muted)',
                    border: '1px solid var(--t-border)',
                    borderRadius: '10px',
                    padding: '3px',
                    '& .MuiToggleButton-root': {
                        border: 0,
                        borderRadius: '8px !important',
                        color: 'var(--t-text-3)',
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        px: 1.25,
                        py: 0.5,
                    },
                    '& .MuiToggleButton-root.Mui-selected': {
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        boxShadow: 'var(--t-shadow-card-sm)',
                    },
                }}
            >
                <ToggleButton value="new_admission">New</ToggleButton>
                <ToggleButton value="active">Active</ToggleButton>
                <ToggleButton value="inactive">Inactive</ToggleButton>
            </ToggleButtonGroup>
        </>
    );

    // The "New student" button opens a menu of three status targets (matching
    // the original SkillhubStudentTable which had three separate buttons).
    const addExtra = (
        <>
            <Button
                size="small"
                variant="contained"
                onClick={(e) => setAddAnchor(e.currentTarget)}
                endIcon={<ExpandIcon sx={{ fontSize: 16 }} />}
                startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                sx={{
                    textTransform: 'none',
                    fontSize: 12.5,
                    fontWeight: 600,
                    px: 1.75,
                    borderRadius: '8px',
                    boxShadow: 'none',
                }}
            >
                New student
            </Button>
            <Menu
                anchorEl={addAnchor}
                open={Boolean(addAnchor)}
                onClose={() => setAddAnchor(null)}
                PaperProps={{
                    sx: {
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        border: '1px solid var(--t-border)',
                        boxShadow: 'var(--t-shadow-elev)',
                    },
                }}
            >
                {['new_admission', 'active', 'inactive'].map((s) => {
                    const meta = SKILLHUB_STATUS_META[s];
                    return (
                        <MenuItem
                            key={s}
                            onClick={() => handleCreate(s)}
                            sx={{ fontSize: 12.5, gap: 1 }}
                        >
                            <Box
                                sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: meta.color,
                                }}
                            />
                            {meta.lbl}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );

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
                            <Button
                                startIcon={<ArrowBackIcon />}
                                onClick={() =>
                                    navigate(
                                        isAdmin ? '/admin/dashboard' : '/skillhub/dashboard'
                                    )
                                }
                                sx={{ color: '#fff', textTransform: 'none' }}
                            >
                                Back
                            </Button>
                            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                                Student Database
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography sx={{ fontSize: 13 }}>
                                {user?.name} ({isAdmin ? 'Admin' : user?.teamName})
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
                            startDate={filters.startDate}
                            endDate={filters.endDate}
                            onStartDateChange={(d) =>
                                setFilters((p) => ({ ...p, startDate: d }))
                            }
                            onEndDateChange={(d) =>
                                setFilters((p) => ({ ...p, endDate: d }))
                            }
                            searchValue={search}
                            onSearchChange={setSearch}
                            onAddExtra={addExtra}
                            showAdd={false}
                            onExportXlsx={() => doExport('xlsx')}
                            onExportCsv={() => doExport('csv')}
                            onAIAnalysis={runAIAnalysis}
                            mode={mode}
                            onToggleMode={toggleTheme}
                            chipRow={chipRow}
                            renderViewExtra={renderViewExtra}
                            onClearFilters={() =>
                                setFilters({ startDate: null, endDate: null, consultant: '' })
                            }
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
                                <SkillhubStudentsTableView
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
                                    onMove={handleMove}
                                />
                            ) : (
                                <SkillhubStudentsCardsView
                                    students={displayed}
                                    loading={loading}
                                    onRowClick={(s) => {
                                        setDrawerStudent(s);
                                        setDrawerOpen(true);
                                    }}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                    onMove={openMoveMenuFromAnchor}
                                />
                            )}
                        </Box>
                    </Box>

                    <SkillhubStudentFormDialog
                        open={formOpen}
                        onClose={() => {
                            setFormOpen(false);
                            setEditingStudent(null);
                        }}
                        onSave={handleSave}
                        student={editingStudent}
                        counselors={counselors}
                        initialStatus={createStatus}
                    />

                    <ActivateStudentDialog
                        open={activateOpen}
                        onClose={() => setActivateOpen(false)}
                        onConfirm={handleActivate}
                        student={activatingStudent}
                    />

                    <SkillhubStudentDetailDrawer
                        open={drawerOpen}
                        onClose={() => setDrawerOpen(false)}
                        student={drawerStudent}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onMove={openMoveMenuFromAnchor}
                    />

                    <Menu
                        anchorEl={moveAnchor}
                        open={Boolean(moveAnchor)}
                        onClose={closeMoveMenu}
                        PaperProps={{
                            sx: {
                                backgroundColor: 'var(--t-surface)',
                                color: 'var(--t-text)',
                                border: '1px solid var(--t-border)',
                                boxShadow: 'var(--t-shadow-elev)',
                            },
                        }}
                    >
                        {['new_admission', 'active', 'inactive']
                            .filter((s) => s !== movingStudent?.studentStatus)
                            .map((s) => (
                                <MenuItem
                                    key={s}
                                    onClick={() => {
                                        const target = movingStudent;
                                        closeMoveMenu();
                                        handleMove(target, s);
                                    }}
                                    sx={{ fontSize: 12.5 }}
                                >
                                    Move to {SKILLHUB_STATUS_META[s].lbl}
                                </MenuItem>
                            ))}
                    </Menu>

                    <StudentsAIAnalysisDialog
                        open={aiOpen}
                        onClose={() => setAiOpen(false)}
                        loading={aiLoading}
                        analysis={aiAnalysis}
                        onRefresh={runAIAnalysis}
                        error={aiError}
                        title="Skillhub Student AI analysis"
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

export default SkillhubStudentDatabasePage;
