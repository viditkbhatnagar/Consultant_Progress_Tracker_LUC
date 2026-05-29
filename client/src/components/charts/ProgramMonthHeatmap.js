import React from 'react';
import { Box, Typography } from '@mui/material';

// Single-hue → rgba for the heatmap intensity (ECharts-free, pure CSS grid).
const heatRgba = (a) => `rgba(35, 131, 226, ${a})`;

// Program × Month admissions heatmap. Rows = programs (AGI excluded), columns =
// months, cell colour scales with the admissions count. Used on the Leadership
// Dashboard and the All Teams page. `rows` is [{ program, monthly:[12], isAgi }];
// `months` is a 12-length array of short month labels.
const ProgramMonthHeatmap = ({ rows, months }) => {
    const data = (rows || []).filter((r) => !r.isAgi);
    const maxCount = data.reduce((mx, r) => Math.max(mx, ...r.monthly.map((v) => v || 0)), 0);
    if (data.length === 0) {
        return (
            <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted)', py: 3, textAlign: 'center' }}>
                No admissions in this period.
            </Typography>
        );
    }
    const headSx = { fontSize: 10, fontWeight: 600, color: 'var(--d-text-muted)', textAlign: 'center', alignSelf: 'end', pb: 0.5 };
    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) repeat(12, minmax(32px, 1fr))', gap: '4px', minWidth: 140 + 12 * 36 }}>
                <Box />
                {months.map((m) => (
                    <Typography key={m} sx={headSx}>{m}</Typography>
                ))}
                {data.map((r) => (
                    <React.Fragment key={r.program}>
                        <Box title={r.program} sx={{ display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 500, color: 'var(--d-text-2)', pr: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.program}
                        </Box>
                        {r.monthly.map((v, i) => {
                            const count = v || 0;
                            const alpha = count > 0 && maxCount > 0 ? 0.18 + 0.77 * (count / maxCount) : 0;
                            return (
                                <Box
                                    key={i}
                                    title={`${r.program} · ${months[i]}: ${count}`}
                                    sx={{
                                        minHeight: 30,
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        fontVariantNumeric: 'tabular-nums',
                                        color: count > 0 ? (alpha >= 0.5 ? '#fff' : 'var(--d-text-2)') : 'var(--d-text-faint)',
                                        backgroundColor: count > 0 ? heatRgba(alpha) : 'var(--d-surface)',
                                        border: count > 0 ? 'none' : '1px solid var(--d-border-soft)',
                                    }}
                                >
                                    {count > 0 ? count : '·'}
                                </Box>
                            );
                        })}
                    </React.Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default ProgramMonthHeatmap;
