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
    Download as DownloadIcon,
    Logout as LogoutIcon,
    FormatQuote as QuoteIcon,
    School as SchoolIcon,
    AutoAwesome as AutoAwesomeIcon,
    AccessTime as AccessTimeIcon,
    VideoCall as VideoCallIcon,
    FactCheck as CommitmentsIcon,
    ChatBubbleOutline as AskMeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';

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

const Sidebar = ({ onAddCommitment, onExport, onLogout, onAIAnalysis, onDashboard, aiAnalysisActive }) => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

    const getPersonalizedQuote = (quote) => {
        const teamName = user?.teamName || 'Champions';
        const personalizations = [
            `${quote} ${teamName}, you've got this!`,
            `${teamName}, ${quote.toLowerCase()}`,
            `${quote} - ${teamName} can do it!`,
            `${teamName}: ${quote}`,
            `${quote} Keep pushing, ${teamName}!`,
        ];
        const style = currentQuoteIndex % personalizations.length;
        return personalizations[style];
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
        }, 10000);
        return () => clearInterval(interval);
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
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {user?.teamName || 'Team Lead'}
                    </Typography>
                </Box>
            </Box>

            {/* Navigation */}
            <List sx={{ flex: 1, px: 1.25, py: 1.5 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={onDashboard} selected={!aiAnalysisActive} sx={navItemSx}>
                        <ListItemIcon><DashboardIcon /></ListItemIcon>
                        <ListItemText primary="Dashboard" />
                    </ListItemButton>
                </ListItem>

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
                    <ListItemButton onClick={() => navigate('/commitments')} sx={navItemSx}>
                        <ListItemIcon><CommitmentsIcon /></ListItemIcon>
                        <ListItemText primary="Commitments" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/student-database')} sx={navItemSx}>
                        <ListItemIcon><SchoolIcon /></ListItemIcon>
                        <ListItemText primary="Student Database" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/hourly-tracker')} sx={navItemSx}>
                        <ListItemIcon><AccessTimeIcon /></ListItemIcon>
                        <ListItemText primary="Hourly Tracker" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate('/meetings')} sx={navItemSx}>
                        <ListItemIcon><VideoCallIcon /></ListItemIcon>
                        <ListItemText primary="Meetings" />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={(e) => onExport(e.currentTarget)} sx={navItemSx}>
                        <ListItemIcon><DownloadIcon /></ListItemIcon>
                        <ListItemText primary="Export Data" />
                    </ListItemButton>
                </ListItem>
            </List>

            {/* Bottom */}
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

export default Sidebar;
