import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import {
    CONVERSION_STATUSES,
    FOLLOW_UP_STATUSES,
    ALL_STATUSES,
    getStatusPalette,
} from '../../utils/meetingDesign';

const CARD_SX = {
    backgroundColor: 'var(--t-surface)',
    border: '1px solid var(--t-border)',
    borderRadius: '14px',
    padding: '14px 16px',
    minHeight: 112,
    position: 'relative',
    overflow: 'hidden',
};

const KPI_LABEL_SX = {
    fontSize: 11,
    color: 'var(--t-text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    lineHeight: 1.2,
};

// Inline SVG sparkline. Generates a simple area + line from a numeric series.
const Sparkline = ({ points, color = '#1976d2', width = 120, height = 28 }) => {
    if (!points || points.length < 2) {
        return <Box sx={{ height, mt: 1 }} />;
    }
    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = Math.max(1, max - min);
    const step = width / (points.length - 1);
    const norm = (v) => height - 2 - ((v - min) / span) * (height - 4);
    const d = points
        .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${norm(v).toFixed(1)}`)
        .join(' ');
    const area = `${d} L${width},${height} L0,${height} Z`;
    const gradId = `spark-grad-${color.replace(/[^a-z0-9]/gi, '')}`;
    return (
        <svg width={width} height={height} style={{ display: 'block', marginTop: 8 }}>
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradId})`} />
            <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const TrendPill = ({ value }) => {
    if (value == null || Number.isNaN(value)) return null;
    const up = value >= 0;
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                fontSize: 11,
                fontWeight: 600,
                px: '6px',
                py: '2px',
                borderRadius: '999px',
                backgroundColor: up ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                color: up ? '#15803D' : '#B91C1C',
            }}
        >
            {up ? <ArrowUpward sx={{ fontSize: 12 }} /> : <ArrowDownward sx={{ fontSize: 12 }} />}
            {Math.abs(value)}%
        </Box>
    );
};

const KpiCard = ({ label, value, sub, trend, sparkColor, sparkPoints, sx }) => (
    <Box sx={{ ...CARD_SX, ...sx }}>
        <Typography sx={KPI_LABEL_SX}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.75 }}>
            <Typography
                sx={{
                    fontSize: 28,
                    fontWeight: 650,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--t-text)',
                }}
            >
                {value}
            </Typography>
            <TrendPill value={trend} />
        </Box>
        {sub && (
            <Typography sx={{ fontSize: 11.5, color: 'var(--t-text-muted)', mt: 0.5 }}>{sub}</Typography>
        )}
        {sparkPoints && <Sparkline points={sparkPoints} color={sparkColor} />}
    </Box>
);

