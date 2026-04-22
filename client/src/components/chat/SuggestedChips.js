import React from 'react';
import { Box, Typography } from '@mui/material';

// Page-contextual starter queries. Picks a bucket based on the current
// pathname; falls back to generic suggestions otherwise.
const BUCKETS = [
    {
        match: /^\/admin\/dashboard/,
        items: [
            'Total revenue this month across LUC and Skillhub',
            'Which team has the highest achievement rate this week?',
            'Top 5 consultants by admissions closed this month',
            'How many commitments are pending right now?',
        ],
    },
    {
        match: /^\/team-lead\/dashboard/,
        items: [
            'Show my team\'s achievement rate this week',
            'Who in my team has the most missed commitments?',
            'List today\'s pending commitments for my team',
        ],
    },
    {
        match: /^\/skillhub\/dashboard/,
        items: [
            'New admissions this month for my branch',
            'Which counselor has the most active students?',
            'Revenue this month',
            'Pending demos across all students',
        ],
    },
    {
        match: /^\/hourly-tracker/,
        items: [
            'Who is present today?',
            "What is Arunima doing right now?",
            'Which consultants haven\'t logged any activity today?',
            'Busiest hour slot this week',
        ],
    },
    {
        match: /^\/meetings/,
        items: [
            'Meetings scheduled this week',
            'Which consultant had the most meetings in the last 7 days?',
            'Conversion rate from Warm to Admission this month',
        ],
    },
    {
        match: /^\/commitments/,
        items: [
            'Commitments due this week',
            'Top consultants by achievement this month',
            'How many commitments were achieved today?',
        ],
    },
    {
        match: /^\/student-database/,
        items: [
            'New admissions this month',
            'Active students by curriculum',
            'Students with outstanding fees',
        ],
    },
];

const FALLBACK = [
    'Total revenue this month',
    'Who is present today?',
    'Top 5 consultants by achievement this week',
    'List all team leads',
];

const pickItems = (pathname = '') => {
    const bucket = BUCKETS.find((b) => b.match.test(pathname));
    return bucket ? bucket.items : FALLBACK;
};

const SuggestedChips = ({ pathname, onPick }) => {
    const items = pickItems(pathname);
    return (
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
            <Typography
                sx={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--d-text-muted, #8A887E)',
                    fontWeight: 600,
                    mb: 1,
                }}
            >
                Try asking
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {items.map((q) => (
                    <Box
                        key={q}
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
                ))}
            </Box>
        </Box>
    );
};

export default SuggestedChips;
