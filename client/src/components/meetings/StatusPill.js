import React from 'react';
import { Box } from '@mui/material';
import { getStatusPalette } from '../../utils/meetingDesign';

// Pill style + optional click handler. When `onClick` is provided, the pill
// renders as a button (the Table view wires this to an inline status-change
// popover). Otherwise it's a static tag.
const StatusPill = ({ status, size = 'md', onClick, sx }) => {
    if (!status) return <span style={{ color: '#94a3b8' }}>—</span>;
    const { bg, fg, dot } = getStatusPalette(status);
    const padding = size === 'sm' ? '3px 8px 3px 7px' : '4px 10px 4px 8px';
    const fontSize = size === 'sm' ? 11 : 12;
    const Component = onClick ? 'button' : 'span';
    return (
        <Box
            component={Component}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                padding,
                borderRadius: 999,
                backgroundColor: bg,
                color: fg,
                fontSize,
                fontWeight: 600,
                letterSpacing: 0.1,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                border: '1px solid transparent',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'filter 120ms ease, box-shadow 120ms ease',
                '&:hover': onClick
                    ? { filter: 'brightness(0.97)', boxShadow: '0 0 0 3px rgba(0,0,0,0.04)' }
                    : undefined,
                ...sx,
            }}
        >
            <Box
                component="span"
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: dot,
                    flexShrink: 0,
                }}
            />
            {status}
        </Box>
    );
};

export default StatusPill;
