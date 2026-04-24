import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
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
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    CloudSync as IngestIcon,
    CheckCircle as OkIcon,
    ErrorOutline as ErrorIcon,
    Inbox as EmptyIcon,
    AccessTime as ClockIcon,
    Storage as CacheIcon,
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
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import {
    fetchDocsRagStats,
    triggerReingest,
} from '../../services/docsChatService';

// Short slug label (used directly on the X axis) + full display name (used
// in the tooltip). Keeps the chart scannable and still gives the full name
// on hover.
const PROGRAM_DISPLAY = {
    'ssm-dba': 'Swiss School of Management DBA',
    'ioscm-l7': 'IOSCM Level 7 Supply Chain',
    'knights-bsc': 'Knights College BSc Business Mgmt',
    'knights-mba': 'Knights College Work-Based MBA',
    'malaysia-mba': 'Malaysia University MBA (MUST)',
    'othm-l5': 'OTHM Level 5 Extended Diploma',
    'ssm-bba': 'Swiss School of Management BBA',
    'ssm-mba': 'Swiss School of Management MBA',
};

// One color for the chunks-per-program bars (avoid recharts default rainbow).
const BAR_COLOR = '#3b82f6';

// Tier palette is the single source of truth — every surface (donut,
// latency chart, legends, table badges) reads from here so tier 1/2/3
// stay visually consistent across the page.
const TIER_COLORS = {
    tier1: '#10b981', // green — exact match
    tier2: '#3b82f6', // blue — RAG
    tier3: '#f59e0b', // amber — refusal
};
const TIER_LABELS = {
    tier1: 'Tier 1 (exact)',
    tier2: 'Tier 2 (RAG)',
    tier3: 'Tier 3 (refusal)',
};

// ── Small reusable bits ────────────────────────────────────────────────

const Kpi = ({ label, value, subtext }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent>
            <Typography
                variant="overline"
                sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    fontSize: 30,
                    fontWeight: 700,
                    mt: 0.5,
                    lineHeight: 1.15,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
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

const SectionHeader = ({ title, description }) => (
    <Box sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
        </Typography>
        {description && (
            <Typography variant="body2" color="text.secondary">
                {description}
            </Typography>
        )}
    </Box>
);

const EmptyState = ({ text }) => (
    <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ color: 'text.secondary', py: 1 }}
    >
        <EmptyIcon sx={{ fontSize: 18, opacity: 0.7 }} />
        <Typography variant="body2">{text}</Typography>
    </Stack>
);

// Custom tooltip on the bar chart: shows the full program display name
// + the chunk count. Tighter than the default recharts panel.
const BarTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    return (
        <Paper
            elevation={2}
            sx={{ px: 1.25, py: 0.75, fontSize: 12, maxWidth: 260 }}
        >
            <Typography sx={{ fontWeight: 600, fontSize: 12.5 }}>
                {PROGRAM_DISPLAY[d.slug] || d.slug}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {d.chunks} chunks indexed
            </Typography>
        </Paper>
    );
};

// Horizontal ms-bar for the Latency-by-tier mini chart. Each tier uses
// its palette color and the bar label reads in either ms or s depending
// on magnitude.
const LatencyBar = ({ tierKey, ms, maxMs }) => {
    const pct = maxMs > 0 ? Math.max(8, (ms / maxMs) * 100) : 0;
    const display = ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
    return (
        <Box sx={{ mb: 1.5 }}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                sx={{ mb: 0.5 }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 600,
                        color: TIER_COLORS[tierKey],
                    }}
                >
                    {TIER_LABELS[tierKey]}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color: 'text.primary',
                    }}
                >
                    {display}
                </Typography>
            </Stack>
            <Box
                sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'action.hover',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: TIER_COLORS[tierKey],
                        transition: 'width 300ms ease-out',
                    }}
                />
            </Box>
        </Box>
    );
};

