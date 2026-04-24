import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, Tooltip } from '@mui/material';
import { MenuBook as DocIcon } from '@mui/icons-material';

// Short program codes for the chip label — avoids wrapping on narrow
// viewports and keeps the chip row scannable. Matches the slug → display
// map the server ships but trimmed down.
const SHORT_NAMES = {
    'ssm-dba': 'SSM DBA',
    'ioscm-l7': 'IOSCM L7',
    'knights-bsc': 'Knights BSc',
    'knights-mba': 'Knights MBA',
    'malaysia-mba': 'Malaysia MBA',
    'othm-l5': 'OTHM L5',
    'ssm-bba': 'SSM BBA',
    'ssm-mba': 'SSM MBA',
};

const SECTION_LABELS = {
    accreditation: 'Accreditation',
    product: 'Product',
    scenario: 'Scenario',
    closing: 'Closing',
    quick_ref: 'Quick ref',
    overview: 'Overview',
};

const labelFor = (src) => {
    const prog = SHORT_NAMES[src.program] || src.programDisplayName || src.program;
    const dt = src.docType === 'qna' ? 'QNA' : 'Overview';
    const section = SECTION_LABELS[src.section] || src.section;
    return `${prog} · ${dt} · ${section} · p.${src.pageNumber}`;
};

const SourceChips = ({ sources }) => {
    const navigate = useNavigate();
    if (!sources || sources.length === 0) return null;

    // Dedupe by chunkId so the same chunk doesn't render twice if the
    // backend happens to return it via both dense and BM25 (RRF usually
    // collapses these but we defend anyway).
    const seen = new Set();
    const unique = sources.filter((s) => {
        if (seen.has(s.chunkId)) return false;
        seen.add(s.chunkId);
        return true;
    });

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                mt: 1,
                // Constrain max width so chips wrap on narrow viewports
                // rather than overflowing the assistant message bubble.
                maxWidth: '100%',
            }}
        >
            {unique.map((src) => (
                <Tooltip
                    key={src.chunkId}
                    title={
                        src.score
                            ? `${src.sourceFile} — match ${(src.score * 100).toFixed(0)}% (${src.retrievalMethod || 'retrieve'})`
                            : src.sourceFile
                    }
                    arrow
                >
                    <Chip
                        icon={<DocIcon sx={{ fontSize: 14 }} />}
                        label={labelFor(src)}
                        size="small"
                        onClick={() =>
                            navigate(
                                `/pdf-viewer?url=${encodeURIComponent(
                                    src.pdfUrl.split('#')[0]
                                )}&page=${src.pageNumber}&title=${encodeURIComponent(
                                    SHORT_NAMES[src.program] || src.programDisplayName || ''
                                )}`
                            )
                        }
                        sx={{
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 500,
                            height: 24,
                            borderRadius: '8px',
                            color: 'var(--d-text-2, #2A2927)',
                            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                            border: '1px solid var(--d-border, #E6E3DC)',
                            '& .MuiChip-icon': {
                                color: 'var(--d-accent, #2383E2)',
                                ml: 0.5,
                            },
                            '&:hover': {
                                backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
                                borderColor: 'var(--d-accent, #2383E2)',
                            },
                        }}
                    />
                </Tooltip>
            ))}
        </Box>
    );
};

export default SourceChips;
