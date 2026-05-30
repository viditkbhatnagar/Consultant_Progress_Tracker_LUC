import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    LinearProgress,
    Tooltip,
    Stack,
    Button,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import TeamGauges from '../components/dashboard/TeamGauges';
import DashboardHero from '../components/dashboard/DashboardHero';
import ComingSoonLock from '../components/ComingSoonLock';
import EChart from '../components/charts/EChart';
import { barOption, lineOption, compactCurrencyFmt } from '../components/charts/presets';
import ProgramMonthHeatmap from '../components/charts/ProgramMonthHeatmap';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import { getOverview } from '../services/execOverviewService';
import { buildWorkbook, downloadBlob } from '../services/xlsxBuilder';

const fmtCurrency = (n) => {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED',
        maximumFractionDigits: 0,
    }).format(n);
};

const fmtPct = (n) => {
    if (n == null || Number.isNaN(n)) return '0.0%';
    return `${(n * 100).toFixed(1)}%`;
};

const fmtCount = (n) => (n == null ? '0' : Number(n).toLocaleString('en-US'));

const statusChip = (status) => {
    const map = {
        'On Track': { color: 'success', bg: 'rgba(46,160,67,0.12)', text: '#1F7A35' },
        'Behind': { color: 'warning', bg: 'rgba(217,119,6,0.14)', text: '#A35A06' },
    };
    const cfg = map[status] || map['Behind'];
    return (
        <Chip
            label={status}
            size="small"
            sx={{
                bgcolor: cfg.bg,
                color: cfg.text,
                fontWeight: 600,
                borderRadius: '8px',
            }}
        />
    );
};

const KpiTile = ({ label, value, sublabel, accent = '#2383E2' }) => (
    <Paper
        elevation={0}
        sx={{
            p: 2.5,
            borderRadius: '14px',
            border: '1px solid var(--d-border-soft, #ECE9E2)',
            backgroundColor: 'var(--d-surface, #FFFFFF)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            minHeight: 112,
            position: 'relative',
            overflow: 'hidden',
        }}
    >
        <Box
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 4,
                height: '100%',
                bgcolor: accent,
            }}
        />
        <Typography
            sx={{
                fontSize: 11,
                color: 'var(--d-text-muted, #8A887E)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
            }}
        >
            {label}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 700, color: 'var(--d-text, #191918)', lineHeight: 1.1 }}>
            {value}
        </Typography>
        {sublabel ? (
            <Typography sx={{ fontSize: 12, color: 'var(--d-text-3, #57564E)', mt: 0.5 }}>
                {sublabel}
            </Typography>
        ) : null}
    </Paper>
);