// Structured legend row for the donut: swatch + label + count + percent.
const DonutLegendRow = ({ colorKey, label, count, pct }) => (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 24 }}>
        <Box
            sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: TIER_COLORS[colorKey],
                flexShrink: 0,
            }}
        />
        <Typography variant="body2" sx={{ flex: 1 }}>
            {label}
        </Typography>
        <Typography
            variant="body2"
            sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
        >
            {count}
        </Typography>
        <Typography
            variant="body2"
            sx={{
                fontVariantNumeric: 'tabular-nums',
                color: 'text.secondary',
                minWidth: 42,
                textAlign: 'right',
            }}
        >
            {pct}%
        </Typography>
    </Stack>
);

// ── Main page ──────────────────────────────────────────────────────────

// Phase 5 Commit 7 — the content that used to live at /admin/docs-rag
// now renders inside the "AI Usage" page as a sub-tab. The outer
// <Container> wrapper was dropped since the parent AIUsageTabs provides
// page-level chrome; everything inside remains identical to the Phase
// 4.3 polished dashboard.
const DocsRagPanel = () => {
    const theme = useTheme();
    const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
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
                program: slug, // X-axis label = slug, not display name
                slug,
                chunks: n,
            }))
            .sort((a, b) => b.chunks - a.chunks);
    }, [stats]);

    const tierPieData = useMemo(() => {
        const d = stats?.tierDistribution24h || {};
        const rows = [];
        if (d.tier1) rows.push({ name: TIER_LABELS.tier1, value: d.tier1, key: 'tier1' });
        if (d.tier2) rows.push({ name: TIER_LABELS.tier2, value: d.tier2, key: 'tier2' });
        if (d.tier3) rows.push({ name: TIER_LABELS.tier3, value: d.tier3, key: 'tier3' });
        return rows;
    }, [stats]);

    const tierTotal = useMemo(
        () => tierPieData.reduce((s, r) => s + r.value, 0),
        [tierPieData]
    );

    const latencyMax = useMemo(() => {
        const a = stats?.avgLatencyByTier24h || {};
        return Math.max(a.tier1 || 0, a.tier2 || 0, a.tier3 || 0, 0);
    }, [stats]);

    const medianLatency = useMemo(() => {
        const a = stats?.avgLatencyByTier24h || {};
        const vals = [a.tier1, a.tier2, a.tier3].filter((v) => v != null && v > 0);
        if (vals.length === 0) return '—';
        vals.sort((x, y) => x - y);
        const mid = Math.floor(vals.length / 2);
        const m =
            vals.length % 2 === 0
                ? Math.round((vals[mid - 1] + vals[mid]) / 2)
                : vals[mid];
        return m < 1000 ? `${m} ms` : `${(m / 1000).toFixed(1)} s`;
    }, [stats]);

    if (loading && !stats) {
        return (
            <Box sx={{ py: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ py: 1 }}>
            {/* Header — tighter top spacing so content lands above the fold */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                spacing={1.5}
                sx={{ mb: 1.5 }}
            >
                <Box>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 700, lineHeight: 1.2 }}
                    >
                        Docs RAG · Admin
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Telemetry, corpus health, and content updates.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={load}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={
                            ingesting ? (
                                <CircularProgress size={14} color="inherit" />
                            ) : (
                                <IngestIcon />
                            )
                        }
                        onClick={() => reingest(false)}
                        disabled={ingesting}
                        // Picks up theme gradient from theme.js
                    >
                        {ingesting ? 'Re-ingesting…' : 'Re-ingest'}
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        color="warning"
                        onClick={() => reingest(true)}
                        disabled={ingesting}
                    >
                        Force re-ingest
                    </Button>
                </Stack>
            </Stack>

            {err && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    {err}
                </Alert>
            )}
            {ingesting && <LinearProgress sx={{ mb: 1.5 }} />}

            {/* KPI row */}
            <Grid container spacing={2} sx={{ mb: 1.5 }}>
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

            {/* Charts row — 3 cols desktop, 2 cols tablet, 1 col mobile */}
            <Grid container spacing={2} sx={{ mb: 1.5 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Chunks per program
                            </Typography>
                            <Box
                                sx={{
                                    width: '100%',
                                    height: isNarrow ? 220 : 260,
                                    mt: 1,
                                }}
                            >
                                <ResponsiveContainer>
                                    <BarChart
                                        data={chunksBarData}
                                        margin={{ top: 4, right: 8, left: -20, bottom: 20 }}
                                    >
                                        <XAxis
                                            dataKey="program"
                                            interval={0}
                                            tick={{ fontSize: 10 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10 }}
                                            allowDecimals={false}
                                        />
                                        <RechartsTooltip
                                            content={<BarTooltip />}
                                            cursor={{ fill: 'rgba(59,130,246,0.08)' }}
                                        />
                                        <Bar
                                            dataKey="chunks"
                                            fill={BAR_COLOR}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Tier distribution (24h)
                            </Typography>
                            {tierPieData.length === 0 ? (
                                <Box
                                    sx={{
                                        height: isNarrow ? 220 : 260,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <EmptyState text="No queries in the last 24 hours yet." />
                                </Box>
                            ) : (
                                <Box sx={{ mt: 1 }}>
                                    {/* Donut with centre total */}
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            width: '100%',
                                            height: isNarrow ? 170 : 200,
                                        }}
                                    >
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={tierPieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius="60%"
                                                    outerRadius="90%"
                                                    paddingAngle={2}
                                                    isAnimationActive={false}
                                                >
                                                    {tierPieData.map((d) => (
                                                        <Cell
                                                            key={d.key}
                                                            fill={TIER_COLORS[d.key]}
                                                        />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                pointerEvents: 'none',
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: 24,
                                                    fontWeight: 700,
                                                    lineHeight: 1,
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {tierTotal}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ mt: 0.25 }}
                                            >
                                                total
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {/* Numeric legend */}
                                    <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                                        {['tier1', 'tier2', 'tier3'].map((k) => {
                                            const row = tierPieData.find((r) => r.key === k);
                                            const count = row?.value || 0;
                                            const pct = tierTotal > 0
                                                ? Math.round((count / tierTotal) * 100)
                                                : 0;
                                            return (
                                                <DonutLegendRow
                                                    key={k}
                                                    colorKey={k}
                                                    label={TIER_LABELS[k]}
                                                    count={count}
                                                    pct={pct}
                                                />
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} sm={12} md={4}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Avg latency by tier (24h)
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1.5, mt: 0.25 }}
                            >
                                Exact match is fast; RAG adds Groq TTFT + streaming.
                            </Typography>
                            {latencyMax === 0 ? (
                                <EmptyState text="No latency data in the last 24 hours yet." />
                            ) : (
                                <Box sx={{ mt: 1 }}>
                                    <LatencyBar
                                        tierKey="tier1"
                                        ms={stats?.avgLatencyByTier24h?.tier1}
                                        maxMs={latencyMax}
                                    />
                                    <LatencyBar
                                        tierKey="tier2"
                                        ms={stats?.avgLatencyByTier24h?.tier2}
                                        maxMs={latencyMax}
                                    />
                                    <LatencyBar
                                        tierKey="tier3"
                                        ms={stats?.avgLatencyByTier24h?.tier3}
                                        maxMs={latencyMax}
                                    />
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Compact corpus-healthy strip — 3 chips on one row */}
            <Card sx={{ mb: 1.5 }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        px: 2,
                        py: 1,
                    }}
                >
                    <Chip
                        size="small"
                        color={stats?.chunks?.total > 0 ? 'success' : 'error'}
                        icon={
                            stats?.chunks?.total > 0 ? (
                                <OkIcon sx={{ fontSize: 16 }} />
                            ) : (
                                <ErrorIcon sx={{ fontSize: 16 }} />
                            )
                        }
                        label={
                            stats?.chunks?.total > 0
                                ? 'Corpus healthy'
                                : 'Corpus empty'
                        }
                    />
                    <Chip
                        size="small"
                        icon={<ClockIcon sx={{ fontSize: 16 }} />}
                        variant="outlined"
                        label={
                            stats?.lastIngestAt
                                ? `Last ingest: ${formatDistanceToNow(new Date(stats.lastIngestAt))} ago · ${new Date(stats.lastIngestAt).toLocaleString()}`
                                : 'Last ingest: unknown'
                        }
                    />
                    <Chip
                        size="small"
                        icon={<CacheIcon sx={{ fontSize: 16 }} />}
                        variant="outlined"
                        label={`QueryCache: ${stats?.cache?.last24h ?? 0} entries`}
                    />
                </Box>
            </Card>

            {/* Refusals — pinned immediately below the charts, per spec */}
            <Card sx={{ mb: 1.5 }}>
                <CardContent>
                    <SectionHeader
                        title="Refusals (last 24h) — gaps in the corpus"
                        description="The bot couldn't ground these — review to decide if content is missing."
                    />
                    {(!stats?.refusalQueries24h ||
                        stats.refusalQueries24h.length === 0) ? (
                        <EmptyState text="No refusals in the last 24 hours." />
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
                                            <TableCell sx={{ maxWidth: 360 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                    title={r.query}
                                                >
                                                    {r.query}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {r.userId?.name || r.userId?.email || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {formatDistanceToNow(new Date(r.createdAt), {
                                                    addSuffix: true,
                                                })}
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
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

            {/* Top queries — truncated to 80 chars, right-aligned numerics */}
            <Card sx={{ mb: 1.5 }}>
                <CardContent>
                    <SectionHeader
                        title="Top queries (last 7 days)"
                        description="Most-asked questions — a signal for what to surface on the chat empty-state."
                    />
                    {(!stats?.topQueries7d || stats.topQueries7d.length === 0) ? (
                        <EmptyState text="No queries yet." />
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
                                    {stats.topQueries7d.map((q) => {
                                        const text = q.sampleQuery || q.normalizedQuery || '';
                                        const display =
                                            text.length > 80
                                                ? text.slice(0, 80) + '…'
                                                : text;
                                        return (
                                            <TableRow key={q.normalizedQuery}>
                                                <TableCell sx={{ maxWidth: 360 }}>
                                                    <Tooltip title={text} arrow>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}
                                                        >
                                                            {display}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {q.count}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {q.avgTier}
                                                </TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                                                >
                                                    {q.avgLatency} ms
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Low confidence */}
            <Card sx={{ mb: 1.5 }}>
                <CardContent>
                    <SectionHeader
                        title="Low-confidence answers (last 24h)"
                        description="Tier 1 or 2 answers where the top cosine was below 0.50 — borderline cases worth reviewing."
                    />
                    {(!stats?.lowConfidenceQueries24h ||
                        stats.lowConfidenceQueries24h.length === 0) ? (
                        <EmptyState text="No borderline answers in the last 24 hours." />
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
                                            <TableCell sx={{ maxWidth: 360 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                    title={q.query}
                                                >
                                                    {q.query}
                                                </Typography>
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {q.topScore.toFixed(3)}
                                            </TableCell>
                                            <TableCell
                                                align="right"
                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                            >
                                                {q.tier}
                                            </TableCell>
                                            <TableCell>{q.programFilter || '—'}</TableCell>
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

            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
                Phase 4 admin dashboard · stats refresh on Re-ingest or manual Refresh.
            </Typography>

            <Snackbar
                open={Boolean(ingestMsg)}
                autoHideDuration={6000}
                onClose={() => setIngestMsg('')}
                message={ingestMsg}
            />
        </Box>
    );
};

export default DocsRagPanel;
