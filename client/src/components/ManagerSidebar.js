import React from 'react';
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
    School as SchoolIcon,
    Logout as LogoutIcon,
    ChatBubbleOutline as AskMeIcon,
    SaveAlt as ExportCenterIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

export const DRAWER_WIDTH = 280;

// Manager has no dashboard route — they're routed to /student-database
// after login. This sidebar surfaces only the surfaces a manager has
// access to (Student Database + Export Center + Ask me) so the role
// stops looking like a stripped-down team-lead.
const ManagerSidebar = ({ onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || 'null');

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
                    {user?.name?.charAt(0) || 'M'}
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
                        {user?.name || 'Manager'}
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
                        Manager
                    </Typography>
                </Box>
            </Box>

            {/* Navigation */}
            <List sx={{ flex: 1, px: 1.25, py: 1.5 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                        onClick={() => navigate('/student-database')}
                        selected={location.pathname === '/student-database'}
                        sx={navItemSx}
                    >
                        <ListItemIcon><SchoolIcon /></ListItemIcon>
                        <ListItemText primary="Student Database" />
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
                    <ListItemButton
                        onClick={() => navigate('/exports')}
                        selected={location.pathname === '/exports'}
                        sx={navItemSx}
                    >
                        <ListItemIcon><ExportCenterIcon /></ListItemIcon>
                        <ListItemText primary="Export Center" />
                    </ListItemButton>
                </ListItem>
            </List>

            {/* Bottom */}
            <Box sx={{ p: 2, borderTop: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                <ListItemButton onClick={onLogout} sx={{ ...navItemSx, px: 1.5, py: 1 }}>
                    <ListItemIcon><LogoutIcon /></ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItemButton>
            </Box>
        </Drawer>
    );
};

export default ManagerSidebar;
