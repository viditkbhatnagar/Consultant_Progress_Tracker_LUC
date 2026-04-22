import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import {
    riseItemVariants,
    cardHover,
    useReducedMotionVariants,
} from '../../utils/dashboardMotion';
import ProgressBar from './ProgressBar';

// Card used for both Team cards (Admin) and Consultant cards (TeamLead + Admin).
// `kind` controls the header treatment. Render extras via `children`.
//
// Props:
//   name, subtitle, avatarLabel (initial), metricLabel, metricValue, metricMax,
//   stats (array of {label, value}), accent ('accent' | 'warm' | 'success'),
//   onClick, highlight (bool — draws a warm amber ring for a top performer).
const accentRing = {
    accent: 'var(--d-accent)',
    warm: 'var(--d-warm)',
    success: 'var(--d-success)',
};

const PerformerCard = ({
    name,
    subtitle,
    avatarLabel,
    metricLabel = 'Achievement',
    metricValue = 0,
    metricMax = 100,
    stats = [],
    accent = 'accent',
    onClick,
    highlight = false,
    children,
}) => {
    const variants = useReducedMotionVariants(riseItemVariants);
    const interactive = Boolean(onClick);

    return (
        <motion.div
            variants={variants}
            initial="rest"
            whileHover={interactive ? 'hover' : undefined}
            whileTap={interactive ? 'press' : undefined}
            style={{ display: 'flex' }}
        >
            <motion.div
                variants={interactive ? cardHover : undefined}
                onClick={onClick}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onKeyDown={
                    interactive
                        ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onClick();
                              }
                          }
                        : undefined
                }
                style={{
                    flex: 1,
                    backgroundColor: 'var(--d-surface)',
                    border: '1px solid var(--d-border)',
                    borderRadius: '14px',
                    padding: '18px 18px 20px',
                    boxShadow: 'var(--d-shadow-card)',
                    cursor: interactive ? 'pointer' : 'default',
                    outline: highlight ? `1px solid ${accentRing.warm}` : 'none',
                    outlineOffset: highlight ? '2px' : undefined,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Avatar
                        sx={{
                            bgcolor: 'var(--d-accent-bg)',
                            color: 'var(--d-accent-text)',
                            width: 42,
                            height: 42,
                            fontSize: 16,
                            fontWeight: 600,
                        }}
                    >
                        {avatarLabel || name?.charAt(0)?.toUpperCase() || '?'}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: 'var(--d-text)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {name}
                        </Typography>
                        {subtitle && (
                            <Typography
                                sx={{
                                    fontSize: 12,
                                    color: 'var(--d-text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {highlight && (
                        <Chip
                            label="Top"
                            size="small"
                            sx={{
                                backgroundColor: 'var(--d-warm-bg)',
                                color: 'var(--d-warm-text)',
                                fontWeight: 600,
                                fontSize: 10,
                                height: 22,
                                '& .MuiChip-label': { px: 1 },
                            }}
                        />
                    )}
                </Box>

                <ProgressBar
                    value={metricValue}
                    max={metricMax}
                    label={metricLabel}
                    sx={{ mb: stats.length > 0 ? 1.5 : 0 }}
                />

                {stats.length > 0 && (
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))`,
                            gap: 1,
                            pt: 1.25,
                            borderTop: '1px solid var(--d-border-soft)',
                        }}
                    >
                        {stats.map((s) => (
                            <Box key={s.label} sx={{ minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        fontSize: 10.5,
                                        color: 'var(--d-text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        fontWeight: 600,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {s.label}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: 'var(--d-text)',
                                        fontVariantNumeric: 'tabular-nums',
                                        mt: 0.25,
                                    }}
                                >
                                    {s.value}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}

                {children}
            </motion.div>
        </motion.div>
    );
};

export default PerformerCard;
