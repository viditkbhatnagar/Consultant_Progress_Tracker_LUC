import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
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
// this period, cell colour = stage hue at an intensity scaled by count. A
// per-row total column and a per-stage totals row (+ grand total) frame the
// grid, and hovering a cell lists the underlying commitments. Pure CSS grid so
// it themes with the --d-* tokens (incl. dark mode).
const LeadStageHeatmap = ({ commitments = [], rowField = 'teamName', rowHeader = 'Team' }) => {
    // Columns: stages that actually appear, in canonical order.
    const stagesPresent = Array.from(
        new Set(commitments.map((c) => c.leadStage).filter(Boolean))
    ).sort((a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));

    // Rows: the distinct row-entities that have commitments, densest first.
    // Each cell keeps the matching commitment objects (for the hover tooltip).
    const rowLabels = Array.from(new Set(commitments.map((c) => c[rowField]).filter(Boolean)));
    const rows = rowLabels
        .map((label) => {
            const cells = {};
            let total = 0;
            stagesPresent.forEach((stage) => {
                const list = commitments.filter(
                    (c) => c[rowField] === label && c.leadStage === stage
                );
                cells[stage] = list;
                total += list.length;
            });
            return { label, cells, total };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);

    const maxCount = rows.reduce(
        (m, r) => stagesPresent.reduce((mm, s) => Math.max(mm, r.cells[s].length), m),
        0
    );

    // Per-stage column totals + grand total for the totals row.
    const colTotals = {};
    stagesPresent.forEach((stage) => {
        colTotals[stage] = rows.reduce((sum, r) => sum + r.cells[stage].length, 0);
    });
    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

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

    // Shared style for the total cells (row-total column + bottom totals row).
    const totalCellSx = {
        minHeight: 38,
        borderRadius: '7px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--d-text)',
        backgroundColor: 'var(--d-surface)',
        border: '1px solid var(--d-border)',
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

    // Rich hover content for a cell: the commitments behind the count.
    const cellTooltip = (label, stage, list) => (
        <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5, color: 'var(--d-text)' }}>
                {label} · {stage} ({list.length})
            </Typography>
            {list.map((c, i) => (
                <Box key={c._id || i} sx={{ py: 0.5, borderTop: i ? '1px solid var(--d-border-soft)' : 'none' }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: 'var(--d-text-2)' }}>
                        {c.consultantName || '—'} · {c.studentName || '—'}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)' }}>
                        {c.commitmentMade ? `"${c.commitmentMade}" · ` : ''}
                        {c.meetingsDone || 0} mtg{(c.meetingsDone || 0) === 1 ? '' : 's'} · {c.status || '—'}
                    </Typography>
                </Box>
            ))}
        </Box>
    );

    const tooltipSlotProps = {
        tooltip: {
            sx: {
                bgcolor: 'var(--d-surface)',
                color: 'var(--d-text)',
                border: '1px solid var(--d-border)',
                boxShadow: 'var(--d-shadow-elev)',
                maxWidth: 360,
                p: 1.25,
            },
        },
        arrow: { sx: { color: 'var(--d-surface)' } },
    };

    return (
        <Box sx={wrapperSx}>
            {header}
            <Box sx={{ overflowX: 'auto' }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: `minmax(84px, 1.1fr) repeat(${stagesPresent.length}, minmax(44px, 1fr)) minmax(54px, 0.9fr)`,
                        gap: '5px',
                        minWidth: 140 + stagesPresent.length * 58,
                    }}
                >
                    {/* Header row */}
                    <Typography sx={{ ...headerLabelSx, textAlign: 'left' }}>{rowHeader}</Typography>
                    {stagesPresent.map((stage) => (
                        <Typography key={`h-${stage}`} title={stage} sx={headerLabelSx}>
                            {stage}
                        </Typography>
                    ))}
                    <Typography sx={{ ...headerLabelSx, fontWeight: 700, color: 'var(--d-text-2)' }}>Total</Typography>

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
                                const list = row.cells[stage];
                                const count = list.length;
                                const color = getLeadStageColor(stage);
                                const ratio = maxCount > 0 ? count / maxCount : 0;
                                const alpha = count > 0 ? 0.2 + 0.75 * ratio : 0;
                                let textColor = 'var(--d-text-2)';
                                if (count > 0 && alpha >= 0.55) {
                                    textColor = luminance(color) > 0.6 ? '#1A1A1A' : '#FFFFFF';
                                }
                                const cellSx = {
                                    minHeight: 38,
                                    borderRadius: '7px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums',
                                    color: count > 0 ? textColor : 'var(--d-text-faint)',
                                    backgroundColor: count > 0 ? hexToRgba(color, alpha) : 'var(--d-surface)',
                                    border: count > 0 ? 'none' : '1px solid var(--d-border-soft)',
                                    cursor: count > 0 ? 'help' : 'default',
                                    transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                };
                                if (count === 0) {
                                    return <Box key={`${row.label}-${stage}`} sx={cellSx}>·</Box>;
                                }
                                return (
                                    <Tooltip
                                        key={`${row.label}-${stage}`}
                                        arrow
                                        title={cellTooltip(row.label, stage, list)}
                                        slotProps={tooltipSlotProps}
                                    >
                                        <Box sx={cellSx}>{count}</Box>
                                    </Tooltip>
                                );
                            })}
                            <Box sx={totalCellSx}>{row.total}</Box>
                        </React.Fragment>
                    ))}

                    {/* Totals row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--d-text)', pr: 1 }}>
                        Total
                    </Box>
                    {stagesPresent.map((stage) => (
                        <Box key={`ct-${stage}`} sx={totalCellSx}>{colTotals[stage]}</Box>
                    ))}
                    <Box sx={{ ...totalCellSx, backgroundColor: 'var(--d-accent-bg)', color: 'var(--d-accent-text)', borderColor: 'var(--d-accent)' }}>
                        {grandTotal}
                    </Box>
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
                <Typography sx={{ fontSize: 11, color: 'var(--d-text-muted)' }}>More commitments · hover a cell for details</Typography>
            </Box>
        </Box>
    );
};

export default LeadStageHeatmap;
