import React, { useState, useEffect } from 'react';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Avatar,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    PersonAdd as PersonAddIcon,
    School as SchoolIcon,
    Assignment as AssignmentIcon,
    Logout as LogoutIcon,
    FormatQuote as QuoteIcon,
    AccessTime as AccessTimeIcon,
    AutoAwesome as AutoAwesomeIcon,
    BarChart as AnalyticsIcon,
    ChatBubbleOutline as AskMeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ORGANIZATION_LABELS } from '../../utils/constants';
import NotificationBell from '../NotificationBell';

export const DRAWER_WIDTH = 280;

const MOTIVATIONAL_QUOTES = [
    'Every admission is a life changed. Keep going.',
    'Small steps every day lead to big results.',
    "Your follow-up today is tomorrow's admission.",
    'Excellence is doing ordinary things extraordinarily well.',
    'Build relationships, not just numbers.',
    'The best counselor is a great listener.',
    'Push through the hard days — they build the strongest results.',
    'Consistency compounds. Show up daily.',
    'Teach like it matters, because it does.',
    "Great educators light the path, they don't carry students.",
];

const SkillhubSidebar = ({ activeView, onNavigate, onNewAdmission, onLogout }) => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const [quoteIdx, setQuoteIdx] = useState(0);
    const branchLabel = ORGANIZATION_LABELS[user?.organization] || 'Skillhub';

    useEffect(() => {
        const t = setInterval(
            () => setQuoteIdx((i) => (i + 1) % MOTIVATIONAL_QUOTES.length),
            10000
        );
        return () => clearInterval(t);
    }, []);

    const navItemSx = {
        borderRadius: '10px',
        color: 'var(--d-text-2, #2A2927)',
        transition:
            'background-color var(--d-dur-sm, 180ms) var(--d-ease-enter, ease), color var(--d-dur-sm, 180ms) var(--d-ease-enter, ease)',
        '& .MuiListItemIcon-root': {
            color: 'var(--d-text-3, #57564E)',
            minWidth: 40,
            transition: 'color var(--d-dur-sm, 180ms) var(--d-ease-enter, ease)',
        },
        '& .MuiListItemText-primary': {
            fontSize: '0.925rem',
            fontWeight: 500,
        },
        '@media (hover: hover) and (pointer: fine)': {
            '&:hover': {
                backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
            },
        },
        '&:focus-visible': {
            outline: '2px solid var(--d-accent, #2383E2)',
            outlineOffset: -2,
        },
        '&.Mui-selected': {
            backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
            color: 'var(--d-accent-text, #1F6FBF)',
            '& .MuiListItemIcon-root': {
                color: 'var(--d-accent, #2383E2)',
            },
            '&:hover': {
                backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
            },
        },
    };

    const navItem = (key, label, Icon, onClick) => (
        <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton onClick={onClick} selected={activeView === key} sx={navItemSx}>
                <ListItemIcon><Icon /></ListItemIcon>
                <ListItemText primary={label} />
            </ListItemButton>
        </ListItem>
    );

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: DRAWER_WIDTH,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                    color: 'var(--d-text-2, #2A2927)',
                    borderRight: '1px solid var(--d-border-soft, #ECE9E2)',
                },
            }}
        >
            {/* Logo */}
            <Box
                sx={{
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                }}
            >
                <img
                    src="/skillhub-logo.jpeg"
                    alt="Skillhub Logo"
                    style={{
                        width: '100%',
                        maxWidth: '160px',
                        height: 'auto',
                        marginBottom: '0.75rem',
                        borderRadius: '12px',
                    }}
                />
                <Typography
                    sx={{
                        fontWeight: 600,
                        textAlign: 'center',
                        fontSize: '0.925rem',
                        color: 'var(--d-text-3, #57564E)',
                        letterSpacing: '-0.01em',
                    }}
                >
                    {branchLabel}
                </Typography>
            </Box>

            {/* User Info */}
            <Box
                sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    backgroundColor: 'var(--d-surface, #FFFFFF)',
                    borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                }}
            >
                <Avatar
                    sx={{
                        bgcolor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                        color: 'var(--d-accent-text, #1F6FBF)',
                        width: 40,
                        height: 40,
                        fontSize: '1rem',
                        fontWeight: 600,
                    }}
                >
                    {user?.name?.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        sx={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'var(--d-text, #191918)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {user?.name}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '0.72rem',
                            color: 'var(--d-text-muted, #8A887E)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {user?.teamName || 'Counselor'}
                    </Typography>
                </Box>
            </Box>

            <List sx={{ flex: 1, px: 1.25, py: 1.5 }}>
                {navItem('dashboard', 'Dashboard', DashboardIcon, () => onNavigate('dashboard'))}
                {navItem('students', 'Student Database', SchoolIcon, () => onNavigate('students'))}
                {navItem('commitments', 'Commitments', AssignmentIcon, () => onNavigate('commitments'))}
                {navItem('analytics', 'Analytics', AnalyticsIcon, () => onNavigate('analytics'))}
                {navItem('ai', 'AI Analysis', AutoAwesomeIcon, () => onNavigate('ai'))}
                {/* Ask me — Skillhub gets the same chat drawer as LUC, but
                    docs-RAG is server-side gated to LUC only (spec §10).
                    Skillhub queries always route to /api/chat/stream. */}
                {navItem('askme', 'Ask me', AskMeIcon, () =>
                    window.dispatchEvent(new CustomEvent('askme:open'))
                )}
                {navItem('new-admission', 'New Admission', PersonAddIcon, onNewAdmission)}
                {navItem('hourly', 'Hourly Tracker', AccessTimeIcon, () => navigate('/hourly-tracker'))}
            </List>

            <Box sx={{ p: 2, borderTop: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                <Box
                    sx={{
                        mb: 1.75,
                        p: 2,
                        minHeight: 110,
                        backgroundColor: 'var(--d-surface, #FFFFFF)',
                        border: '1px solid var(--d-border-soft, #ECE9E2)',
                        borderLeft: '3px solid var(--d-warm, #D97706)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.25,
                    }}
                >
                    <QuoteIcon
                        sx={{
                            fontSize: 18,
                            color: 'var(--d-warm, #D97706)',
                            mt: 0.25,
                            flexShrink: 0,
                        }}
                    />
                    <Typography
                        sx={{
                            color: 'var(--d-text-2, #2A2927)',
                            fontSize: '0.82rem',
                            lineHeight: 1.5,
                            fontStyle: 'italic',
                            fontWeight: 500,
                        }}
                    >
                        {MOTIVATIONAL_QUOTES[quoteIdx]}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 1,
                        px: 1,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: 11,
                            color: 'var(--d-text-muted, #8A887E)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                        }}
                    >
                        Notifications
                    </Typography>
                    <NotificationBell iconColor="var(--d-text-3, #57564E)" />
                </Box>

                <ListItemButton onClick={onLogout} sx={{ ...navItemSx, px: 1.5, py: 1 }}>
                    <ListItemIcon><LogoutIcon /></ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItemButton>
            </Box>
        </Drawer>
    );
};

export default SkillhubSidebar;
