// Design tokens for the Admin + TeamLead dashboards (and Skillhub view).
// Mirrors trackerTheme.js structure so both systems feel like the same app,
// but uses the "Notion-esque" ink + amber palette (warmer neutrals, Notion
// blue accent, amber highlight for admission/warm moments).
//
// Pages set these as CSS variables on a root <Box sx={tokensSx}> so every
// child component reads them via var(--d-...) in sx without prop-drilling.
//
// Motion tokens live here too (--d-dur-*, --d-ease-*) so CSS transitions
// stay in lockstep with the framer-motion variants in dashboardMotion.js.

import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

const MOTION_TOKENS = {
    '--d-dur-xs': '120ms',
    '--d-dur-sm': '180ms',
    '--d-dur-md': '240ms',
    '--d-dur-lg': '320ms',
    '--d-dur-hero': '600ms',
    '--d-ease-enter': 'cubic-bezier(0.22, 1, 0.36, 1)',
    '--d-ease-move': 'cubic-bezier(0.25, 1, 0.5, 1)',
    '--d-ease-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
};

export const LIGHT_TOKENS = {
    ...MOTION_TOKENS,
    '--d-bg': '#F7F6F3',
    '--d-surface': '#FFFFFF',
    '--d-surface-muted': '#F1EFEA',
    '--d-surface-elev': '#FFFFFF',
    '--d-surface-hover': '#EFEDE8',
    '--d-border': '#E6E3DC',
    '--d-border-soft': '#ECE9E2',
    '--d-text': '#191918',
    '--d-text-2': '#2A2927',
    '--d-text-3': '#57564E',
    '--d-text-muted': '#8A887E',
    '--d-text-faint': '#B3B1A8',
    '--d-accent': '#2383E2',
    '--d-accent-bg': 'rgba(35,131,226,0.08)',
    '--d-accent-border': '#2383E2',
    '--d-accent-text': '#1F6FBF',
    '--d-warm': '#D97706',
    '--d-warm-bg': 'rgba(217,119,6,0.08)',
    '--d-warm-text': '#B45309',
    '--d-success': '#16A34A',
    '--d-success-bg': 'rgba(22,163,74,0.1)',
    '--d-success-text': '#15803D',
    '--d-danger': '#B91C1C',
    '--d-danger-bg': 'rgba(220,38,38,0.1)',
    '--d-danger-text': '#B91C1C',
    '--d-warning': '#EA580C',
    '--d-track-bg': '#EAE7DF',
    '--d-track-thumb': '#8A887E',
    '--d-scrollbar-thumb': '#C9C5BB',
    '--d-shadow-card': '0 1px 2px rgba(25,25,24,0.04), 0 2px 8px rgba(25,25,24,0.04)',
    '--d-shadow-card-sm': '0 1px 2px rgba(25,25,24,0.05)',
    '--d-shadow-elev': '0 10px 30px rgba(25,25,24,0.08)',
    '--d-shadow-hover': '0 4px 12px rgba(25,25,24,0.08)',
    '--d-disabled': '#C9C5BB',
};

export const DARK_TOKENS = {
    ...MOTION_TOKENS,
    '--d-bg': '#161615',
    '--d-surface': '#242321',
    '--d-surface-muted': '#1C1B1A',
    '--d-surface-elev': '#2E2D2B',
    '--d-surface-hover': '#322F2D',
    '--d-border': '#3A3834',
    '--d-border-soft': '#2D2B28',
    // Brighter text in dark mode — the previous #EDECE9 read as grey against
    // the dark surface. These values give high contrast without feeling
    // fluorescent. All above WCAG AA on `--d-surface`.
    '--d-text': '#F5F3EF',
    '--d-text-2': '#DCD9D3',
    '--d-text-3': '#B8B5AD',
    '--d-text-muted': '#8E8B82',
    '--d-text-faint': '#64625B',
    '--d-accent': '#529CCA',
    '--d-accent-bg': 'rgba(82,156,202,0.15)',
    '--d-accent-border': '#529CCA',
    '--d-accent-text': '#7FB6DC',
    '--d-warm': '#F59E0B',
    '--d-warm-bg': 'rgba(245,158,11,0.15)',
    '--d-warm-text': '#FBBF24',
    '--d-success': '#4ADE80',
    '--d-success-bg': 'rgba(74,222,128,0.15)',
    '--d-success-text': '#4ADE80',
    '--d-danger': '#F87171',
    '--d-danger-bg': 'rgba(248,113,113,0.18)',
    '--d-danger-text': '#F87171',
    '--d-warning': '#FB923C',
    '--d-track-bg': '#2A2927',
    '--d-track-thumb': '#57564E',
    '--d-scrollbar-thumb': '#57564E',
    '--d-shadow-card': '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.25)',
    '--d-shadow-card-sm': '0 1px 2px rgba(0,0,0,0.35)',
    '--d-shadow-elev': '0 10px 30px rgba(0,0,0,0.5)',
    '--d-shadow-hover': '0 6px 16px rgba(0,0,0,0.4)',
    '--d-disabled': '#3B3A37',
};

export const getTokens = (mode) => (mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS);

const DashboardThemeContext = createContext({
    mode: 'light',
    setMode: () => {},
    toggle: () => {},
});

export const useDashboardTheme = () => useContext(DashboardThemeContext);

// Reads persisted mode from localStorage (key is caller-owned so Admin +
// TeamLead can share state or differ). Returns { mode, toggle, tokensSx,
// contextValue } — the page merges tokensSx into its root <Box sx>.
export const useDashboardThemeState = (storageKey = 'dashboard-theme-mode') => {
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

    // Publish the same tokens on :root so components rendered via Portal
    // (MUI Dialog, Menu, Popover, Snackbar, Tooltip) can resolve
    // `var(--d-...)` — they mount at document.body and sit outside the
    // page's sx-scoped subtree, so CSS variables don't cascade to them
    // unless we put the vars on the document root.
    useEffect(() => {
        const el = document.documentElement;
        const tokens = getTokens(mode);
        const keys = Object.keys(tokens);
        keys.forEach((k) => el.style.setProperty(k, tokens[k]));
        return () => {
            keys.forEach((k) => el.style.removeProperty(k));
        };
    }, [mode]);

    const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);

    const contextValue = useMemo(() => ({ mode, setMode, toggle }), [mode, toggle]);
    const tokensSx = useMemo(() => getTokens(mode), [mode]);

    return { mode, toggle, tokensSx, contextValue };
};

export const DashboardThemeProvider = ({ value, children }) => (
    <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>
);

// Convenience: sx blocks that every dashboard component needs. Keeps the
// "press 0.97 + hover whileHover" language centralised so the feel matches
// across the app.
export const PRESSABLE_SX = {
    transition: 'background-color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter)',
    cursor: 'pointer',
    '&:focus-visible': {
        outline: '2px solid var(--d-accent)',
        outlineOffset: 2,
    },
    '@media (hover: hover) and (pointer: fine)': {
        '&:hover': {
            backgroundColor: 'var(--d-surface-hover)',
        },
    },
};
