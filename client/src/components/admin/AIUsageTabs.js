import React, { useMemo } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router-dom';

import APICostPanel from '../APICostPanel';
import DocsRagPanel from './DocsRagPanel';

// Phase 5 Commit 7 — the admin "AI Usage" view. Rolls together the
// OpenAI cost tracker (existing APICostPanel) and the Docs RAG admin
// dashboard (DocsRagPanel) under a single Tabs container. Tab state
// is reflected into the URL as ?tab=cost-tracking|docs-rag so deep
// links work (/admin/docs-rag legacy route redirects here with
// ?tab=docs-rag). Default tab is Cost Tracking when no param.
const TABS = [
    { value: 'cost-tracking', label: 'Cost Tracking' },
    { value: 'docs-rag', label: 'Docs RAG' },
];

const AIUsageTabs = () => {
    const [params, setParams] = useSearchParams();
    const raw = params.get('tab');
    const active = useMemo(
        () => (TABS.some((t) => t.value === raw) ? raw : 'cost-tracking'),
        [raw]
    );

    const handleChange = (_e, next) => {
        const q = new URLSearchParams(params);
        if (next === 'cost-tracking') q.delete('tab');
        else q.set('tab', next);
        setParams(q, { replace: true });
    };

    return (
        <Box>
            <Box
                sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    mb: 2,
                }}
            >
                <Tabs
                    value={active}
                    onChange={handleChange}
                    aria-label="AI Usage sections"
                >
                    {TABS.map((t) => (
                        <Tab key={t.value} value={t.value} label={t.label} />
                    ))}
                </Tabs>
            </Box>

            {active === 'cost-tracking' && <APICostPanel />}
            {active === 'docs-rag' && <DocsRagPanel />}
        </Box>
    );
};

export default AIUsageTabs;
