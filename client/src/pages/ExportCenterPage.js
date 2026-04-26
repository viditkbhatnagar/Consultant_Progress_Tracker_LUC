import React from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Stack,
    Button,
    Popover,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import SectionCard from '../components/dashboard/SectionCard';
import { useDashboardThemeState } from '../utils/dashboardTheme';

import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import ManagerSidebar from '../components/ManagerSidebar';
import SkillhubSidebar from '../components/skillhub/SkillhubSidebar';

import DatasetSelector from '../components/exports/DatasetSelector';
import ExportOrgTabs from '../components/exports/ExportOrgTabs';
import DateRangeChips from '../components/exports/DateRangeChips';
import PreviewTab from '../components/exports/PreviewTab';
import TemplatesTab from '../components/exports/TemplatesTab';
import HeaderDownloadButtons from '../components/exports/HeaderDownloadButtons';
import PivotControlsPanel from '../components/exports/PivotControlsPanel';
import ColumnPicker from '../components/exports/ColumnPicker';

import exportsApi from '../services/exportsApi';
import { defaultsForOrg } from '../config/exportColumns/students';
import { commitmentsColumns } from '../config/exportColumns/commitments';
import { meetingsColumns } from '../config/exportColumns/meetings';
import { hourlyRawColumns } from '../config/exportColumns/hourlyRaw';

function rawColumnsForDataset(dataset, organization) {
    if (dataset === 'students')    return defaultsForOrg(organization);
    if (dataset === 'commitments') return commitmentsColumns;
    if (dataset === 'meetings')    return meetingsColumns;
    if (dataset === 'hourly')      return hourlyRawColumns;
    return [];
}

function defaultOrgFor(user) {
    if (!user) return 'luc';
    if (user.role === 'admin' || user.role === 'manager') return 'luc';
    if (user.role === 'team_lead') return 'luc';
    if (user.role === 'skillhub') return user.organization || 'skillhub_training';
    return 'luc';
}

function resolveRoleChrome(user, navigate, logout) {
    const role = user?.role;
    if (role === 'admin') {
        return {
            sidebar: (
                <AdminSidebar
                    onLogout={logout}
                    onAIAnalysis={() => navigate('/admin/dashboard')}
                    onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
                    onDashboard={() => navigate('/admin/dashboard')}
                />
            ),
            backRoute: '/admin/dashboard',
            eyebrow: 'Administrator',
        };
    }
    if (role === 'team_lead') {
        return {
            sidebar: (
                <Sidebar
                    onAddCommitment={() => navigate('/team-lead/dashboard')}
                    onLogout={logout}
                    onAIAnalysis={() => navigate('/team-lead/dashboard')}
                    onDashboard={() => navigate('/team-lead/dashboard')}
                />
            ),
            backRoute: '/team-lead/dashboard',
            eyebrow: user?.teamName || 'Team Lead',
        };
    }
    if (role === 'manager') {
        return {
            sidebar: <ManagerSidebar onLogout={logout} />,
            backRoute: '/student-database',
            eyebrow: 'Manager',
        };
    }
    if (role === 'skillhub') {
        return {
            sidebar: (
                <SkillhubSidebar
                    activeView="exports"
                    onNavigate={() => navigate('/skillhub/dashboard')}
                    onNewAdmission={() => navigate('/skillhub/dashboard')}
                    onLogout={logout}
                />
            ),
            backRoute: '/skillhub/dashboard',
            eyebrow:
                user?.organization === 'skillhub_training'
                    ? 'Skillhub Training'
                    : 'Skillhub Institute',
        };
    }
    return { sidebar: null, backRoute: '/', eyebrow: '' };
}

