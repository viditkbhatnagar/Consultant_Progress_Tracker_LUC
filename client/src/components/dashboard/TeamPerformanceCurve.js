import React from 'react';
import { Box, Typography } from '@mui/material';
import { format } from 'date-fns';
import { useDashboardTheme } from '../../utils/dashboardTheme';
import EChart, { chartTheme } from '../charts/EChart';
import { lineOption, percentFmt } from '../charts/presets';

// Soft accent → rgba for the area-fill gradient (ECharts canvas can't read
// CSS var() strings, so colours come from chartTheme()/readToken as hex).
const hexToRgba = (hex, a) => {
    const h = (hex || '#2383E2').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Achievement curve. Two reads of the same period via the header toggle: the
// "by" view (achievement % per row — team or consultant — ranked) and "Over
// time" (achievement % per ISO week, derived from the loaded commitments — no
// extra fetch). `byData` is [{ name, rate, commitments, sub }]; `byLabel` sets
// the toggle text. Renders through the shared <EChart> wrapper (Apache
// ECharts) like the rest of the app's charts.
const TeamPerformanceCurve = ({ byData = [], commitments = [], byLabel = 'By team' }) => {
    const { mode } = useDashboardTheme();
    const [view, setView] = React.useState('by');
    const isBy = view === 'by';

    const MODES = [
        { key: 'by', label: byLabel },
        { key: 'time', label: 'Over time' },
    ];

    const byRows = [...byData]
        .map((d) => ({
            name: d.name,
            rate: d.rate,
            commitments: d.commitments,
            sub: d.sub || '',
        }))
        .sort((a, b) => b.rate - a.rate);

    const byWeek = {};
    commitments.forEach((c) => {
        if (!c.weekStartDate) return;
        const d = new Date(c.weekStartDate);
        const key = format(d, 'yyyy-MM-dd');
        if (!byWeek[key]) byWeek[key] = { total: 0, achieved: 0, label: format(d, 'MMM d') };
        byWeek[key].total += 1;
        if (c.status === 'achieved' || c.admissionClosed) byWeek[key].achieved += 1;
    });
    const timeRows = Object.keys(byWeek)
        .sort()
        .map((key) => {
            const w = byWeek[key];
            return {
                name: w.label,
                rate: w.total > 0 ? Math.round((w.achieved / w.total) * 100) : 0,
                commitments: w.total,
                sub: '',
            };
        });

    const rows = isBy ? byRows : timeRows;

    const { accent } = chartTheme();

    const option = lineOption({
        categories: rows.map((r) => r.name),
        series: [{ name: 'Achievement', data: rows.map((r) => r.rate), color: accent, smooth: true }],
        valueFormatter: percentFmt,
        showLegend: false,
    });
    if (option.yAxis && !Array.isArray(option.yAxis)) {
        option.yAxis.min = 0;
        option.yAxis.max = 100;
    }
    option.series[0].areaStyle = {
        color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
                { offset: 0, color: hexToRgba(accent, 0.28) },
                { offset: 1, color: hexToRgba(accent, 0) },
            ],
        },
    };
    option.xAxis.axisLabel = {
        ...option.xAxis.axisLabel,
        rotate: isBy ? 28 : 0,
        interval: 0,
        hideOverlap: false,
        fontSize: 10,
    };
    option.grid = { ...option.grid, top: 12, right: 16, left: 8, bottom: isBy ? 70 : 24 };
    option.tooltip = {
        ...option.tooltip,
        trigger: 'axis',
        formatter: (params) => {
            const p = Array.isArray(params) ? params[0] : params;
            const r = rows[p.dataIndex] || {};
            const subLine = r.sub ? ` · ${r.sub}` : '';
            return `<strong>${r.name}</strong><br/>${r.rate}% achievement<br/>${r.commitments} commitments${subLine}`;
        },
    };

    return (
        <Box
            sx={{
                backgroundColor: 'var(--d-surface-muted)',
                border: '1px solid var(--d-border-soft)',
                borderRadius: '12px',
                p: 2.5,
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1.5,
                    mb: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Typography
                    sx={{
                        fontSize: 13,
                        color: 'var(--d-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontWeight: 600,
                    }}
                >
                    Performance
                </Typography>

                <Box
                    role="tablist"
                    sx={{
                        display: 'inline-flex',
                        backgroundColor: 'var(--d-surface)',
                        border: '1px solid var(--d-border)',
                        borderRadius: '9px',
                        p: '3px',
                        gap: '2px',
                    }}
                >
                    {MODES.map((m) => {
                        const active = view === m.key;
                        return (
                            <Box
                                key={m.key}
                                component="button"
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setView(m.key)}
                                sx={{
                                    border: 0,
                                    background: active ? 'var(--d-accent-bg)' : 'transparent',
                                    color: active ? 'var(--d-accent-text)' : 'var(--d-text-muted)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    px: 1.5,
                                    py: '5px',
                                    borderRadius: '7px',
                                    cursor: 'pointer',
                                    transition: 'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter)',
                                    '&:focus-visible': { outline: '2px solid var(--d-accent)', outlineOffset: 2 },
                                }}
                            >
                                {m.label}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {rows.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted)', py: 6, textAlign: 'center' }}>
                    No activity yet in this period.
                </Typography>
            ) : (
                <EChart option={option} height={300} mode={mode} />
            )}
        </Box>
    );
};

export default TeamPerformanceCurve;
