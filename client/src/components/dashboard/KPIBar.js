import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
    riseVariants,
    useReducedMotionVariants,
    useCountUp,
} from '../../utils/dashboardMotion';

// Accent → token map (mirrors KPIStrip so the two stay visually in sync).
const accentColors = {
    accent: 'var(--d-accent)',
    warm: 'var(--d-warm)',
    success: 'var(--d-success)',
    danger: 'var(--d-danger)',
};

// Tiny inline trend pill (optional — kpiItems may omit `trend`).
const Trend = ({ value }) => {
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
                fontWeight: 700,
                px: '7px',
                py: '2px',
                borderRadius: '999px',
                backgroundColor: up ? 'var(--d-success-bg)' : 'var(--d-danger-bg)',
                color: up ? 'var(--d-success-text)' : 'var(--d-danger-text)',
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            {up ? '▲' : '▼'} {Math.abs(value)}%
        </Box>
    );
};

// One segment of the bar. Own component so useCountUp runs at hook top-level.
const Segment = ({ label, value, sub, trend, accent = 'accent', format, info }) => {
    const line = accentColors[accent] || accentColors.accent;
    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    const isNumeric = !Number.isNaN(numericValue) && typeof value === 'number';
    const counted = useCountUp(isNumeric ? numericValue : 0);
    const display = isNumeric ? (format ? format(counted) : counted) : value;

    return (
        <Box
            sx={{
                backgroundColor: 'var(--d-surface)',
                px: { xs: '12px', md: '16px' },
                py: { xs: '10px', md: '11px' },
                minWidth: 0,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                    sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: line,
                        flexShrink: 0,
                    }}
                />
                <Typography
                    sx={{
                        fontSize: 10,
                        color: 'var(--d-text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {label}
                </Typography>
                {info && (
                    <Tooltip title={info} arrow>
                        <InfoOutlined sx={{ fontSize: 13, color: 'var(--d-text-faint)', cursor: 'help', flexShrink: 0 }} />
                    </Tooltip>
                )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                <Typography
                    sx={{
                        fontSize: { xs: 21, md: 24 },
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--d-text)',
                    }}
                >
                    {display}
                </Typography>
                <Trend value={trend} />
            </Box>

            {sub && (
                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)', mt: 0.25 }}>
                    {sub}
                </Typography>
            )}
        </Box>
    );
};

// One long unified KPI block. 4 segments share a single surface; the 1px
// `gap` over a border-soft background paints the dividers and re-flows
// cleanly when the grid wraps to 2-up / 1-up on narrow screens.
const KPIBar = ({ items = [] }) => {
    const variants = useReducedMotionVariants(riseVariants);
    const n = Math.max(1, items.length);

    return (
        <motion.div variants={variants} style={{ marginBottom: 24 }}>
            <Box
                sx={{
                    backgroundColor: 'var(--d-border-soft)',
                    border: '1px solid var(--d-border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--d-shadow-card)',
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: '1fr 1fr',
                        md: `repeat(${n}, minmax(0, 1fr))`,
                    },
                    gap: '1px',
                    overflow: 'hidden',
                }}
            >
                {items.map((item, idx) => (
                    <Segment key={item.key || item.label || idx} {...item} />
                ))}
            </Box>
        </motion.div>
    );
};

export default KPIBar;
