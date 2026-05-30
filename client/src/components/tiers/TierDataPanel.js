import React, { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress,
} from '@mui/material';
import tierService from '../../services/tierService';
import EChart from '../charts/EChart';
import { lineOption, compactCurrencyFmt } from '../charts/presets';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIER_META = {
    1: { color: '#1F7A35', label: 'Tier 1' },
    2: { color: '#2383E2', label: 'Tier 2' },
    3: { color: '#C99700', label: 'Tier 3' },
};
const fmtAED = (n) => `AED ${Number(n || 0).toLocaleString('en-US')}`;

// Below the poster: a 3-line month-by-month trend (one line per tier) plus a
// per-tier table so the raw numbers behind the image are visible. Reloads when
// `version` changes (admin generates / edits tiers).
export default function TierDataPanel({ version = 0, mode = 'light' }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        tierService
            .getTiers()
            .then((res) => { if (alive) setData(res.data || null); })
            .catch(() => { /* best-effort */ })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [version]);

    const chartOpt = useMemo(() => {
        if (!data?.trend?.series?.length) return null;
        const categories = data.trend.months.map((m) => MONTHS[m - 1]);
        const series = data.trend.series.map((s) => ({
            name: TIER_META[s.tier]?.label || `Tier ${s.tier}`,
            data: s.data,
            color: TIER_META[s.tier]?.color,
            smooth: true,
        }));
        return lineOption({ categories, series, valueFormatter: compactCurrencyFmt });
    }, [data]);

    if (loading && !data) {
        return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>;
    }
    if (!data?.tiers?.length) return null;

    const tiers = [...data.tiers].sort((a, b) => a.tier - b.tier);
    const grand = tiers.reduce((s, t) => s + (t.mtdAchieved || 0), 0);
    const monthLabel = data.month ? `${MONTHS[data.month - 1]} ${data.year}` : data.year;

    return (
        <Box sx={{ mt: 3 }}>
            {/* 3-line trend chart */}
            <Paper variant="outlined" sx={{ borderRadius: '14px', p: 2, mb: 3 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1, color: 'var(--d-text, #191918)' }}>
                    Tier performance — month by month · {data.year}
                </Typography>
                {chartOpt
                    ? <EChart height={320} option={chartOpt} mode={mode} />
                    : <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted, #8A887E)' }}>No monthly data yet.</Typography>}
            </Paper>

            {/* Per-tier member tables */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                {tiers.map((t) => {
                    const meta = TIER_META[t.tier] || TIER_META[1];
                    const members = [...(t.members || [])].sort((a, b) => (b.mtdAchieved || 0) - (a.mtdAchieved || 0));
                    return (
                        <Paper key={t.tier} variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', borderTop: `3px solid ${meta.color}` }}>
                            <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                                <Typography sx={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{t.label || meta.label}</Typography>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--d-text, #191918)', fontVariantNumeric: 'tabular-nums' }}>{fmtAED(t.mtdAchieved)}</Typography>
                            </Box>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'var(--d-surface-muted, #F1EFEA)' }}>
                                            <TableCell sx={{ fontWeight: 700 }}>Consultant</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }} align="right">MTD · {monthLabel}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {members.map((m) => (
                                            <TableRow key={m._id} hover>
                                                <TableCell>
                                                    {m.name}
                                                    {m.teamName ? (
                                                        <Typography component="span" sx={{ color: 'var(--d-text-muted, #8A887E)', fontSize: 11, ml: 0.5 }}>· {m.teamName}</Typography>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtAED(m.mtdAchieved)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {members.length === 0 ? (
                                            <TableRow><TableCell colSpan={2} sx={{ color: 'var(--d-text-muted, #8A887E)', fontStyle: 'italic' }}>No consultants assigned</TableCell></TableRow>
                                        ) : null}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    );
                })}
            </Box>

            <Typography sx={{ mt: 1.5, fontSize: 13, fontWeight: 700, color: 'var(--d-text-muted, #8A887E)' }}>
                Combined MTD across all tiers: {fmtAED(grand)}
            </Typography>
        </Box>
    );
}
