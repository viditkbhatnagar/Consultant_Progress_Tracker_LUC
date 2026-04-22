import React from 'react';
import { Box, Typography } from '@mui/material';

// Reusable 4-card KPI strip. Each card has a semantic accent color,
// uppercase label, primary numeric value, optional sub-label, and a thin
// accent bar along the top edge.
const KPICard = ({ label, value, color, sub }) => (
    <Box
        sx={{
            flex: '1 1 0',
            minWidth: 160,
            px: 2,
            py: 1.5,
            borderRadius: '12px',
            backgroundColor: 'var(--t-surface-muted)',
            border: '1px solid var(--t-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0.3,
            position: 'relative',
            boxShadow: 'var(--t-shadow-card-sm)',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                borderTopLeftRadius: 'inherit',
                borderTopRightRadius: 'inherit',
                backgroundColor: color,
                opacity: 0.9,
            },
        }}
    >
        <Typography
            sx={{
                fontSize: 11,
                color: 'var(--t-text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
            }}
        >
            {label}
        </Typography>
        <Typography
            sx={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 26,
                fontWeight: 700,
                color,
                lineHeight: 1.1,
            }}
        >
            {value}
        </Typography>
        {sub && (
            <Typography
                sx={{ fontSize: 11.5, color: 'var(--t-text-3)', fontWeight: 600 }}
            >
                {sub}
            </Typography>
        )}
    </Box>
);

const StudentsKPIStrip = ({ cards }) => (
    <Box
        sx={{
            display: 'flex',
            gap: 1.25,
            mb: 1.5,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-track': {
                backgroundColor: 'var(--t-track-bg)',
                borderRadius: 8,
            },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'var(--t-scrollbar-thumb)',
                borderRadius: 8,
            },
        }}
    >
        {cards.map((c) => (
            <KPICard key={c.label} {...c} />
        ))}
    </Box>
);

export default StudentsKPIStrip;
