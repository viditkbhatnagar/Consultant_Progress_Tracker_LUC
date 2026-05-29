import React, { useCallback, useEffect, useState } from 'react';
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
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Stack,
    Chip,
    Avatar,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import ComingSoonLock from '../components/ComingSoonLock';
import EChart from '../components/charts/EChart';
import { barOption, percentFmt } from '../components/charts/presets';
import useRealtimeRefresh from '../hooks/useRealtimeRefresh';
import { quoteAt } from '../utils/quotes';
import { getConsultantPerformance } from '../services/execOverviewService';

const fmtCurrency = (n) => `AED ${Number(n || 0).toLocaleString('en-US')}`;
const fmtPct = (n) => (n == null || Number.isNaN(n) ? '0.0%' : `${(n * 100).toFixed(1)}%`);
const pctColor = (n) => (n >= 1 ? '#1F7A35' : n >= 0.8 ? '#2383E2' : '#A35A06');

const yearOptions = () => {
    const now = new Date().getUTCFullYear();
    const out = [];
    for (let y = now + 1; y >= 2023; y--) out.push(y);
    return out;
};

// One leaderboard card (top-5 list) with a rotating motivational quote.
const LeaderboardCard = ({ title, rows, metric, accent, quoteIndex }) => (
    <Paper variant="outlined" sx={{ borderRadius: '16px', overflow: 'hidden', height: '100%' }}>
        <Box sx={{ px: 2.5, py: 1.75, background: `linear-gradient(135deg, ${accent}1a, ${accent}0d)`, borderBottom: '1px solid var(--d-border-soft, #ECE9E2)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon sx={{ color: accent }} />
            <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{title}</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
            {rows.map((r, i) => (
                <Stack key={r.consultantId || r.name} direction="row" alignItems="center" spacing={1.5} sx={{ px: 1, py: 1, borderRadius: '10px', bgcolor: i === 0 ? `${accent}12` : 'transparent' }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 13, fontWeight: 700, bgcolor: i === 0 ? accent : 'var(--d-surface-muted, #F1EFEA)', color: i === 0 ? '#fff' : 'var(--d-text-2)' }}>
                        {i + 1}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)' }}>{r.team}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: pctColor(metric === 'mtd' ? r.mtdPercent : r.ytdPercent) }}>
                        {fmtPct(metric === 'mtd' ? r.mtdPercent : r.ytdPercent)}
                    </Typography>
                </Stack>
            ))}
            <Box sx={{ mt: 1, px: 1.25, py: 1.25, display: 'flex', gap: 1, alignItems: 'flex-start', borderTop: '1px dashed var(--d-border-soft, #ECE9E2)' }}>
                <FormatQuoteIcon sx={{ fontSize: 16, color: accent, mt: 0.25, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, fontStyle: 'italic', color: 'var(--d-text-3, #57564E)', lineHeight: 1.5 }}>
                    {quoteAt(quoteIndex)}
                </Typography>
            </Box>
        </Box>
    </Paper>
);

