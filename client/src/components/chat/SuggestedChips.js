import React from 'react';
import { Box, Typography } from '@mui/material';

// Phase 5.4/5.6 — the new-chat empty state advertises BOTH tracker AND
// docs capabilities. We keep groups labelled with a small uppercase
// "FROM …" header so consultants see at a glance what the chatbot can
// answer. Skillhub users only see the tracker group (docs-RAG is
// LUC-only, spec §10) and their tracker prompts are branch-flavoured.

const TRACKER_GROUP_LUC = {
    label: 'FROM THE TRACKER',
    items: [
        'Total revenue this month across LUC and Skillhub',
        'Top 5 consultants by admissions closed this month',
        'How many commitments are pending right now?',
    ],
};

const trackerGroupForSkillhub = (branch) => ({
    label: 'FROM THE TRACKER',
    items: [
        `Total revenue this month for ${branch}`,
        'How many students enrolled this week?',
        'Outstanding fee summary by student',
    ],
});

const DOCS_GROUP = {
    label: 'FROM PROGRAM DOCS',
    items: [
        'What accreditations does the Knights MBA have?',
        'Is the SSM MBA recognized in India?',
        'Credit requirements for OTHM Level 5',
    ],
};

const Chip = ({ q, onPick }) => (
    <Box
        component="button"
        type="button"
        onClick={() => onPick?.(q)}
        sx={{
            border: '1px solid var(--d-border-soft, #ECE9E2)',
            backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
            color: 'var(--d-text-2, #2A2927)',
            borderRadius: 999,
            px: 1.5,
            py: 0.6,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            lineHeight: 1.3,
            transition:
                'background-color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter)',
            '&:hover': {
                backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                borderColor: 'var(--d-accent, #2383E2)',
                color: 'var(--d-accent-text, #1F6FBF)',
            },
            '&:focus-visible': {
                outline: '2px solid var(--d-accent, #2383E2)',
                outlineOffset: 2,
            },
        }}
    >
        {q}
    </Box>
);

const GroupLabel = ({ children }) => (
    <Typography
        sx={{
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--d-text-muted, #8A887E)',
            fontWeight: 600,
            mb: 0.75,
        }}
    >
        {children}
    </Typography>
);

const SuggestedChips = ({ onPick, organization }) => {
    let trackerGroup;
    let includeDocs;
    if (organization === 'skillhub_training') {
        trackerGroup = trackerGroupForSkillhub('Training');
        includeDocs = false;
    } else if (organization === 'skillhub_institute') {
        trackerGroup = trackerGroupForSkillhub('Institute');
        includeDocs = false;
    } else {
        // LUC (or anything else): full LUC + docs experience.
        trackerGroup = TRACKER_GROUP_LUC;
        includeDocs = true;
    }
    const groups = [trackerGroup];
    if (includeDocs) groups.push(DOCS_GROUP);

    return (
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
            {groups.map((g, idx) => (
                <Box key={g.label} sx={{ mt: idx === 0 ? 0 : 1.75 }}>
                    <GroupLabel>{g.label}</GroupLabel>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.75,
                            // On narrow viewports the chips are wrapped
                            // tightly; flex-wrap collapses to a single
                            // column naturally because each chip is a
                            // full sentence.
                        }}
                    >
                        {g.items.map((q) => (
                            <Chip key={q} q={q} onPick={onPick} />
                        ))}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default SuggestedChips;
