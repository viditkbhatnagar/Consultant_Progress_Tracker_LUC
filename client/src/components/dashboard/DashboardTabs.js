import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { tabPanelVariants, useReducedMotionVariants } from '../../utils/dashboardMotion';

// Themed tab bar with animated underline + AnimatePresence content swap.
//
// Usage:
//   <DashboardTabs
//     value={tab}
//     onChange={setTab}
//     tabs={[
//       { value: 0, label: 'Overview', icon: <DashIcon /> },
//       { value: 1, label: 'Teams' },
//     ]}
//   />
//   <AnimatedTabPanel panelKey={tab}>
//     {tab === 0 && <OverviewView />}
//     {tab === 1 && <TeamsView />}
//   </AnimatedTabPanel>
const DashboardTabs = ({ value, onChange, tabs, sx = {} }) => (
    <Box
        sx={{
            borderBottom: '1px solid var(--d-border)',
            mb: 2.5,
            ...sx,
        }}
    >
        <Tabs
            value={value}
            onChange={(_, v) => onChange?.(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
                minHeight: 44,
                '& .MuiTabs-indicator': {
                    backgroundColor: 'var(--d-accent)',
                    height: 2,
                    borderRadius: '2px 2px 0 0',
                },
                '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: 14,
                    color: 'var(--d-text-3)',
                    minHeight: 44,
                    padding: '8px 14px',
                    transition: 'color var(--d-dur-sm) var(--d-ease-enter)',
                    '&.Mui-selected': {
                        color: 'var(--d-accent-text)',
                        fontWeight: 600,
                    },
                    '&:focus-visible': {
                        outline: '2px solid var(--d-accent)',
                        outlineOffset: -2,
                        borderRadius: '6px',
                    },
                },
                '& .MuiTabs-scrollButtons.Mui-disabled': {
                    opacity: 0.3,
                },
            }}
        >
            {tabs.map((t) => (
                <Tab
                    key={t.value ?? t.label}
                    value={t.value}
                    label={t.label}
                    icon={t.icon}
                    iconPosition="start"
                    disabled={t.disabled}
                />
            ))}
        </Tabs>
    </Box>
);

// Wraps tab content in AnimatePresence so entering/leaving panels crossfade.
// Pass `panelKey` = current tab value so React remounts children on change.
export const AnimatedTabPanel = ({ panelKey, children }) => {
    const variants = useReducedMotionVariants(tabPanelVariants);
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={panelKey}
                variants={variants}
                initial="hidden"
                animate="show"
                exit="exit"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

export default DashboardTabs;
