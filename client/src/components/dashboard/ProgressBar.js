import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';

// Animated horizontal progress bar. Fills from 0 to pct on mount + on any
// pct change. Color is picked by threshold unless caller passes explicit
// `color` var.
//
// Usage:
//   <ProgressBar value={72} label="Achievement" />
//   <ProgressBar value={50} max={80} />
const defaultColor = (pct) => {
    if (pct >= 70) return 'var(--d-success)';
    if (pct >= 40) return 'var(--d-warm)';
    return 'var(--d-danger)';
};

const ProgressBar = ({
    value = 0,
    max = 100,
    label,
    showValue = true,
    color,
    height = 8,
    sx = {},
}) => {
    const reduce = useReducedMotion();
    const safeMax = Math.max(1, max);
    const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
    const fill = color || defaultColor(pct);

    return (
        <Box sx={sx}>
            {(label || showValue) && (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        mb: 0.75,
                        gap: 1,
                    }}
                >
                    {label && (
                        <Typography
                            sx={{
                                fontSize: 12,
                                color: 'var(--d-text-3)',
                                fontWeight: 500,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {label}
                        </Typography>
                    )}
                    {showValue && (
                        <Typography
                            sx={{
                                fontSize: 12,
                                color: 'var(--d-text-2)',
                                fontWeight: 600,
                                fontVariantNumeric: 'tabular-nums',
                                flexShrink: 0,
                            }}
                        >
                            {Math.round(pct)}%
                        </Typography>
                    )}
                </Box>
            )}
            <Box
                sx={{
                    height,
                    backgroundColor: 'var(--d-track-bg)',
                    borderRadius: 999,
                    overflow: 'hidden',
                }}
            >
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={
                        reduce
                            ? { duration: 0 }
                            : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }
                    }
                    style={{
                        height: '100%',
                        backgroundColor: fill,
                        borderRadius: 999,
                    }}
                />
            </Box>
        </Box>
    );
};

export default ProgressBar;
