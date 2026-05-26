import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import { getOverview } from '../services/execOverviewService';

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

const ExecutiveOverviewPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getOverview(year)
            .then((res) => {
                if (cancelled) return;
                setData(res.data);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err.response?.data?.message || err.message || 'Failed to load Executive Overview');
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [year]);

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

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Sales Performance"
                title="Executive Overview"
                subtitle={`Year ${year} · All teams roll-up · Updates automatically as admissions close`}
                right={
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Year</InputLabel>
                        <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
                            {yearOptions().map((y) => (
                                <MenuItem key={y} value={y}>{y}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                }
            />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            ) : data ? (
                <Box sx={{ pb: 6 }}>
                    {/* KPI strip */}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <KpiTile
                                label="YTD Target"
                                value={fmtCurrency(data.kpi.ytdTarget)}
                                sublabel="Annual goal"
                                accent="#2383E2"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <KpiTile
                                label="YTD Achieved"
                                value={fmtCurrency(data.kpi.ytdAchieved)}
                                sublabel="Revenue collected"
                                accent="#1F7A35"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <KpiTile
                                label="YTD Gap"
                                value={fmtCurrency(data.kpi.ytdGap)}
                                sublabel="Remaining target"
                                accent="#D97706"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <KpiTile
                                label="Overall YTD %"
                                value={fmtPct(data.kpi.ytdPercent)}
                                sublabel={`MTD: ${fmtCurrency(data.kpi.mtdAchieved)} / ${fmtCurrency(data.kpi.mtdTarget)}`}
                                accent="#6E40C9"
                            />
                        </Grid>
                    </Grid>

                    {/* MTD Team Performance */}
                    <SectionTitle accent="#2383E2">MTD Team Performance</SectionTitle>
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
                                    {data.teamsMtd.map((t, i) => (
                                        <TableRow
                                            key={t.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => navigate(`/team-dashboard/${t.id}?year=${year}`)}
                                        >
                                            <TableCell>{i + 1}</TableCell>
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

                    {/* Consultant Performance Snapshot */}
                    <SectionTitle accent="#6E40C9">Consultant Performance Snapshot</SectionTitle>
                    <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
                        <TableContainer sx={{ maxHeight: 480 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                        <TableCell sx={{ fontWeight: 700 }}>Consultant</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">MTD %</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }} align="right">YTD %</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.consultants.map((c) => (
                                        <TableRow key={c.id || c.name} hover>
                                            <TableCell>{c.name}</TableCell>
                                            <TableCell align="right">{fmtPct(c.mtdPercent)}</TableCell>
                                            <TableCell align="right" sx={{ color: c.ytdPercent >= 0.8 ? '#1F7A35' : '#A35A06', fontWeight: 600 }}>
                                                {fmtPct(c.ytdPercent)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

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
                </Box>
            ) : null}
        </DashboardShell>
    );
};

export default ExecutiveOverviewPage;
