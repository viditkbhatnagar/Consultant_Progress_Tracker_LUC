import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { riseVariants, useReducedMotionVariants } from '../../utils/dashboardMotion';

// Reusable page section with title + optional right-side action + body.
// Wraps body in a subtle surface card with the dashboard tokens.
const SectionCard = ({ title, eyebrow, right, children, padding = 22, sx = {} }) => {
    const variants = useReducedMotionVariants(riseVariants);

    return (
        <motion.div variants={variants} style={{ marginBottom: 24 }}>
            <Box
                sx={{
                    backgroundColor: 'var(--d-surface)',
                    border: '1px solid var(--d-border)',
                    borderRadius: '14px',
                    boxShadow: 'var(--d-shadow-card-sm)',
                    p: `${padding}px`,
                    ...sx,
                }}
            >
                {(title || right || eyebrow) && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2,
                            mb: 2.5,
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            {eyebrow && (
                                <Typography
                                    sx={{
                                        fontSize: 11,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        color: 'var(--d-text-muted)',
                                        fontWeight: 600,
                                        mb: 0.5,
                                    }}
                                >
                                    {eyebrow}
                                </Typography>
                            )}
                            {title && (
                                <Typography
                                    sx={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: 'var(--d-text)',
                                        letterSpacing: '-0.01em',
                                    }}
                                >
                                    {title}
                                </Typography>
                            )}
                        </Box>
                        {right && <Box sx={{ flexShrink: 0 }}>{right}</Box>}
                    </Box>
                )}
                {children}
            </Box>
        </motion.div>
    );
};

export default SectionCard;
