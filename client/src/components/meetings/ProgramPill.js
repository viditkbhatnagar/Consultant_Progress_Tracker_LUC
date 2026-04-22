import React from 'react';
import { Box, Tooltip } from '@mui/material';

// Monospace-styled "program" tag, as in the design mock. Free text — works
// for our variable LUC program names (CBSE, IGCSE-Cambridge, BBA, etc.).
const ProgramPill = ({ program, truncate = 22 }) => {
    if (!program) return <span style={{ color: '#94a3b8' }}>—</span>;
    const display =
        truncate && program.length > truncate
            ? `${program.slice(0, truncate - 1)}…`
            : program;
    return (
        <Tooltip title={program.length > display.length ? program : ''} arrow placement="top">
            <Box
                component="span"
                sx={{
                    display: 'inline-block',
                    px: '8px',
                    py: '2px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--t-border-soft)',
                    border: '1px solid var(--t-border)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--t-text-3)',
                    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                    letterSpacing: '0.02em',
                    lineHeight: 1.5,
                }}
            >
                {display}
            </Box>
        </Tooltip>
    );
};

export default ProgramPill;