// Pipeline funnel shows every status with a small progress bar + count.
const FunnelCard = ({ rows }) => {
    const total = rows.length || 1;
    const counts = useMemo(() => {
        const out = {};
        for (const s of ALL_STATUSES) out[s] = 0;
        for (const r of rows) if (r.status && out[r.status] != null) out[r.status]++;
        return out;
    }, [rows]);

    // Only render statuses with data so the card doesn't fill with empty bars.
    const visible = ALL_STATUSES.filter((s) => counts[s] > 0);
    const toRender = visible.length > 0 ? visible : ['Warm', 'Admission'];

    return (
        <Box sx={{ ...CARD_SX, gridColumn: { xs: '1', md: 'span 1' } }}>
            <Typography sx={KPI_LABEL_SX}>Pipeline this period</Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${Math.min(toRender.length, 6)}, minmax(0, 1fr))` },
                    gap: 1.25,
                    mt: 1.25,
                }}
            >
                {toRender.map((s) => {
                    const { bg, dot } = getStatusPalette(s);
                    const pct = ((counts[s] || 0) / total) * 100;
                    return (
                        <Box key={s} sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    height: 6,
                                    borderRadius: 999,
                                    backgroundColor: bg,
                                    overflow: 'hidden',
                                }}
                            >
                                <Box
                                    sx={{
                                        height: '100%',
                                        width: `${pct}%`,
                                        backgroundColor: dot,
                                        borderRadius: 999,
                                    }}
                                />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                                <Box sx={{ width: 7, height: 7, borderRadius: 999, backgroundColor: dot }} />
                                <Typography
                                    sx={{
                                        fontSize: 11.5,
                                        color: 'var(--t-text-3)',
                                        flex: 1,
                                        minWidth: 0,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {s}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: 'var(--t-text)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {counts[s] || 0}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

// Given rows with a meetingDate ISO string, bucket into `buckets` equal-sized
// day ranges and return the counts. Used to feed the sparkline.
function seriesFromRows(rows, buckets = 12) {
    if (rows.length === 0) return Array.from({ length: buckets }, () => 0);
    const times = rows
        .map((r) => new Date(r.meetingDate).getTime())
        .filter((t) => !Number.isNaN(t));
    if (times.length === 0) return Array.from({ length: buckets }, () => 0);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(1, max - min);
    const step = span / buckets;
    const out = Array.from({ length: buckets }, () => 0);
    for (const t of times) {
        let idx = Math.floor((t - min) / step);
        if (idx >= buckets) idx = buckets - 1;
        if (idx < 0) idx = 0;
        out[idx]++;
    }
    return out;
}

function pctTrend(rows, predicate) {
    // Split the current window in half by date and compare the count of
    // predicate-matching rows. Returns an integer % (positive = up).
    if (rows.length < 2) return null;
    const sorted = [...rows].sort(
        (a, b) => new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime()
    );
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid);
    const second = sorted.slice(mid);
    const a = predicate ? first.filter(predicate).length : first.length;
    const b = predicate ? second.filter(predicate).length : second.length;
    if (a === 0 && b === 0) return null;
    if (a === 0) return 100;
    return Math.round(((b - a) / a) * 100);
}

const MeetingsKPIStrip = ({ rows = [] }) => {
    const total = rows.length;
    const admissions = rows.filter((r) => CONVERSION_STATUSES.includes(r.status)).length;
    const conversion = total ? Math.round((admissions / total) * 100) : 0;
    const followUps = rows.filter((r) => FOLLOW_UP_STATUSES.includes(r.status)).length;

    const sparkAll = useMemo(() => seriesFromRows(rows), [rows]);
    const sparkConv = useMemo(
        () => seriesFromRows(rows.filter((r) => CONVERSION_STATUSES.includes(r.status))),
        [rows]
    );
    const sparkFollow = useMemo(
        () => seriesFromRows(rows.filter((r) => FOLLOW_UP_STATUSES.includes(r.status))),
        [rows]
    );

    const trendAll = useMemo(() => pctTrend(rows), [rows]);
    const trendConv = useMemo(
        () => pctTrend(rows, (r) => CONVERSION_STATUSES.includes(r.status)),
        [rows]
    );
    const trendFollow = useMemo(
        () => pctTrend(rows, (r) => FOLLOW_UP_STATUSES.includes(r.status)),
        [rows]
    );

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1.6fr' },
                gap: 1.5,
                mb: 2,
            }}
        >
            <KpiCard
                label="Meetings logged"
                value={total}
                sub="In current view"
                trend={trendAll}
                sparkColor="#1976d2"
                sparkPoints={sparkAll}
            />
            <KpiCard
                label="Conversion"
                value={`${conversion}%`}
                sub={`${admissions} admissions`}
                trend={trendConv}
                sparkColor="#16a34a"
                sparkPoints={sparkConv}
            />
            <KpiCard
                label="Follow-ups due"
                value={followUps}
                sub="Warm · Hot · Offer Sent · Awaiting"
                trend={trendFollow == null ? null : -trendFollow}
                sparkColor="#ea580c"
                sparkPoints={sparkFollow}
            />
            <FunnelCard rows={rows} />
        </Box>
    );
};

export default MeetingsKPIStrip;
