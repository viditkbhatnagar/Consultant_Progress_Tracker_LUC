import React from 'react';
import { Box, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
    gridStagger,
    riseItemVariants,
    cardHover,
    useReducedMotionVariants,
    useCountUp,
} from '../../utils/dashboardMotion';

// One KPI card. Value is count-up on first mount; subsequent target
// changes snap instantly (see useCountUp). `accent` decides sparkline /
// trend color — 'accent' | 'warm' | 'success' | 'danger'.
const accentColors = {
    accent: { text: 'var(--d-accent-text)', bg: 'var(--d-accent-bg)', line: 'var(--d-accent)' },
    warm: { text: 'var(--d-warm-text)', bg: 'var(--d-warm-bg)', line: 'var(--d-warm)' },
    success: { text: 'var(--d-success-text)', bg: 'var(--d-success-bg)', line: 'var(--d-success)' },
    danger: { text: 'var(--d-danger-text)', bg: 'var(--d-danger-bg)', line: 'var(--d-danger)' },
};

const TrendBadge = ({ value }) => {
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
                backgroundColor: up ? 'var(--d-success-bg)' : 'var(--d-danger-bg)',
                color: up ? 'var(--d-success-text)' : 'var(--d-danger-text)',
                fontVariantNumeric: 'tabular-nums',
            }}
        >
            {up ? <ArrowUpward sx={{ fontSize: 12 }} /> : <ArrowDownward sx={{ fontSize: 12 }} />}
            {Math.abs(value)}%
        </Box>
    );
};

// Stroke-dashoffset trace animation on mount. Draws the sparkline in over
// 700ms. `points` is a numeric series; null/empty points render nothing.
const Sparkline = ({ points, color = 'var(--d-accent)', width = 140, height = 32 }) => {
    const pathRef = React.useRef(null);
    const [length, setLength] = React.useState(0);

    React.useEffect(() => {
        if (pathRef.current) {
            setLength(pathRef.current.getTotalLength());
        }
    }, [points]);

    if (!points || points.length < 2) return <Box sx={{ height, mt: 1 }} />;

    const max = Math.max(...points);
    const min = Math.min(...points);
    const span = Math.max(1, max - min);
    const step = width / (points.length - 1);
    const norm = (v) => height - 2 - ((v - min) / span) * (height - 4);
    const d = points
        .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${norm(v).toFixed(1)}`)
        .join(' ');
    const area = `${d} L${width},${height} L0,${height} Z`;
    const gradId = `kpi-spark-${color.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;

    return (
        <svg width={width} height={height} style={{ display: 'block', marginTop: 8 }}>
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <motion.path
                d={area}
                fill={`url(#${gradId})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
            />
            <motion.path
                ref={pathRef}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ strokeDasharray: length, strokeDashoffset: length }}
                animate={length > 0 ? { strokeDashoffset: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            />
        </svg>
    );
};

const KPICard = ({ label, value, sub, trend, accent = 'accent', sparkPoints, format }) => {
    const color = accentColors[accent] || accentColors.accent;
    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    const isNumeric = !Number.isNaN(numericValue) && typeof value === 'number';
    const counted = useCountUp(isNumeric ? numericValue : 0);
    const display = isNumeric ? (format ? format(counted) : counted) : value;

    return (
        <motion.div
            variants={useReducedMotionVariants(riseItemVariants)}
            initial="rest"
            whileHover="hover"
            whileTap="press"
            style={{ display: 'flex' }}
        >
            <motion.div
                variants={cardHover}
                style={{
                    flex: 1,
                    backgroundColor: 'var(--d-surface)',
                    border: '1px solid var(--d-border)',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    minHeight: 122,
                    boxShadow: 'var(--d-shadow-card)',
                }}
            >
                <Typography
                    sx={{
                        fontSize: 11,
                        color: 'var(--d-text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        lineHeight: 1.2,
                    }}
                >
                    {label}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.75 }}>
                    <Typography
                        sx={{
                            fontSize: 30,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--d-text)',
                        }}
                    >
                        {display}
                    </Typography>
                    <TrendBadge value={trend} />
                </Box>
                {sub && (
                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)', mt: 0.5 }}>
                        {sub}
                    </Typography>
                )}
                {sparkPoints && <Sparkline points={sparkPoints} color={color.line} />}
            </motion.div>
        </motion.div>
    );
};

// Grid of 4 KPI cards. Pass `items` as an array of KPICard props.
const KPIStrip = ({ items }) => (
    <motion.div
        variants={useReducedMotionVariants(gridStagger)}
        style={{ marginBottom: 24 }}
    >
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    md: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1.75,
            }}
        >
            {items.map((item, idx) => (
                <KPICard key={item.key || item.label || idx} {...item} />
            ))}
        </Box>
    </motion.div>
);

export default KPIStrip;
export { KPICard, Sparkline };
