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
    Divider,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ORGANIZATION_LABELS } from '../../utils/constants';
import NotificationBell from '../NotificationBell';

export const DRAWER_WIDTH = 280;

const MOTIVATIONAL_QUOTES = [
    'Every admission is a life changed. Keep going.',
    'Small steps every day lead to big results.',
    'Your follow-up today is tomorrow\'s admission.',
    'Excellence is doing ordinary things extraordinarily well.',
    'Build relationships, not just numbers.',
    'The best counselor is a great listener.',
    'Push through the hard days — they build the strongest results.',
    'Consistency compounds. Show up daily.',
    'Teach like it matters, because it does.',
    'Great educators light the path, they don\'t carry students.',
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

    const navItem = (key, label, Icon, onClick) => (
        <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton
                onClick={onClick}
                selected={activeView === key}
                sx={{
                    borderRadius: 2,
                    '&:hover': { backgroundColor: 'rgba(160, 210, 235, 0.3)' },
                    '&.Mui-selected': { backgroundColor: '#A0D2EB' },
                }}
            >
                <ListItemIcon sx={{ color: '#2C3E50', minWidth: 40 }}>
                    <Icon />
                </ListItemIcon>
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 500 }}
                />
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
                    background: '#E5EAF5',
                    color: '#2C3E50',
                    borderRight: 'none',
                },
            }}
        >
            {/* Logo Section */}
            <Box
                sx={{
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(44, 62, 80, 0.1)',
                }}
            >
                <img
                    src="/skillhub-logo.jpeg"
                    alt="Skillhub Logo"
                    style={{
                        width: '100%',
                        maxWidth: '160px',
                        height: 'auto',
                        marginBottom: '1rem',
                        borderRadius: '12px',
                    }}
                />
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        textAlign: 'center',
                        fontSize: '0.95rem',
                        opacity: 0.95,
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
                    background: 'rgba(44, 62, 80, 0.05)',
                }}
            >
                <Avatar sx={{ bgcolor: '#A0D2EB', color: '#2C3E50', width: 40, height: 40 }}>
                    {user?.name?.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {user?.name}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.75rem' }}>
                        {user?.teamName}
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(44, 62, 80, 0.1)' }} />

            <List sx={{ flex: 1, px: 1.5, py: 2 }}>
                {navItem('dashboard', 'Dashboard', DashboardIcon, () => onNavigate('dashboard'))}
                {navItem('students', 'Student Database', SchoolIcon, () => onNavigate('students'))}
                {navItem('commitments', 'Commitments', AssignmentIcon, () => onNavigate('commitments'))}
                {navItem('analytics', 'Analytics', DashboardIcon, () => onNavigate('analytics'))}
                {navItem('ai', 'AI Analysis', AutoAwesomeIcon, () => onNavigate('ai'))}
                {navItem('new-admission', 'New Admission', PersonAddIcon, onNewAdmission)}
                {navItem('hourly', 'Hourly Tracker', AccessTimeIcon, () => navigate('/hourly-tracker'))}
            </List>

            <Divider sx={{ borderColor: 'rgba(44, 62, 80, 0.1)' }} />

            <Box sx={{ p: 2 }}>
                <Box
                    sx={{
                        mb: 2,
                        p: 3,
                        minHeight: '120px',
                        backgroundColor: 'rgba(160, 210, 235, 0.3)',
                        borderRadius: 2,
                        borderLeft: '4px solid #A0D2EB',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, width: '100%' }}>
                        <QuoteIcon sx={{ fontSize: 20, color: '#2C3E50', opacity: 0.7, mt: 0.5, flexShrink: 0 }} />
                        <Typography
                            sx={{
                                color: '#2C3E50',
                                fontSize: '0.9rem',
                                lineHeight: 1.5,
                                fontStyle: 'italic',
                                fontWeight: 700,
                            }}
                        >
                            {MOTIVATIONAL_QUOTES[quoteIdx]}
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mb: 2,
                    }}
                >
                    <Typography variant="caption" sx={{ opacity: 0.8, color: '#2C3E50' }}>
                        Notifications
                    </Typography>
                    <NotificationBell iconColor="#2C3E50" />
                </Box>

                <ListItemButton
                    onClick={onLogout}
                    sx={{
                        borderRadius: 2,
                        '&:hover': { backgroundColor: 'rgba(160, 210, 235, 0.3)' },
                        px: 2,
                        py: 1.5,
                    }}
                >
                    <ListItemIcon sx={{ color: '#2C3E50', minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText
                        primary="Logout"
                        primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: 500 }}
                    />
                </ListItemButton>
            </Box>
        </Drawer>
    );
};

export default SkillhubSidebar;
