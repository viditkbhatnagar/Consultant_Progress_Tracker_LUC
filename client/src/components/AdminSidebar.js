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
    Divider,
    Collapse,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Logout as LogoutIcon,
    FormatQuote as QuoteIcon,
    School as SchoolIcon,
    AutoAwesome as AutoAwesomeIcon,
    AttachMoney as MoneyIcon,
    Payments as PaymentPlanIcon,
    AccessTime as AccessTimeIcon,
    VideoCall as VideoCallIcon,
    FactCheck as CommitmentsIcon,
    ChatBubbleOutline as AskMeIcon,
    SaveAlt as ExportCenterIcon,
    Link as LinkIcon,
    InsightsOutlined as ExecutiveIcon,
    Groups as TeamIcon,
    Flag as TargetIcon,
    ExpandLess,
    ExpandMore,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { setAdminOrgScope } from '../utils/adminOrgScope';
import { getTeams } from '../services/execOverviewService';
import { useFullscreen } from '../context/FullscreenContext';

export const DRAWER_WIDTH = 280;

// Motivational Quotes
const MOTIVATIONAL_QUOTES = [
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The only way to do great work is to love what you do.",
    "Believe you can and you're halfway there.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "Don't watch the clock; do what it does. Keep going.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Success doesn't just find you. You have to go out and get it.",
    "Dream it. Wish it. Do it.",
    "Great things never come from comfort zones.",
    "Success is the sum of small efforts repeated day in and day out.",
    "Push yourself, because no one else is going to do it for you.",
    "The key to success is to focus on goals, not obstacles.",
    "Dream bigger. Do bigger.",
    "Wake up with determination. Go to bed with satisfaction.",
    "Do something today that your future self will thank you for.",
    "Little things make big days.",
    "It's going to be hard, but hard does not mean impossible.",
    "Don't stop when you're tired. Stop when you're done.",
    "Work hard in silence, let your success be the noise.",
    "The only impossible journey is the one you never begin.",
    "Opportunities don't happen, you create them.",
    "Your limitation—it's only your imagination.",
    "Sometimes later becomes never. Do it now.",
    "The expert in anything was once a beginner.",
    "If you're not willing to risk, you cannot grow.",
    "Success is what comes after you stop making excuses.",
    "Make each day your masterpiece.",
    "The difference between ordinary and extraordinary is that little extra.",
];

