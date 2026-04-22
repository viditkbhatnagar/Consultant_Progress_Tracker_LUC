// Light/dark tokens for the Meeting Tracker + Commitment Tracker pages.
// The pages set these as CSS variables on a root <Box> so every child
// component can read them via `var(--t-...)` in sx without prop-drilling.

import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

export const LIGHT_TOKENS = {
    '--t-page-bg': '#F5F7FB',
    '--t-surface': '#FFFFFF',
    '--t-surface-muted': '#F7F9FC',
    '--t-surface-elev': '#FDFEFF',
    '--t-surface-hover': '#F8FAFC',
    '--t-border': '#ECEFF5',
    '--t-border-soft': '#F1F5F9',
    '--t-text': '#0F172A',
    '--t-text-2': '#1F2937',
    '--t-text-3': '#475569',
    '--t-text-muted': '#7A8699',
    '--t-text-faint': '#94A3B8',
    '--t-accent': '#1976d2',
    '--t-accent-bg': 'rgba(25,118,210,0.08)',
    '--t-accent-border': '#1976d2',
    '--t-accent-text': '#1e40af',
    '--t-success': '#16A34A',
    '--t-success-bg': 'rgba(22,163,74,0.1)',
    '--t-success-text': '#15803D',
    '--t-danger': '#B91C1C',
    '--t-danger-bg': 'rgba(220,38,38,0.1)',
    '--t-danger-text': '#B91C1C',
    '--t-warning': '#EA580C',
    '--t-track-bg': '#EEF2F7',
    '--t-track-bg-hover': '#E5EBF3',
    '--t-track-thumb': '#94A3B8',
    '--t-scrollbar-thumb': '#CBD5E1',
    '--t-shadow-card': '0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)',
    '--t-shadow-card-sm': '0 1px 2px rgba(15,23,42,0.06)',
    '--t-shadow-elev': '0 10px 30px rgba(15,23,42,0.12)',
    '--t-disabled': '#CBD5E1',
};

export const DARK_TOKENS = {
    '--t-page-bg': '#0A0F1A',
    '--t-surface': '#111827',
    '--t-surface-muted': '#0B1221',
    '--t-surface-elev': '#1E293B',
    '--t-surface-hover': '#1B2433',
    '--t-border': '#1F2937',
    '--t-border-soft': '#172033',
    '--t-text': '#F8FAFC',
    '--t-text-2': '#E2E8F0',
    '--t-text-3': '#CBD5E1',
    '--t-text-muted': '#94A3B8',
    '--t-text-faint': '#64748B',
    '--t-accent': '#60A5FA',
    '--t-accent-bg': 'rgba(96,165,250,0.15)',
    '--t-accent-border': '#60A5FA',
    '--t-accent-text': '#93C5FD',
    '--t-success': '#4ADE80',
    '--t-success-bg': 'rgba(74,222,128,0.15)',
    '--t-success-text': '#4ADE80',
    '--t-danger': '#F87171',
    '--t-danger-bg': 'rgba(248,113,113,0.18)',
    '--t-danger-text': '#F87171',
    '--t-warning': '#FB923C',
    '--t-track-bg': '#1F2937',
    '--t-track-bg-hover': '#283448',
    '--t-track-thumb': '#475569',
    '--t-scrollbar-thumb': '#475569',
    '--t-shadow-card': '0 1px 3px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.25)',
    '--t-shadow-card-sm': '0 1px 2px rgba(0,0,0,0.35)',
    '--t-shadow-elev': '0 10px 30px rgba(0,0,0,0.5)',
    '--t-disabled': '#334155',
};

export const getTokens = (mode) => (mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS);

const TrackerThemeContext = createContext({
    mode: 'light',
    setMode: () => {},
    toggle: () => {},
});

export const useTrackerTheme = () => useContext(TrackerThemeContext);

// Reads persisted mode once and exposes { mode, toggle, tokensSx } which
// callers merge into the root Box's sx so CSS vars apply to everything
// inside.
export const useThemeState = (storageKey) => {
    const [mode, setMode] = useState(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw === 'dark' ? 'dark' : 'light';
        } catch {
            return 'light';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, mode);
        } catch {
            /* quota */
        }
    }, [mode, storageKey]);

    const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);

    const value = useMemo(() => ({ mode, setMode, toggle }), [mode, toggle]);

    const tokensSx = useMemo(() => getTokens(mode), [mode]);

    return { mode, toggle, tokensSx, contextValue: value };
};

export const TrackerThemeProvider = ({ value, children }) => (
    <TrackerThemeContext.Provider value={value}>{children}</TrackerThemeContext.Provider>
);
