import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Container,
    Divider,
    Grid,
    LinearProgress,
    Paper,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    CloudSync as IngestIcon,
    CheckCircle as OkIcon,
    ErrorOutline as ErrorIcon,
} from '@mui/icons-material';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import {
    fetchDocsRagStats,
    triggerReingest,
} from '../services/docsChatService';

const PROGRAM_SHORT = {
    'ssm-dba': 'SSM DBA',
    'ioscm-l7': 'IOSCM L7',
    'knights-bsc': 'Knights BSc',
    'knights-mba': 'Knights MBA',
    'malaysia-mba': 'Malaysia MBA',
    'othm-l5': 'OTHM L5',
    'ssm-bba': 'SSM BBA',
    'ssm-mba': 'SSM MBA',
};

const TIER_COLORS = {
    tier1: '#10b981', // green — exact match
    tier2: '#3b82f6', // blue — RAG
    tier3: '#f59e0b', // amber — refusal
};

const Kpi = ({ label, value, subtext }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}
            >
                {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                {value}
            </Typography>
            {subtext && (
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', mt: 0.5 }}
                >
                    {subtext}
                </Typography>
            )}
        </CardContent>
    </Card>
);

const AdminDocsRag = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ingesting, setIngesting] = useState(false);
    const [ingestMsg, setIngestMsg] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const s = await fetchDocsRagStats();
            setStats(s);
        } catch (e) {
            setErr(e.message || 'Failed to load stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const reingest = async (force) => {
        if (
            !window.confirm(
                force
                    ? 'Force re-ingest: wipes all LUC DocChunks and regenerates embeddings (~$0.02, 2–3 min). Continue?'
                    : 'Incremental re-ingest: skips unchanged chunks. Continue?'
            )
        ) {
            return;
        }
        setIngesting(true);
        setIngestMsg('');
        try {
            const r = await triggerReingest({ force });
            setIngestMsg(
                `Re-ingest complete — ${r.stats?.chunks || 0} chunks loaded, ${r.stats?.questions || 0} questions indexed.`
            );
            await load();
        } catch (e) {
            setIngestMsg(e.message || 'Re-ingest failed');
        } finally {
            setIngesting(false);
        }
    };

    const chunksBarData = useMemo(() => {
        if (!stats?.chunkCountsByProgram) return [];
        return Object.entries(stats.chunkCountsByProgram)
            .map(([slug, n]) => ({
                program: PROGRAM_SHORT[slug] || slug,
                slug,
                chunks: n,
            }))
            .sort((a, b) => b.chunks - a.chunks);
    }, [stats]);

    const tierPieData = useMemo(() => {
        const d = stats?.tierDistribution24h || {};
        const rows = [];
        if (d.tier1) rows.push({ name: 'Tier 1 (exact)', value: d.tier1, key: 'tier1' });
        if (d.tier2) rows.push({ name: 'Tier 2 (RAG)', value: d.tier2, key: 'tier2' });
        if (d.tier3) rows.push({ name: 'Tier 3 (refusal)', value: d.tier3, key: 'tier3' });
        return rows;
    }, [stats]);

    const medianLatency = useMemo(() => {
        const a = stats?.avgLatencyByTier24h || {};
        const vals = [a.tier1, a.tier2, a.tier3].filter(Boolean);
        if (vals.length === 0) return '—';
        vals.sort((x, y) => x - y);
        const mid = Math.floor(vals.length / 2);
        return vals.length % 2 === 0
            ? Math.round((vals[mid - 1] + vals[mid]) / 2) + ' ms'
            : vals[mid] + ' ms';
    }, [stats]);

    if (loading && !stats) {
        return (
            <Container sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ mb: 3 }}
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        Docs RAG · Admin
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Program-docs chatbot telemetry, corpus health, and
                        content updates.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={load}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={
                            ingesting ? (
                                <CircularProgress size={16} color="inherit" />
                            ) : (
                                <IngestIcon />
                            )
                        }
                        onClick={() => reingest(false)}
                        disabled={ingesting}
                    >
                        {ingesting ? 'Re-ingesting…' : 'Re-ingest (incremental)'}
                    </Button>
                    <Button
                        variant="outlined"
                        color="warning"
                        onClick={() => reingest(true)}
                        disabled={ingesting}
                    >
                        Force re-ingest
                    </Button>
                </Stack>
            </Stack>

            {err && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {err}
                </Alert>
            )}
            {ingesting && <LinearProgress sx={{ mb: 2 }} />}

            {/* KPI row */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <Kpi
                        label="Chunks loaded"
                        value={stats?.chunks?.total ?? '—'}
                        subtext={`${stats?.chunks?.questions ?? 0} questions indexed (Tier 1)`}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Kpi
                        label="Queries (24h)"
                        value={stats?.cacheStats24h?.total ?? 0}
                        subtext={
                            stats?.cacheStats24h
                                ? `${stats.cacheStats24h.hits} cache hits, ${stats.cacheStats24h.misses} fresh`
                                : undefined
                        }
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Kpi
                        label="Cache hit rate"
                        value={
                            stats?.cacheStats24h
                                ? `${Math.round(stats.cacheStats24h.hitRate * 100)}%`
                                : '—'
                        }
                        subtext="rolling last 24h"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <Kpi
                        label="Median latency"
                        value={medianLatency}
                        subtext="across tiers (24h)"
                    />
                </Grid>
            </Grid>

            {/* Charts row */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={7}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Chunks per program
                            </Typography>
                            <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                                <ResponsiveContainer>
                                    <BarChart data={chunksBarData}>
                                        <XAxis
                                            dataKey="program"
                                            interval={0}
                                            tick={{ fontSize: 11 }}
                                            angle={-20}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 11 }} />
                                        <RechartsTooltip />
                                        <Bar
                                            dataKey="chunks"
                                            fill="#3b82f6"
                                            radius={[6, 6, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={5}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Tier distribution (24h)
                            </Typography>
                            <Box sx={{ width: '100%', height: 280, mt: 1 }}>
                                {tierPieData.length === 0 ? (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ pt: 6, textAlign: 'center' }}
                                    >
                                        No queries in the last 24 hours yet.
                                    </Typography>
                                ) : (
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                data={tierPieData}
                                                dataKey="value"
                                                nameKey="name"
                                                outerRadius={90}
                                                innerRadius={55}
                                                paddingAngle={2}
                                            >
                                                {tierPieData.map((d) => (
                                                    <Cell
                                                        key={d.key}
                                                        fill={TIER_COLORS[d.key] || '#64748b'}
                                                    />
                                                ))}
                                            </Pie>
                                            <Legend
                                                verticalAlign="bottom"
                                                iconType="circle"
                                                wrapperStyle={{ fontSize: 12 }}
                                            />
                                            <RechartsTooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Ingest card */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                        spacing={2}
                    >
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            {stats?.chunks?.total > 0 ? (
                                <OkIcon sx={{ color: 'success.main' }} />
                            ) : (
                                <ErrorIcon sx={{ color: 'error.main' }} />
                            )}
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {stats?.chunks?.total > 0
                                        ? 'Corpus healthy'
                                        : 'Corpus empty'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Last ingest:{' '}
                                    {stats?.lastIngestAt
                                        ? `${formatDistanceToNow(new Date(stats.lastIngestAt))} ago (${new Date(stats.lastIngestAt).toLocaleString()})`
                                        : 'unknown'}
                                </Typography>
                            </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            Server cache (QueryCache):{' '}
                            <strong>{stats?.cache?.last24h ?? 0}</strong> entries
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>

            {/* Top queries */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Top queries (last 7 days)
                    </Typography>
                    {(!stats?.topQueries7d || stats.topQueries7d.length === 0) ? (
                        <Typography variant="body2" color="text.secondary">
                            No queries yet.
                        </Typography>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Query</TableCell>
                                        <TableCell align="right">Count</TableCell>
                                        <TableCell align="right">Avg tier</TableCell>
                                        <TableCell align="right">Avg latency</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats.topQueries7d.map((q) => (
                                        <TableRow key={q.normalizedQuery}>
                                            <TableCell>
                                                <Tooltip title={q.normalizedQuery} arrow>
                                                    <span>
                                                        {(q.sampleQuery || q.normalizedQuery).slice(0, 120)}
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="right">{q.count}</TableCell>
                                            <TableCell align="right">{q.avgTier}</TableCell>
                                            <TableCell align="right">{q.avgLatency} ms</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Tier 3 refusals */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Refusals (last 24h) — gaps in the corpus
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        The bot couldn't ground these queries. Review to decide
                        whether content is missing.
                    </Typography>
                    {(!stats?.refusalQueries24h || stats.refusalQueries24h.length === 0) ? (
                        <Typography variant="body2" color="text.secondary">
                            No refusals in the last 24 hours. 👍
                        </Typography>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Query</TableCell>
                                        <TableCell>User</TableCell>
                                        <TableCell>When</TableCell>
                                        <TableCell align="right">Top score</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats.refusalQueries24h.map((r) => (
                                        <TableRow key={r._id}>
                                            <TableCell>{r.query}</TableCell>
                                            <TableCell>
                                                {r.userId?.name || r.userId?.email || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {formatDistanceToNow(new Date(r.createdAt), {
                                                    addSuffix: true,
                                                })}
                                            </TableCell>
                                            <TableCell align="right">
                                                {(r.topScore || 0).toFixed(3)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Low confidence */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Low-confidence answers (last 24h)
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Tier 1 or 2 answers where the top cosine was below 0.50.
                        Worth sampling to see if the bot confidently said the
                        wrong thing.
                    </Typography>
                    {(!stats?.lowConfidenceQueries24h ||
                        stats.lowConfidenceQueries24h.length === 0) ? (
                        <Typography variant="body2" color="text.secondary">
                            No borderline answers in the last 24 hours.
                        </Typography>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Query</TableCell>
                                        <TableCell align="right">Top score</TableCell>
                                        <TableCell align="right">Tier</TableCell>
                                        <TableCell>Program</TableCell>
                                        <TableCell>When</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats.lowConfidenceQueries24h.map((q) => (
                                        <TableRow key={q._id}>
                                            <TableCell>{q.query}</TableCell>
                                            <TableCell align="right">
                                                {q.topScore.toFixed(3)}
                                            </TableCell>
                                            <TableCell align="right">{q.tier}</TableCell>
                                            <TableCell>
                                                {q.programFilter || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {formatDistanceToNow(new Date(q.createdAt), {
                                                    addSuffix: true,
                                                })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
                Phase 4 admin dashboard · stats refresh on Re-ingest or manual Refresh.
            </Typography>

            <Snackbar
                open={Boolean(ingestMsg)}
                autoHideDuration={6000}
                onClose={() => setIngestMsg('')}
                message={ingestMsg}
            />
        </Container>
    );
};

export default AdminDocsRag;
