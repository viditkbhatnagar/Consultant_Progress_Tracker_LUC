import React from 'react';
import { Box } from '@mui/material';
import { MODE_META } from '../../utils/meetingDesign';

const ModeBadge = ({ mode, size = 14, dense = false }) => {
    if (!mode) return <span style={{ color: '#94a3b8' }}>—</span>;
    const meta = MODE_META[mode];
    const Icon = meta?.Icon;
    const color = meta?.color || 'var(--t-text-3)';
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: dense ? 11.5 : 12,
                fontWeight: 500,
                color,
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
            }}
        >
            {Icon && <Icon sx={{ fontSize: size }} />}
            {mode}
        </Box>
    );
};

export default ModeBadge;