const ExportCenterPage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const themeState = useDashboardThemeState('exports-theme-mode');

    const [dataset, setDataset] = React.useState('students');
    const [organization, setOrganization] = React.useState(defaultOrgFor(user));
    const [dateRange, setDateRange] = React.useState({ preset: 'All time', startDate: null, endDate: null });
    const [tab, setTab] = React.useState('preview');

    // ── State lifted from PreviewTab so Pivot + Columns can be edited from
    //    inline popover triggers in the tab strip (see Popovers below) and
    //    still drive the table render inside PreviewTab.
    const [allColumns, setAllColumns] = React.useState([]);
    const [selectedKeys, setSelectedKeys] = React.useState([]);
    const [pivotConfig, setPivotConfig] = React.useState({});
    const [dimensions, setDimensions] = React.useState([]);
    const [measures, setMeasures] = React.useState([]);
    const [previewState, setPreviewState] = React.useState(null);
    const [railToast, setRailToast] = React.useState(null); // eslint-disable-line no-unused-vars

    // Popover anchors for the inline Pivot + Columns triggers in the tab strip.
    const [pivotAnchor, setPivotAnchor] = React.useState(null);
    const [columnsAnchor, setColumnsAnchor] = React.useState(null);

    // When a saved template is being loaded (Run from TemplatesTab), the
    // dataset/org-reset effect below would otherwise wipe the pivotConfig we
    // just set. The handler flips this ref to skip the reset exactly once.
    const skipPivotResetOnce = React.useRef(false);

    // Reset column config + selection on dataset/org change.
    React.useEffect(() => {
        const cols = rawColumnsForDataset(dataset, organization);
        setAllColumns(cols);
        setSelectedKeys(cols.filter((c) => c.defaultExport).map((c) => c.key));
        if (skipPivotResetOnce.current) {
            skipPivotResetOnce.current = false;
        } else {
            setPivotConfig({});
        }
    }, [dataset, organization]);

    // Fetch dimensions + measures whenever the dataset/org pair changes.
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await exportsApi.getDimensions(dataset, organization);
                if (cancelled) return;
                setDimensions(res.dimensions || []);
                setMeasures(res.measures || []);
            } catch (err) {
                if (cancelled) return;
                setRailToast({ severity: 'error', message: err?.response?.data?.message || err.message });
            }
        })();
        return () => { cancelled = true; };
    }, [dataset, organization]);

    const { sidebar, backRoute, eyebrow } = resolveRoleChrome(user, navigate, logout);

    const heroRight = (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
                size="small"
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(backRoute)}
                sx={{
                    color: 'var(--d-text-2)',
                    textTransform: 'none',
                    fontWeight: 600,
                }}
            >
                Dashboard
            </Button>
            {tab === 'preview' && <HeaderDownloadButtons previewState={previewState} />}
        </Stack>
    );

    const previewMode = pivotConfig.rowDim ? 'pivot' : 'raw';
    const showInlineControls = tab === 'preview';
    const pivotActive = !!pivotConfig.rowDim;

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow={eyebrow}
                title="Export Center"
                subtitle="Preview and download tracker data."
                right={heroRight}
            />

            {/* Section 1 — Scope */}
            <SectionCard eyebrow="Scope" title="Dataset, organization, date range">
                <Stack spacing={2.5}>
                    <Box>
                        <Typography
                            variant="overline"
                            sx={{ display: 'block', mb: 0.75, color: 'var(--d-text-muted)', letterSpacing: 1, fontWeight: 600 }}
                        >
                            Dataset
                        </Typography>
                        <DatasetSelector value={dataset} onChange={setDataset} />
                    </Box>

                    <ExportOrgTabs
                        value={organization}
                        onChange={setOrganization}
                        dataset={dataset}
                        includeAll
                        sx={{ mb: 0 }}
                    />

                    <Box>
                        <Typography
                            variant="overline"
                            sx={{ display: 'block', mb: 0.75, color: 'var(--d-text-muted)', letterSpacing: 1, fontWeight: 600 }}
                        >
                            Date range
                        </Typography>
                        <DateRangeChips value={dateRange} onChange={setDateRange} />
                    </Box>
                </Stack>
            </SectionCard>

            {/* Section 2 — Tabs + table, full viewport width.
                Pivot + Columns now live as popover triggers inside the tab
                strip (see right-side Stack below) instead of a 320px rail. */}
            <SectionCard padding={0} sx={{ overflow: 'hidden', minWidth: 0 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    sx={{
                        px: 2,
                        pt: 1,
                        borderBottom: '1px solid var(--d-border)',
                        gap: 1,
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{
                            minHeight: 48,
                            '& .MuiTabs-indicator': { bottom: 0 },
                            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
                        }}
                    >
                        <Tab label="Preview" value="preview" />
                        <Tab label="Templates" value="templates" />
                    </Tabs>

                    <Box sx={{ flexGrow: 1 }} />

                    {showInlineControls && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                size="small"
                                variant={pivotActive ? 'contained' : 'outlined'}
                                color={pivotActive ? 'primary' : 'inherit'}
                                startIcon={<PivotTableChartIcon fontSize="small" />}
                                onClick={(e) => setPivotAnchor(e.currentTarget)}
                                sx={{ textTransform: 'none', fontWeight: 600 }}
                            >
                                Pivot{pivotActive ? ' • on' : ''}
                            </Button>
                            {previewMode === 'raw' && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<ViewColumnIcon fontSize="small" />}
                                    onClick={(e) => setColumnsAnchor(e.currentTarget)}
                                    sx={{ textTransform: 'none', fontWeight: 600 }}
                                >
                                    Columns ({selectedKeys.length}/{allColumns.length})
                                </Button>
                            )}
                        </Stack>
                    )}
                </Stack>

                {tab === 'preview' && (
                    <Box sx={{ p: 2.5, minWidth: 0 }}>
                        <PreviewTab
                            dataset={dataset}
                            organization={organization}
                            dateRange={dateRange}
                            onPreviewChange={setPreviewState}
                            dimensions={dimensions}
                            measures={measures}
                            allColumns={allColumns}
                            selectedKeys={selectedKeys}
                            pivotConfig={pivotConfig}
                        />
                    </Box>
                )}

                {tab === 'templates' && (
                    <Box sx={{ p: 2.5, minWidth: 0 }}>
                        <TemplatesTab
                            dataset={dataset}
                            organization={organization}
                            dateRange={dateRange}
                            onLoadSavedTemplate={(t) => {
                                // Run action on a saved template — load its
                                // dataset/org/config into the Export Center
                                // state and switch to the Preview tab. The
                                // Pivot Builder picks up `pivotConfig` and
                                // PreviewTab's effect refetches automatically.
                                // Set the skip-flag so the dataset/org reset
                                // effect doesn't wipe the pivotConfig we just
                                // loaded.
                                const datasetChanged = t.dataset && t.dataset !== dataset;
                                const orgChanged = t.organization && t.organization !== organization;
                                if (datasetChanged || orgChanged) {
                                    skipPivotResetOnce.current = true;
                                }
                                if (datasetChanged) setDataset(t.dataset);
                                if (orgChanged)     setOrganization(t.organization);
                                setPivotConfig(t.config || {});
                                setTab('preview');
                            }}
                        />
                    </Box>
                )}
            </SectionCard>

            {/* Pivot popover */}
            <Popover
                open={!!pivotAnchor}
                anchorEl={pivotAnchor}
                onClose={() => setPivotAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            p: 2,
                            width: 340,
                            maxWidth: 'calc(100vw - 32px)',
                            bgcolor: 'var(--d-surface)',
                            borderRadius: '14px',
                            border: '1px solid var(--d-border)',
                        },
                    },
                }}
            >
                <PivotControlsPanel
                    dataset={dataset}
                    organization={organization}
                    dimensions={dimensions}
                    measures={measures}
                    pivotConfig={pivotConfig}
                    onChange={setPivotConfig}
                    onToast={setRailToast}
                />
            </Popover>

            {/* Columns popover (raw mode only) */}
            <Popover
                open={!!columnsAnchor}
                anchorEl={columnsAnchor}
                onClose={() => setColumnsAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1,
                            p: 2,
                            width: 320,
                            maxWidth: 'calc(100vw - 32px)',
                            maxHeight: '70vh',
                            bgcolor: 'var(--d-surface)',
                            borderRadius: '14px',
                            border: '1px solid var(--d-border)',
                        },
                    },
                }}
            >
                <Stack
                    direction="row"
                    alignItems="baseline"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Columns
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {selectedKeys.length} / {allColumns.length}
                    </Typography>
                </Stack>
                <ColumnPicker
                    columns={allColumns}
                    value={selectedKeys}
                    onChange={setSelectedKeys}
                />
            </Popover>
        </DashboardShell>
    );
};

export default ExportCenterPage;
