import React from 'react';
import { Box, Paper, Typography, Stack, Chip, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// Branded placeholder shown to team leads inside Executive Sales pages
// while the feature is still under development for the TL audience.
// The same component is reused across Executive Overview, Team Detail,
// and Monthly Targets so the lock state stays consistent.
const ComingSoonLock = ({
    title = 'Executive Sales',
    subtitle = 'A new Excel-style sales dashboard. Coming soon for team leads.',
}) => (
    <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <Paper
            elevation={0}
            sx={{
                p: { xs: 4, md: 5 },
                maxWidth: 620,
                width: '100%',
                borderRadius: '16px',
                border: '1px solid var(--d-border-soft, #ECE9E2)',
                backgroundColor: 'var(--d-surface, #FFFFFF)',
                textAlign: 'center',
            }}
        >
            <Box
                sx={{
                    mx: 'auto',
                    mb: 2.5,
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                        'linear-gradient(135deg, rgba(35,131,226,0.10), rgba(110,64,201,0.10))',
                    color: 'var(--d-accent, #2383E2)',
                }}
            >
                <HourglassEmptyIcon sx={{ fontSize: 30 }} />
            </Box>

            <Typography
                sx={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--d-text, #191918)',
                    mb: 0.5,
                }}
            >
                {title}
            </Typography>
            <Stack
                direction="row"
                spacing={1}
                justifyContent="center"
                alignItems="center"
                sx={{ mb: 2 }}
            >
                <Chip
                    label="Coming soon"
                    size="small"
                    sx={{
                        bgcolor: 'rgba(217,119,6,0.14)',
                        color: '#A35A06',
                        fontWeight: 600,
                    }}
                />
                <Tooltip title="The team-lead view is under development. Numbers are still being validated by admin." arrow>
                    <InfoOutlinedIcon
                        sx={{ fontSize: 18, color: 'var(--d-text-3, #57564E)' }}
                    />
                </Tooltip>
            </Stack>
            <Typography
                sx={{
                    fontSize: 14,
                    color: 'var(--d-text-3, #57564E)',
                    lineHeight: 1.6,
                    mb: 2,
                }}
            >
                {subtitle}
            </Typography>
            <Typography
                sx={{
                    fontSize: 13,
                    color: 'var(--d-text-muted, #8A887E)',
                    lineHeight: 1.6,
                }}
            >
                Your admin currently maintains the Executive Overview and team
                performance numbers. Reach out to them for current YTD / MTD figures
                while the team-lead view is being finalised.
            </Typography>
        </Paper>
    </Box>
);

export default ComingSoonLock;