const CategoryTable = ({ title, accent, rows, subtitle }) => (
    <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, mt: 1 }}>
            <Box sx={{ width: 4, height: 22, bgcolor: accent, borderRadius: '2px' }} />
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{title}</Typography>
            {subtitle ? <Chip label={subtitle} size="small" sx={{ fontWeight: 600 }} /> : null}
        </Box>
        <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden' }}>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Consultant</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Monthly Target</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">YTD Target</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">YTD Achieved</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">YTD %</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">MTD Achieved</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">MTD %</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 3, color: 'var(--d-text-muted)' }}>No consultants in this category.</TableCell></TableRow>
                        ) : rows.map((r) => (
                            <TableRow key={r.consultantId || r.name} hover>
                                <TableCell>{r.rank}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                                <TableCell>{r.team}</TableCell>
                                <TableCell align="right">{fmtCurrency(r.monthlyTarget)}</TableCell>
                                <TableCell align="right">{fmtCurrency(r.ytdTarget)}</TableCell>
                                <TableCell align="right">{fmtCurrency(r.ytdAchieved)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: pctColor(r.ytdPercent) }}>{fmtPct(r.ytdPercent)}</TableCell>
                                <TableCell align="right">{fmtCurrency(r.mtdAchieved)}</TableCell>
                                <TableCell align="right" sx={{ color: pctColor(r.mtdPercent) }}>{fmtPct(r.mtdPercent)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    </Box>
);

const ConsultantPerformancePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(new Date().getUTCFullYear());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const isTeamLead = user?.role === 'team_lead';

    const load = useCallback(() => {
        if (isTeamLead) { setLoading(false); return; }
        getConsultantPerformance(year)
            .then((res) => { setData(res.data); setLoading(false); })
            .catch((err) => { setError(err.response?.data?.message || err.message || 'Failed to load'); setLoading(false); });
    }, [year, isTeamLead]);

    useEffect(() => { setLoading(true); setError(null); load(); }, [load]);

    useRealtimeRefresh(
        ['teamEntry:upserted', 'teamEntry:bulk', 'teamEntry:deleted', 'consultant:created', 'consultant:updated', 'consultant:deactivated'],
        load,
        { year }
    );

    const handleLogout = () => { logout(); navigate('/login'); };

    const sidebar = user?.role === 'admin' ? (
        <AdminSidebar
            onLogout={handleLogout}
            onDashboard={() => navigate('/admin/dashboard')}
            onAIAnalysis={() => navigate('/admin/dashboard?section=ai')}
            onAPICosts={() => navigate('/admin/dashboard?section=ai-usage')}
        />
    ) : (
        <Sidebar onLogout={handleLogout} onDashboard={() => navigate('/team-lead/dashboard')} />
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Sales Performance"
                title="Consultant Performance"
                subtitle={data ? `${data.activeCount} active consultants · ranked by YTD % · updates live` : 'Loading…'}
                right={
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Year</InputLabel>
                        <Select value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
                            {yearOptions().map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </Select>
                    </FormControl>
                }
            />

            {isTeamLead ? (
                <ComingSoonLock
                    title="Consultant Performance"
                    subtitle="Category A/B rankings and the top-performer leaderboard. Coming soon for team leads."
                />
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            ) : data ? (
                <Box sx={{ pb: 6 }}>
                    {/* Top-5 leaderboards with rotating quotes */}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <LeaderboardCard title="🏆 Top 5 — YTD %" rows={data.top5Ytd} metric="ytd" accent="#1F7A35" quoteIndex={year} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <LeaderboardCard title="🔥 Top 5 — MTD %" rows={data.top5Mtd} metric="mtd" accent="#D97706" quoteIndex={year + 3} />
                        </Grid>
                    </Grid>

                    {/* Consultants Revenue YTD% — full ranking, highest → lowest */}
                    <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, mt: 3 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: 'var(--d-text-2)' }}>
                            Consultants Revenue YTD %
                        </Typography>
                        {(() => {
                            const ranked = [...data.categoryA, ...data.categoryB]
                                .sort((a, b) => b.ytdPercent - a.ytdPercent);
                            const opt = barOption({
                                rotateLabels: 35,
                                valueFormatter: percentFmt,
                                categories: ranked.map((r) => r.name),
                                series: [{
                                    name: 'YTD %',
                                    data: ranked.map((r) => Math.round(r.ytdPercent * 100)),
                                    color: '#2383E2',
                                }],
                            });
                            // Value labels above each bar (orange, like the reference sheet).
                            opt.series[0].label = {
                                show: true,
                                position: 'top',
                                formatter: '{c}%',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#D9730D',
                            };
                            // Headroom so the tallest bar's label isn't clipped.
                            opt.yAxis = { ...opt.yAxis, max: (v) => Math.ceil((v.max * 1.12) / 10) * 10 };
                            return <EChart height={380} option={opt} mode={themeState.mode} />;
                        })()}
                    </Paper>

                    <Box sx={{ mt: 3 }}>
                        <CategoryTable title="Category A" subtitle="Monthly Target ≥ AED 90,000" accent="#1F7A35" rows={data.categoryA} />
                        <CategoryTable title="Category B" subtitle="Monthly Target < AED 90,000" accent="#6E40C9" rows={data.categoryB} />
                    </Box>
                </Box>
            ) : null}
        </DashboardShell>
    );
};

export default ConsultantPerformancePage;
