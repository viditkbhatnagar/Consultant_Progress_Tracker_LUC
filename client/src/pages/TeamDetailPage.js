import React, { useEffect, useState } from 'react';
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
    Chip,
    Stack,
} from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import { getTeamDetail, getTeams } from '../services/execOverviewService';

const fmtCurrency = (n) => {
    if (n == null) return '—';
    return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED',
        maximumFractionDigits: 0,
    }).format(n);
};
const fmtPct = (n) => (n == null || Number.isNaN(n) ? '0.0%' : `${(n * 100).toFixed(1)}%`);
const fmtCount = (n) => (n == null ? '0' : Number(n).toLocaleString('en-US'));

const yearOptions = () => {
    const now = new Date().getUTCFullYear();
    const out = [];
    for (let y = now + 1; y >= 2023; y--) out.push(y);
    return out;
};

const MonthBlock = ({ block, buckets, agiBuckets, programBuckets }) => {
    const isAgi = (b) => agiBuckets.includes(b);
    return (
        <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', mb: 3 }}>
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'var(--d-surface-muted, #F1EFEA)', borderBottom: '1px solid var(--d-border-soft, #ECE9E2)', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--d-text, #191918)', letterSpacing: '-0.01em' }}>
                    {block.monthName}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Chip label={`Target: ${fmtCurrency(block.teamTotal.monthlyTarget)}`} size="small" sx={{ fontWeight: 600 }} />
                    <Chip label={`Achieved: ${fmtCurrency(block.teamTotal.achievedRevenue)}`} size="small" color="success" variant="outlined" />
                    <Chip label={fmtPct(block.teamTotal.percentRevenue)} size="small" color={block.teamTotal.percentRevenue >= 0.8 ? 'success' : 'warning'} />
                    <Chip label={`${block.teamTotal.totalAdmissions} admissions`} size="small" variant="outlined" />
                </Stack>
            </Box>
            <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'var(--d-surface, #FFFFFF)' }}>
                            <TableCell sx={{ fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', zIndex: 1, minWidth: 150 }}>Member</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Monthly Target</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Achieved</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>% Rev</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Adm.</TableCell>
                            {buckets.map((b) => (
                                <TableCell key={b} align="right" sx={{ fontWeight: 700, fontSize: 11, bgcolor: isAgi(b) ? 'rgba(217,119,6,0.06)' : undefined }}>
                                    {b}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {block.members.map((m) => (
                            <TableRow key={`${m.consultantId || m.consultantName}`} hover>
                                <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'var(--d-surface, #FFFFFF)', fontWeight: 600 }}>
                                    {m.consultantName}
                                    {m.isActive === false ? (
                                        <Chip label="inactive" size="small" sx={{ ml: 0.75, height: 16, fontSize: 9 }} variant="outlined" />
                                    ) : null}
                                </TableCell>
                                <TableCell align="right">{fmtCurrency(m.monthlyTarget)}</TableCell>
                                <TableCell align="right">{m.achievedRevenue ? fmtCurrency(m.achievedRevenue) : '—'}</TableCell>
                                <TableCell align="right" sx={{ color: m.percentRevenue >= 0.8 ? '#1F7A35' : '#A35A06', fontWeight: 600 }}>{fmtPct(m.percentRevenue)}</TableCell>
                                <TableCell align="right">{m.totalAdmissions || '—'}</TableCell>
                                {buckets.map((b) => (
                                    <TableCell key={b} align="right" sx={{ bgcolor: isAgi(b) ? 'rgba(217,119,6,0.04)' : undefined }}>
                                        {m.buckets[b] ? fmtCount(m.buckets[b]) : '—'}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'rgba(35,131,226,0.06)' }}>
                            <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(35,131,226,0.12)', fontWeight: 700 }}>TEAM TOTAL</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(block.teamTotal.monthlyTarget)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtCurrency(block.teamTotal.achievedRevenue)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtPct(block.teamTotal.percentRevenue)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{block.teamTotal.totalAdmissions || '—'}</TableCell>
                            {buckets.map((b) => (
                                <TableCell key={b} align="right" sx={{ fontWeight: 700, bgcolor: isAgi(b) ? 'rgba(217,119,6,0.08)' : undefined }}>
                                    {block.teamTotal.buckets[b] || '—'}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

const TeamDetailPage = () => {
    const navigate = useNavigate();
    const { teamLeadId: paramId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('dashboard-theme-mode');

    const [year, setYear] = useState(Number(searchParams.get('year')) || new Date().getUTCFullYear());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [teams, setTeams] = useState([]);

    const effectiveTeamId = user?.role === 'team_lead' ? user?._id || user?.id : paramId;

    useEffect(() => {
        if (user?.role === 'admin') {
            getTeams().then((res) => setTeams(res.data || [])).catch(() => {});
        }
    }, [user?.role]);

    useEffect(() => {
        if (!effectiveTeamId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        getTeamDetail(effectiveTeamId, year)
            .then((res) => { if (!cancelled) { setData(res.data); setLoading(false); } })
            .catch((err) => {
                if (cancelled) return;
                setError(err.response?.data?.message || err.message || 'Failed to load team detail');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [effectiveTeamId, year]);

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
                eyebrow={data ? data.teamLead.teamName : 'Team Dashboard'}
                title={data ? `${data.teamLead.teamName} · ${year}` : 'Loading…'}
                subtitle={data ? `Led by ${data.teamLead.name} · Mirrors the per-team Excel sheet · Updates as admissions close` : ''}
                right={
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        {user?.role === 'admin' && teams.length ? (
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>Team</InputLabel>
                                <Select
                                    value={paramId || ''}
                                    label="Team"
                                    onChange={(e) => navigate(`/team-dashboard/${e.target.value}?year=${year}`)}
                                >
                                    {teams.map((t) => (
                                        <MenuItem key={t._id} value={t._id}>
                                            {t.teamName || `Team ${t.name}`}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        <FormControl size="small" sx={{ minWidth: 110 }}>
                            <InputLabel>Year</InputLabel>
                            <Select
                                value={year}
                                label="Year"
                                onChange={(e) => {
                                    const y = Number(e.target.value);
                                    setYear(y);
                                    const next = new URLSearchParams(searchParams);
                                    next.set('year', String(y));
                                    setSearchParams(next, { replace: true });
                                }}
                            >
                                {yearOptions().map((y) => (
                                    <MenuItem key={y} value={y}>{y}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
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
                    {/* YTD header strip */}
                    <Grid container spacing={2} sx={{ mt: 1, mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Target</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{fmtCurrency(data.ytd.target)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Achieved</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#1F7A35' }}>{fmtCurrency(data.ytd.achieved)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD %</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: data.ytd.percent >= 0.8 ? '#1F7A35' : '#A35A06' }}>{fmtPct(data.ytd.percent)}</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: '12px' }}>
                                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted, #8A887E)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>YTD Remaining</Typography>
                                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#A35A06' }}>{fmtCurrency(data.ytd.remaining)}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {data.months.map((block) => (
                        <MonthBlock
                            key={block.month}
                            block={block}
                            buckets={data.buckets}
                            agiBuckets={data.agiBuckets}
                            programBuckets={data.programBuckets}
                        />
                    ))}
                </Box>
            ) : null}
        </DashboardShell>
    );
};

export default TeamDetailPage;
