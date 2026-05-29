import React from 'react';
import { Box, Typography } from '@mui/material';
import { LEAD_STAGES, getLeadStageColor } from '../../utils/constants';

// Canonical stage order (index in LEAD_STAGES) for stable column ordering.
const STAGE_ORDER = LEAD_STAGES.reduce((acc, s, i) => {
    acc[s.value] = i;
    return acc;
}, {});

const hexToRgba = (hex, a) => {
    const h = (hex || '#757575').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Relative luminance — used to pick black/white text on saturated cells.
const luminance = (hex) => {
    const h = (hex || '#757575').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Lead-stage heatmap. Rows are whatever entity owns the commitments — teams on
// the admin dashboard (rowField="teamName") or consultants on a team-lead
// dashboard (rowField="consultantName"); columns are the lead stages present
// this period, and cell colour = stage hue at an intensity scaled by count.
// Pure CSS grid so it themes with the --d-* tokens (incl. dark mode).
const LeadStageHeatmap = ({ commitments = [], rowField = 'teamName', rowHeader = 'Team' }) => {
    // Columns: stages that actually appear, in canonical order.
    const stagesPresent = Array.from(
        new Set(commitments.map((c) => c.leadStage).filter(Boolean))
    ).sort((a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));

    // Rows: the distinct row-entities that have commitments, densest first.
    const rowLabels = Array.from(new Set(commitments.map((c) => c[rowField]).filter(Boolean)));
    const rows = rowLabels
        .map((label) => {
            const counts = {};
            let total = 0;
            stagesPresent.forEach((stage) => {
                const n = commitments.filter(
                    (c) => c[rowField] === label && c.leadStage === stage
                ).length;
                counts[stage] = n;
                total += n;
            });
            return { label, counts, total };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);

    const maxCount = rows.reduce(
        (m, r) => stagesPresent.reduce((mm, s) => Math.max(mm, r.counts[s]), m),
        0
    );

    const headerLabelSx = {
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--d-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        textAlign: 'center',
        whiteSpace: 'normal',
        lineHeight: 1.15,
        wordBreak: 'normal',
        px: 0.25,
        alignSelf: 'end',
        pb: 0.5,
    };

    const wrapperSx = {
        backgroundColor: 'var(--d-surface-muted)',
        border: '1px solid var(--d-border-soft)',
        borderRadius: '12px',
        p: 2,
        minWidth: 0,
    };

    const header = (
        <Typography
            sx={{
                fontSize: 13,
                color: 'var(--d-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                mb: 1.5,
            }}
        >
            Lead Stage Distribution
        </Typography>
    );

    if (rows.length === 0 || stagesPresent.length === 0) {
        return (
            <Box sx={wrapperSx}>
                {header}
                <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted)', py: 3, textAlign: 'center' }}>
                    No lead-stage activity in this period.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={wrapperSx}>
            {header}
            <Box sx={{ overflowX: 'auto' }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(84px, 1.1fr) repeat(${stagesPresent.length}, minmax(46px, 1fr))`,
                        gap: '5px',
                        minWidth: 80 + stagesPresent.length * 58,
                    }}
                >
                    {/* Header row */}
                    <Typography sx={{ ...headerLabelSx, textAlign: 'left' }}>{rowHeader}</Typography>
                    {stagesPresent.map((stage) => (
                        <Typography key={`h-${stage}`} title={stage} sx={headerLabelSx}>
                            {stage}
                        </Typography>
                    ))}

                    {/* Body */}
                    {rows.map((row) => (
                        <React.Fragment key={row.label}>
                            <Box
                                title={row.label}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--d-text-2)',
                                    pr: 1,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {row.label}
                            </Box>
                            {stagesPresent.map((stage) => {
                                const count = row.counts[stage];
                                const color = getLeadStageColor(stage);
                                const ratio = maxCount > 0 ? count / maxCount : 0;
                                const alpha = count > 0 ? 0.2 + 0.75 * ratio : 0;
                                let textColor = 'var(--d-text-2)';
                                if (count > 0 && alpha >= 0.55) {
                                    textColor = luminance(color) > 0.6 ? '#1A1A1A' : '#FFFFFF';
                                }
                                return (
                                    <Box
                                        key={`${row.label}-${stage}`}
                                        title={`${row.label} · ${stage}: ${count}`}
                                        sx={{
                                            minHeight: 38,
                                            borderRadius: '7px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            fontVariantNumeric: 'tabular-nums',
                                            color: count > 0 ? textColor : 'var(--d-text-faint)',
                                            backgroundColor:
                                                count > 0 ? hexToRgba(color, alpha) : 'var(--d-surface)',
                                            border: count > 0 ? 'none' : '1px solid var(--d-border-soft)',
                                            transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
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

            {/* Intensity legend */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)' }}>Fewer</Typography>
                <Box
                    sx={{
                        flex: '0 0 64px',
                        height: 8,
                        borderRadius: '999px',
                        background: 'linear-gradient(90deg, var(--d-surface), var(--d-accent))',
                        border: '1px solid var(--d-border-soft)',
                    }}
                />
                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)' }}>More commitments</Typography>
            </Box>
        </Box>
    );
};

export default LeadStageHeatmap;