const AdminSidebar = ({ onLogout, onAIAnalysis, onDashboard, aiAnalysisActive, onAPICosts, apiCostsActive }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isFullscreen } = useFullscreen();
    const user = JSON.parse(localStorage.getItem('user'));
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
    const [execOpen, setExecOpen] = useState(
        location.pathname.startsWith('/team-dashboard') ||
        location.pathname.startsWith('/leadership-dashboard') ||
        location.pathname.startsWith('/consultant-performance') ||
        location.pathname.startsWith('/monthly-targets') ||
        location.pathname.startsWith('/tiers') ||
        location.pathname.startsWith('/payment-plans')
    );
    const [teams, setTeams] = useState([]);

    // Load the LUC team list once on mount so the "All Teams" entry can
    // jump straight to a team and the dropdown can list them. Falls back
    // silently on error (the endpoint is cheap — one find on User).
    useEffect(() => {
        getTeams()
            .then((res) => setTeams(res.data || []))
            .catch(() => {});
    }, []);

    // Personalize quote with user name for admin
    const getPersonalizedQuote = (quote) => {
        // Use "Bhanu" for display even if database has "Admin"
        const displayName = user?.name === 'Admin' ? 'Bhanu' : (user?.name?.split(' ')[0] || 'Leader');
        
        // Add personalization for admin
        const personalizations = [
            `${quote} ${displayName}, lead with excellence!`,
            `${displayName}, ${quote.toLowerCase()}`,
            `${quote} - You're making a difference, ${displayName}!`,
            `${displayName}: ${quote}`,
            `${quote} Keep inspiring, ${displayName}!`,
        ];
        
        // Randomly pick a personalization style
        const style = currentQuoteIndex % personalizations.length;
        return personalizations[style];
    };

    // Rotate quotes every 10 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % MOTIVATIONAL_QUOTES.length);
        }, 10000); // 10 seconds

        return () => clearInterval(interval);
    }, []);

    // Shared style blocks so nav + bottom items stay in visual lockstep.
    // All colors resolve against the dashboard token root when mounted
    // inside DashboardShell; fall back to sensible hex otherwise.
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

    // Full-screen focus mode hides the sidebar so main content fills the page.
    if (isFullscreen) return null;

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
            {/* Logo Section */}
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
                    src="/LUC-new-logo-svg-1.svg"
                    alt="LUC Logo"
                    style={{
                        width: '100%',
                        maxWidth: '180px',
                        height: 'auto',
                        marginBottom: '1rem',
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
                    Team Progress Tracker
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
                        }}
                    >
                        Administrator
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'transparent' }} />

            {/* Navigation */}
            <List sx={{ flex: 1, px: 1.25, py: 1.5 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                        onClick={onDashboard}
                        selected={!aiAnalysisActive && !apiCostsActive}
                        sx={navItemSx}
                    >
                        <ListItemIcon><DashboardIcon /></ListItemIcon>
                        <ListItemText primary="Dashboard" />
                    </ListItemButton>
                </ListItem>

                {/* Executive Overview — expandable parent grouping the three
                    sales views. "All Teams" is a single page where the admin
                    picks the team from an in-header dropdown (no per-team
                    sidebar items). */}
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => setExecOpen((v) => !v)} sx={navItemSx}>
                        <ListItemIcon><ExecutiveIcon /></ListItemIcon>
                        <ListItemText primary="Executive Overview" />
                        {execOpen ? <ExpandLess /> : <ExpandMore />}
                    </ListItemButton>
                </ListItem>
                <Collapse in={execOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding sx={{ pl: 1 }}>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate('/leadership-dashboard')}
                                selected={location.pathname === '/leadership-dashboard'}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><ExecutiveIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="Leadership Dashboard" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate(teams.length ? `/team-dashboard/${teams[0]._id}` : '/team-dashboard')}
                                selected={location.pathname.startsWith('/team-dashboard')}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><TeamIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="All Teams" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate('/consultant-performance')}
                                selected={location.pathname === '/consultant-performance'}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><TargetIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="Consultant Performance" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate('/monthly-targets')}
                                selected={location.pathname === '/monthly-targets'}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><MoneyIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="Monthly Targets" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate('/tiers')}
                                selected={location.pathname === '/tiers'}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><TargetIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="Tier Fight" />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate('/payment-plans')}
                                selected={location.pathname === '/payment-plans'}
                                sx={{ ...navItemSx, pl: 3 }}
                            >
                                <ListItemIcon><PaymentPlanIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                                <ListItemText primary="Payment Plans" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Collapse>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={onAIAnalysis} selected={aiAnalysisActive} sx={navItemSx}>
                        <ListItemIcon><AutoAwesomeIcon /></ListItemIcon>
                        <ListItemText primary="AI Analysis" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                        onClick={() => window.dispatchEvent(new CustomEvent('askme:open'))}
                        sx={navItemSx}
                    >
                        <ListItemIcon><AskMeIcon /></ListItemIcon>
                        <ListItemText primary="Ask me" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={onAPICosts} selected={apiCostsActive} sx={navItemSx}>
                        <ListItemIcon><MoneyIcon /></ListItemIcon>
                        <ListItemText primary="AI Usage" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/student-database')} sx={navItemSx}>
                        <ListItemIcon><SchoolIcon /></ListItemIcon>
                        <ListItemText primary="Student Database" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                        onClick={() => {
                            setAdminOrgScope('luc');
                            navigate('/hourly-tracker');
                        }}
                        sx={navItemSx}
                    >
                        <ListItemIcon><AccessTimeIcon /></ListItemIcon>
                        <ListItemText primary="Hourly Tracker" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/commitments')} sx={navItemSx}>
                        <ListItemIcon><CommitmentsIcon /></ListItemIcon>
                        <ListItemText primary="Commitments" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/meetings')} sx={navItemSx}>
                        <ListItemIcon><VideoCallIcon /></ListItemIcon>
                        <ListItemText primary="Meetings" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/exports')} sx={navItemSx}>
                        <ListItemIcon><ExportCenterIcon /></ListItemIcon>
                        <ListItemText primary="Export Center" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/admin/reconciliation')} sx={navItemSx}>
                        <ListItemIcon><LinkIcon /></ListItemIcon>
                        <ListItemText primary="Reconciliation" />
                    </ListItemButton>
                </ListItem>
            </List>

            {/* Bottom Actions */}
            <Box sx={{ p: 2, borderTop: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                {/* Motivational Quote */}
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
                        {getPersonalizedQuote(MOTIVATIONAL_QUOTES[currentQuoteIndex])}
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

export default AdminSidebar;
