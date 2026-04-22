import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import {
    DashboardThemeProvider,
    LIGHT_TOKENS,
    DARK_TOKENS,
} from '../../utils/dashboardTheme';
import { pageStagger, useReducedMotionVariants } from '../../utils/dashboardMotion';

const GEIST_STACK = '"Geist", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GEIST_MONO_STACK = '"Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// Extract a hex token value for use in MUI's palette (MUI palette needs
// plain color strings — it can't consume CSS variables directly).
const pick = (tokens, name) => tokens[name];

// Wraps a dashboard page: left sidebar (injected by caller so Admin and TL
// can keep their existing sidebars), main scroll area, and the CSS variable
// root for the light/dark token system.
//
// A nested MUI ThemeProvider overrides typography.fontFamily AND the palette
// so any MUI component rendered inside the dashboard subtree (ToggleButton,
// Chip, TextField, DatePicker, etc. used by DateRangeSelector and others)
// automatically picks up dark-mode colors without per-component plumbing.
const DashboardShell = ({ sidebar, themeState, children, maxWidth = 1440 }) => {
    const { tokensSx, contextValue, mode } = themeState;
    const stagger = useReducedMotionVariants(pageStagger);

    const parentTheme = useTheme();
    const dashboardTheme = useMemo(() => {
        const tokens = mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
        return createTheme({
            ...parentTheme,
            palette: {
                ...(parentTheme.palette || {}),
                mode, // 'light' | 'dark' — MUI uses this for default styles
                primary: {
                    main: pick(tokens, '--d-accent'),
                    light: pick(tokens, '--d-accent-text'),
                    dark: pick(tokens, '--d-accent-text'),
                    contrastText: '#FFFFFF',
                },
                secondary: {
                    main: pick(tokens, '--d-warm'),
                    contrastText: '#FFFFFF',
                },
                error: { main: pick(tokens, '--d-danger') },
                success: { main: pick(tokens, '--d-success') },
                warning: { main: pick(tokens, '--d-warm') },
                text: {
                    primary: pick(tokens, '--d-text'),
                    secondary: pick(tokens, '--d-text-3'),
                    disabled: pick(tokens, '--d-text-faint'),
                },
                background: {
                    default: pick(tokens, '--d-bg'),
                    paper: pick(tokens, '--d-surface'),
                },
                divider: pick(tokens, '--d-border'),
                action: {
                    hover: pick(tokens, '--d-surface-hover'),
                    selected: pick(tokens, '--d-accent-bg'),
                    disabled: pick(tokens, '--d-disabled'),
                    disabledBackground: pick(tokens, '--d-surface-muted'),
                },
            },
            typography: {
                ...parentTheme.typography,
                fontFamily: GEIST_STACK,
                button: {
                    ...(parentTheme.typography?.button || {}),
                    fontFamily: GEIST_STACK,
                    textTransform: 'none',
                },
            },
            components: {
                ...(parentTheme.components || {}),
                // Force Geist on every MUI surface the sidebar / dashboard
                // uses. The parent theme injects `Inter` into several of
                // these via styleOverrides, which wins over the top-level
                // typography.fontFamily — overriding each target directly
                // is the only reliable way.
                MuiTypography: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiButton: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiListItemText: {
                    styleOverrides: {
                        primary: { fontFamily: GEIST_STACK },
                        secondary: { fontFamily: GEIST_STACK },
                    },
                },
                MuiMenuItem: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiChip: { styleOverrides: { label: { fontFamily: GEIST_STACK } } },
                MuiTab: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiTableCell: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiInputBase: { styleOverrides: { input: { fontFamily: GEIST_STACK } } },
                MuiOutlinedInput: { styleOverrides: { input: { fontFamily: GEIST_STACK } } },
                MuiToggleButton: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
                MuiAlert: { styleOverrides: { root: { fontFamily: GEIST_STACK } } },
            },
        });
    }, [parentTheme, mode]);

    return (
        <ThemeProvider theme={dashboardTheme}>
            <DashboardThemeProvider value={contextValue}>
                <Box
                    sx={{
                        display: 'flex',
                        minHeight: '100vh',
                        backgroundColor: 'var(--d-bg)',
                        color: 'var(--d-text)',
                        fontFamily: GEIST_STACK,
                        ...tokensSx,
                        '--d-font-sans': GEIST_STACK,
                        '--d-font-mono': GEIST_MONO_STACK,
                        transition:
                            'background-color var(--d-dur-md) var(--d-ease-enter), color var(--d-dur-md) var(--d-ease-enter)',
                        '& *:not(code):not(pre):not([class*="Mono"])': {
                            fontFamily: 'inherit',
                        },
                    }}
                >
                    {sidebar}
                    <Box
                        component="main"
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            px: { xs: 2, sm: 3, md: 4 },
                            py: { xs: 2, sm: 3 },
                        }}
                    >
                        <Box sx={{ maxWidth, mx: 'auto' }}>
                            <motion.div
                                variants={stagger}
                                initial="hidden"
                                animate="show"
                            >
                                {children}
                            </motion.div>
                        </Box>
                    </Box>
                </Box>
            </DashboardThemeProvider>
        </ThemeProvider>
    );
};

export default DashboardShell;