const SectionTitle = ({ children, accent = '#2383E2' }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, mt: 4 }}>
        <Box sx={{ width: 4, height: 22, bgcolor: accent, borderRadius: '2px' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--d-text, #191918)', letterSpacing: '-0.01em' }}>
            {children}
        </Typography>
    </Box>
);

const yearOptions = () => {
    const now = new Date().getUTCFullYear();
    const out = [];
    for (let y = now + 1; y >= 2023; y--) out.push(y);
    return out;
};

// Replace trailing-zero months with null so a trend line ends at the last
// active month instead of flat-lining (and dipping) to the year's end.
const trimTrailingZeros = (arr) => {
    let last = -1;
    for (let i = 0; i < arr.length; i++) if (arr[i] > 0) last = i;
    return arr.map((v, i) => (i <= last ? v : null));
};

const ExecutiveOverviewPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [month, setMonth] = useState(0); // 0 = current/latest-active month
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    // Team leads see a Coming Soon placeholder while the feature is
    // under development on the TL side. Admin keeps the full view.
    const isTeamLead = user?.role === 'team_lead';

    const loadOverview = useCallback(() => {
        if (isTeamLead) {
            setLoading(false);
            return;
        }
        getOverview(year, month)
            .then((res) => {
                setData(res.data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.response?.data?.message || err.message || 'Failed to load Leadership Dashboard');
                setLoading(false);
            });
    }, [year, month, isTeamLead]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        loadOverview();
    }, [loadOverview]);

    // Live updates: any team-entry / consultant / user change for this year
    // re-fetches the rollup (debounced). No-op when socket is down.
    useRealtimeRefresh(
        ['teamEntry:upserted', 'teamEntry:bulk', 'teamEntry:deleted', 'consultant:created', 'consultant:updated', 'consultant:deactivated', 'user:created'],
        loadOverview,
        { year, month }
    );

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const sidebar = user?.role === 'admin' ? (
        <AdminSidebar
            onLogout={handleLogout}
            onDashboard={() => navigate('/admin/dashboard')}
            onAIAnalysis={() => navigate('/admin/dashboard?section=ai')}
            onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
        />
    ) : (
        <Sidebar
            onLogout={handleLogout}
            onDashboard={() => navigate('/team-lead/dashboard')}
        />
    );

    const monthShort = useMemo(() => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], []);

    // Build a multi-sheet .xlsx of the on-screen tables for the resolved month.
    const handleDownload = () => {
        if (!data) return;
        const mLabel = monthShort[(data.kpi.mtdMonth || 1) - 1] || '';
        const pctStr = (n) => `${((n || 0) * 100).toFixed(1)}%`;

        const mtdRows = data.teamsMtd.map((t, i) => ({
            rank: t.isAdminAdjustment ? '' : i + 1,
            team: t.teamName,
            leader: t.leader,
            mtdTarget: t.mtdTarget,
            mtdAchieved: t.mtdAchieved,
            mtdPct: pctStr(t.mtdPercent),
            status: t.status,
        }));
        mtdRows.push({
            rank: '', team: 'GRAND TOTAL', leader: '',
            mtdTarget: data.kpi.mtdTarget, mtdAchieved: data.kpi.mtdAchieved,
            mtdPct: pctStr(data.kpi.mtdTarget ? data.kpi.mtdAchieved / data.kpi.mtdTarget : 0), status: '',
        });
        const mtdCols = [
            { key: 'rank', lbl: '#' }, { key: 'team', lbl: 'Team' }, { key: 'leader', lbl: 'Leader' },
            { key: 'mtdTarget', lbl: 'MTD Target', money: true }, { key: 'mtdAchieved', lbl: 'MTD Achieved', money: true },
            { key: 'mtdPct', lbl: 'MTD %' }, { key: 'status', lbl: 'Status' },
        ];

        const ytdRows = data.teamsYtd.map((t, i) => ({
            rank: i + 1, team: t.teamName, leader: t.leader,
            ytdTarget: t.ytdTarget, ytdAchieved: t.ytdAchieved, ytdPct: pctStr(t.ytdPercent), remaining: t.remaining,
        }));
        ytdRows.push({
            rank: '', team: 'GRAND TOTAL', leader: '',
            ytdTarget: data.kpi.ytdTarget, ytdAchieved: data.kpi.ytdAchieved, ytdPct: pctStr(data.kpi.ytdPercent), remaining: data.kpi.ytdGap,
        });
        const ytdCols = [
            { key: 'rank', lbl: '#' }, { key: 'team', lbl: 'Team' }, { key: 'leader', lbl: 'Leader' },
            { key: 'ytdTarget', lbl: 'YTD Target', money: true }, { key: 'ytdAchieved', lbl: 'YTD Achieved', money: true },
            { key: 'ytdPct', lbl: 'YTD %' }, { key: 'remaining', lbl: 'Remaining', money: true },
        ];

        const progCols = [
            { key: 'program', lbl: 'Program' },
            ...monthShort.map((m, i) => ({ key: `m${i}`, lbl: m })),
            { key: 'ytd', lbl: 'YTD' }, { key: 'share', lbl: '% Share' },
        ];
        const progRows = data.programs.map((r) => ({
            program: r.program + (r.isAgi ? ' (excl.)' : ''),
            ...Object.fromEntries(r.monthly.map((v, i) => [`m${i}`, v || 0])),
            ytd: r.ytdTotal,
            share: r.share == null ? '' : pctStr(r.share),
        }));
        progRows.push({
            program: 'GRAND TOTAL',
            ...Object.fromEntries(data.programGrandTotal.monthly.map((v, i) => [`m${i}`, v || 0])),
            ytd: data.programGrandTotal.ytdTotal, share: '100.0%',
        });

        const blob = buildWorkbook({
            sheets: [
                { name: 'MTD Team Performance', rows: mtdRows, columns: mtdCols },
                { name: 'YTD Team Performance', rows: ytdRows, columns: ytdCols },
                { name: 'Program Admissions', rows: progRows, columns: progCols },
            ],
        });
        downloadBlob(blob, `Leadership-Dashboard-${mLabel}-${year}.xlsx`);
    };

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Sales Performance"
                title="Leadership Dashboard"
                subtitle={`Year ${year} · All teams roll-up · Updates live as entries change`}
                right={
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel>Month</InputLabel>
                            <Select value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
                                <MenuItem value={0}>Current month</MenuItem>
                                {monthShort.map((m, i) => (
                                    <MenuItem key={m} value={i + 1}>{m}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel>Year</InputLabel>
                            <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
                                {yearOptions().map((y) => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={handleDownload}
                            disabled={!data}
                            sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                            Download
                        </Button>
                    </Stack>
                }
            />

            {isTeamLead ? (
                <ComingSoonLock
                    title="Leadership Dashboard"
                    subtitle="A new org-wide sales rollup with KPI strip, team performance tables, charts, and a program × month admissions matrix. Coming soon for team leads."
                />
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            ) : data ? (
                <Box sx={{ pb: 6 }}>
                    {/* KPI strip */}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <KpiTile
                                label="YTD Target"
                                value={fmtCurrency(data.kpi.ytdTarget)}
                                sublabel="Annual goal"
                                accent="#2383E2"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <KpiTile
                                label="YTD Achieved"
                                value={fmtCurrency(data.kpi.ytdAchieved)}
                                sublabel="Revenue achieved"
                                accent="#1F7A35"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <KpiTile
                                label="YTD Gap"
                                value={fmtCurrency(data.kpi.ytdGap)}
                                sublabel="Remaining target"
                                accent="#D97706"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <KpiTile
                                label="Overall YTD %"
                                value={fmtPct(data.kpi.ytdPercent)}
                                accent="#6E40C9"
                            />
                        </Grid>
                    </Grid>

                    {/* MTD Team Performance (detailed table) — tables first, gauges pushed below */}
                    <SectionTitle accent="#2383E2">{`MTD Team Performance${data.kpi.mtdMonth ? ` · ${monthShort[data.kpi.mtdMonth - 1]} ${year}` : ''}`}</SectionTitle>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Leader</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">MTD Target</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">MTD Achieved</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">MTD %</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.teamsMtd.filter((t) => t.mtdTarget > 0 || t.mtdAchieved > 0).map((t, i) => (
                                        <TableRow
                                            key={t.id}
                                            hover
                                            sx={{ cursor: t.isAdminAdjustment ? 'default' : 'pointer' }}
                                            onClick={t.isAdminAdjustment ? undefined : () => navigate(`/team-dashboard/${t.id}?year=${year}`)}
                                        >
                                            <TableCell>{t.isAdminAdjustment ? '' : i + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{t.teamName}</TableCell>
                                            <TableCell>{t.leader}</TableCell>
                                            <TableCell align="right">{fmtCurrency(t.mtdTarget)}</TableCell>
                                            <TableCell align="right">{fmtCurrency(t.mtdAchieved)}</TableCell>
                                            <TableCell align="right">
                                                <Box sx={{ minWidth: 110 }}>
                                                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                                        {fmtPct(t.mtdPercent)}
                                                    </Typography>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min(100, t.mtdPercent * 100)}
                                                        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell>{statusChip(t.status)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow sx={{ bgcolor: 'rgba(35,131,226,0.05)' }}>
                                        <TableCell></TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>GRAND TOTAL</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(data.kpi.mtdTarget)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(data.kpi.mtdAchieved)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {fmtPct(data.kpi.mtdTarget ? data.kpi.mtdAchieved / data.kpi.mtdTarget : 0)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* YTD Team Performance */}
                    <SectionTitle accent="#1F7A35">YTD Team Performance</SectionTitle>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Leader</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">YTD Target</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">YTD Achieved</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">YTD %</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">Remaining</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.teamsYtd.map((t, i) => (
                                        <TableRow
                                            key={t.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => navigate(`/team-dashboard/${t.id}?year=${year}`)}
                                        >
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{t.teamName}</TableCell>
                                            <TableCell>{t.leader}</TableCell>
                                            <TableCell align="right">{fmtCurrency(t.ytdTarget)}</TableCell>
                                            <TableCell align="right">{fmtCurrency(t.ytdAchieved)}</TableCell>
                                            <TableCell align="right">
                                                <Box sx={{ minWidth: 110 }}>
                                                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                                                        {fmtPct(t.ytdPercent)}
                                                    </Typography>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={Math.min(100, t.ytdPercent * 100)}
                                                        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                                                        color={t.ytdPercent >= 0.8 ? 'success' : 'warning'}
                                                    />
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right">{fmtCurrency(t.remaining)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow sx={{ bgcolor: 'rgba(31,122,53,0.06)' }}>
                                        <TableCell></TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>GRAND TOTAL</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(data.kpi.ytdTarget)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(data.kpi.ytdAchieved)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPct(data.kpi.ytdPercent)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(data.kpi.ytdGap)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* At-a-glance gauges — same order/data as the tables above */}
                    <SectionTitle accent="#2383E2">{`MTD Team Performance — at a glance${data.kpi.mtdMonth ? ` · ${monthShort[data.kpi.mtdMonth - 1]} ${year}` : ''}`}</SectionTitle>
                    <Box sx={{ mb: 3 }}>
                        <TeamGauges teams={data.teamsMtd} metric="mtd" />
                    </Box>
                    <SectionTitle accent="#1F7A35">YTD Team Performance — at a glance</SectionTitle>
                    <Box sx={{ mb: 3 }}>
                        <TeamGauges teams={data.teamsYtd} metric="ytd" />
                    </Box>

                    {/* Consolidated Program-wise Admissions, Month by Month */}
                    <SectionTitle accent="#D97706">Consolidated Program-wise Admissions — Month by Month</SectionTitle>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                        <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                        <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface-muted, #F1EFEA)', zIndex: 1 }}>Program</TableCell>
                                        {monthShort.map((m) => (
                                            <TableCell key={m} sx={{ fontWeight: 700 }} align="right">{m}</TableCell>
                                        ))}
                                        <TableCell sx={{ fontWeight: 700 }} align="right">YTD</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">% Share</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.programs.map((row) => (
                                        <TableRow key={row.program} hover sx={row.isAgi ? { bgcolor: 'rgba(217,119,6,0.05)' } : null}>
                                            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: row.isAgi ? '#FDF5E6' : 'var(--d-surface, #FFFFFF)', fontWeight: 600 }}>
                                                {row.program}
                                                {row.isAgi ? (
                                                    <Tooltip title="AGI rows are tracked separately and NOT counted in the grand total — matches Excel.">
                                                        <Typography component="span" sx={{ ml: 0.5, fontSize: 10, color: '#A35A06', fontWeight: 700 }}>
                                                            (excl.)
                                                        </Typography>
                                                    </Tooltip>
                                                ) : null}
                                            </TableCell>
                                            {row.monthly.map((v, i) => (
                                                <TableCell key={i} align="right">{v ? fmtCount(v) : '—'}</TableCell>
                                            ))}
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCount(row.ytdTotal)}</TableCell>
                                            <TableCell align="right">{row.share == null ? '—' : fmtPct(row.share)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow sx={{ bgcolor: 'rgba(217,119,6,0.08)' }}>
                                        <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(217,119,6,0.14)', fontWeight: 700 }}>GRAND TOTAL</TableCell>
                                        {data.programGrandTotal.monthly.map((v, i) => (
                                            <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>{v ? fmtCount(v) : '—'}</TableCell>
                                        ))}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCount(data.programGrandTotal.ytdTotal)}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>100.0%</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* Visual Overview — charts moved below the tables */}
                    <SectionTitle accent="#2383E2">Visual Overview</SectionTitle>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                                    Team YTD — Target vs Achieved
                                </Typography>
                                <EChart
                                    height={300}
                                    option={(() => {
                                        // Highest YTD target first, always.
                                        const sorted = [...data.teamsYtd].sort((a, b) => b.ytdTarget - a.ytdTarget);
                                        const pcts = sorted.map((t) => (t.ytdTarget ? Math.round((t.ytdAchieved / t.ytdTarget) * 100) : 0));
                                        const opt = barOption({
                                            categories: sorted.map((t) => t.teamName.replace('Team ', '')),
                                            valueFormatter: compactCurrencyFmt,
                                            rotateLabels: 38,
                                            series: [
                                                { name: 'YTD Target', data: sorted.map((t) => t.ytdTarget), color: '#C8C4BB' },
                                                { name: 'YTD Achieved', data: sorted.map((t) => t.ytdAchieved), color: '#1F7A35' },
                                            ],
                                        });
                                        // Achievement % on top of each Achieved bar.
                                        opt.series[1].label = {
                                            show: true, position: 'top', formatter: (p) => `${pcts[p.dataIndex]}%`,
                                            fontSize: 10, fontWeight: 700, color: '#1F7A35',
                                        };
                                        return opt;
                                    })()}
                                />
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                                    Top Consultants (YTD %)
                                </Typography>
                                <EChart
                                    height={300}
                                    option={(() => {
                                        // A distinct colour per bar.
                                        const COLORS = ['#2383E2', '#1F7A35', '#6E40C9', '#D9730D', '#0E9F9F', '#C0392B', '#E6A817', '#DB2777'];
                                        const top = [...data.consultants].slice(0, 8);
                                        return barOption({
                                            horizontal: true,
                                            barLabelFormatter: '{c}%',
                                            categories: top.map((c) => c.name),
                                            series: [{
                                                name: 'YTD %',
                                                data: top.map((c, i) => ({
                                                    value: Math.round(c.ytdPercent * 100),
                                                    itemStyle: { color: COLORS[i % COLORS.length] },
                                                })),
                                            }],
                                        });
                                    })()}
                                />
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                                    Monthly Admissions Trend
                                </Typography>
                                <EChart
                                    height={280}
                                    option={lineOption({
                                        categories: monthShort,
                                        series: [{ name: 'Admissions', data: trimTrailingZeros(data.programGrandTotal.monthly), color: '#2383E2' }],
                                    })}
                                />
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: 'var(--d-text-2)' }}>
                                    Program Mix — Monthly Admissions
                                </Typography>
                                <ProgramMonthHeatmap rows={data.programs} months={monthShort} />
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            ) : null}
        </DashboardShell>
    );
};

export default ExecutiveOverviewPage;
