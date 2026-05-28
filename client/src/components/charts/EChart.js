import React, { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { Box } from '@mui/material';
import echarts from './echartsCore';

// Read an active dashboard-theme CSS token (the same --d-* system the old
// recharts components read) so chart colors follow light/dark. Falls back
// to a literal when the token isn't in scope.
export const readToken = (name, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
};

// Resolve the shared palette + axis/tooltip styling from theme tokens.
export function chartTheme() {
    const accent = readToken('--d-accent', '#2383E2');
    const accentText = readToken('--d-accent-text', '#1F6FBF');
    const warm = readToken('--d-warm', '#D97706');
    const success = readToken('--d-success', '#16A34A');
    const text = readToken('--d-text', '#191918');
    const text2 = readToken('--d-text-2', '#2A2927');
    const textMuted = readToken('--d-text-muted', '#8A887E');
    const surface = readToken('--d-surface', '#FFFFFF');
    const border = readToken('--d-border', '#E6E3DC');
    return {
        accent, accentText, warm, success, text, text2, textMuted, surface, border,
        palette: [accent, warm, success, accentText, '#673AB7', '#0EA5E9', '#EC4899', textMuted],
    };
}

const FONT = 'Inter, Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Deep-merge helper (objects only; arrays replace).
function merge(base, over) {
    if (!over) return base;
    const out = { ...base };
    for (const k of Object.keys(over)) {
        const bv = base[k];
        const ov = over[k];
        if (bv && ov && typeof bv === 'object' && typeof ov === 'object' && !Array.isArray(bv) && !Array.isArray(ov)) {
            out[k] = merge(bv, ov);
        } else {
            out[k] = ov;
        }
    }
    return out;
}

// Themed ECharts wrapper. Pass an ECharts `option`; sensible global
// defaults (font, palette, tooltip, grid) are merged underneath. `mode`
// (light/dark) is only used to force a re-read of tokens on theme flip.
const EChart = ({ option, height = 300, mode, onEvents, style, ...boxProps }) => {
    const merged = useMemo(() => {
        const t = chartTheme();
        const base = {
            color: t.palette,
            textStyle: { fontFamily: FONT, color: t.text2 },
            grid: { top: 32, right: 18, bottom: 24, left: 12, containLabel: true },
            tooltip: {
                backgroundColor: t.surface,
                borderColor: t.border,
                borderWidth: 1,
                textStyle: { color: t.text2, fontFamily: FONT },
                extraCssText: 'box-shadow:0 4px 12px rgba(0,0,0,0.12);border-radius:8px;',
            },
            legend: { textStyle: { color: t.text2, fontFamily: FONT }, icon: 'roundRect' },
        };
        return merge(base, option || {});
        // re-read tokens when the option or theme mode changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [option, mode]);

    return (
        <Box sx={{ width: '100%', height, ...(boxProps.sx || {}) }}>
            <ReactEChartsCore
                echarts={echarts}
                option={merged}
                notMerge
                lazyUpdate
                onEvents={onEvents}
                style={{ width: '100%', height: '100%', ...(style || {}) }}
            />
        </Box>
    );
};

export default EChart;
