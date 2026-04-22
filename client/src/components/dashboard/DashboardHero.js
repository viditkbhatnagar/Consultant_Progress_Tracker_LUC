import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { LightMode as LightIcon, DarkMode as DarkIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { riseVariants, useReducedMotionVariants } from '../../utils/dashboardMotion';
import { useDashboardTheme } from '../../utils/dashboardTheme';

// Top block of the dashboard: greeting line, subtitle (role / week / team),
// and a theme toggle button on the right. Optional `right` slot for
// additional actions (org switcher, etc.).
const DashboardHero = ({ title, subtitle, eyebrow, right }) => {
    const { mode, toggle } = useDashboardTheme();
    const variants = useReducedMotionVariants(riseVariants);

    return (
        <motion.div variants={variants} style={{ marginBottom: 24 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    flexDirection: { xs: 'column', md: 'row' },
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    {eyebrow && (
                        <Typography
                            sx={{
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'var(--d-text-muted)',
                                fontWeight: 600,
                                mb: 0.75,
                            }}
                        >
                            {eyebrow}
                        </Typography>
                    )}
                    <Typography
                        sx={{
                            fontSize: { xs: 24, sm: 28, md: 32 },
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--d-text)',
                            lineHeight: 1.1,
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle && (
                        <Typography
                            sx={{
                                mt: 0.75,
                                fontSize: 14,
                                color: 'var(--d-text-3)',
                                fontWeight: 400,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    )}
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexShrink: 0,
                    }}
                >
                    {right}
                    <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
                        <IconButton
                            onClick={toggle}
                            aria-label="Toggle dashboard theme"
                            sx={{
                                color: 'var(--d-text-2)',
                                backgroundColor: 'var(--d-surface)',
                                border: '1px solid var(--d-border)',
                                borderRadius: '10px',
                                transition: 'background-color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                                '@media (hover: hover) and (pointer: fine)': {
                                    '&:hover': {
                                        backgroundColor: 'var(--d-surface-hover)',
                                        borderColor: 'var(--d-accent)',
                                    },
                                },
                                '&:focus-visible': {
                                    outline: '2px solid var(--d-accent)',
                                    outlineOffset: 2,
                                },
                            }}
                        >
                            {mode === 'dark' ? <LightIcon fontSize="small" /> : <DarkIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </motion.div>
    );
};

export default DashboardHero;
