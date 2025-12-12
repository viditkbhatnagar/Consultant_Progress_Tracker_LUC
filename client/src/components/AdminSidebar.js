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
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Download as DownloadIcon,
    Logout as LogoutIcon,
    Notifications as NotificationsIcon,
    FormatQuote as QuoteIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
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

const AdminSidebar = ({ onExport, onLogout }) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

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
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        textAlign: 'center',
                        fontSize: '0.95rem',
                        opacity: 0.95,
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
                    background: 'rgba(44, 62, 80, 0.05)',
                }}
            >
                <Avatar
                    sx={{
                        bgcolor: '#A0D2EB',
                        color: '#2C3E50',
                        width: 40,
                        height: 40,
                        fontSize: '1rem',
                    }}
                >
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
                    <Typography
                        variant="caption"
                        sx={{
                            opacity: 0.8,
                            fontSize: '0.75rem',
                        }}
                    >
                        Admin
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(44, 62, 80, 0.1)' }} />

            {/* Navigation */}
            <List sx={{ flex: 1, px: 1.5, py: 2 }}>
                <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                        sx={{
                            borderRadius: 2,
                            '&:hover': {
                                backgroundColor: 'rgba(160, 210, 235, 0.3)',
                            },
                            '&.Mui-selected': {
                                backgroundColor: '#A0D2EB',
                            },
                        }}
                        selected
                    >
                        <ListItemIcon sx={{ color: '#2C3E50', minWidth: 40 }}>
                            <DashboardIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Dashboard"
                            primaryTypographyProps={{
                                fontSize: '0.95rem',
                                fontWeight: 500,
                            }}
                        />
                    </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                        onClick={(e) => onExport(e.currentTarget)}
                        sx={{
                            borderRadius: 2,
                            '&:hover': {
                                backgroundColor: 'rgba(160, 210, 235, 0.3)',
                            },
                        }}
                    >
                        <ListItemIcon sx={{ color: '#2C3E50', minWidth: 40 }}>
                            <DownloadIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Export Data"
                            primaryTypographyProps={{
                                fontSize: '0.95rem',
                                fontWeight: 500,
                            }}
                        />
                    </ListItemButton>
                </ListItem>
            </List>

            <Divider sx={{ borderColor: 'rgba(44, 62, 80, 0.1)' }} />

            {/* Bottom Actions */}
            <Box sx={{ p: 2 }}>
                {/* Motivational Quote */}
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
                            {getPersonalizedQuote(MOTIVATIONAL_QUOTES[currentQuoteIndex])}
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
                        '&:hover': {
                            backgroundColor: 'rgba(160, 210, 235, 0.3)',
                        },
                        px: 2,
                        py: 1.5,
                    }}
                >
                    <ListItemIcon sx={{ color: '#2C3E50', minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText
                        primary="Logout"
                        primaryTypographyProps={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                        }}
                    />
                </ListItemButton>
            </Box>
        </Drawer>
    );
};

export default AdminSidebar;
