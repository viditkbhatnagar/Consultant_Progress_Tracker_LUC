import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
    ChatBubbleOutline as ChatIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import { useAuth } from '../../context/AuthContext';

// Floating "Ask me" launcher. Extended pill-style button with a chat
// bubble icon; collapses to a simple close icon while the panel is open.
// Mounted once at the app root — hidden on /login and for any
// unauthenticated view.
const FloatingChatLauncher = () => {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) return null;
    if (/^\/login/.test(location.pathname)) return null;

    return (
        <>
            <Box
                sx={{
                    position: 'fixed',
                    right: { xs: 16, sm: 24 },
                    bottom: { xs: 16, sm: 24 },
                    zIndex: (theme) => theme.zIndex.drawer + 2,
                }}
            >
                {open ? (
                    <Tooltip title="Close assistant" placement="left">
                        <IconButton
                            aria-label="Close assistant"
                            onClick={() => setOpen(false)}
                            sx={{
                                width: 48,
                                height: 48,
                                backgroundColor: 'var(--d-surface, #FFFFFF)',
                                color: 'var(--d-text-2, #2A2927)',
                                border: '1px solid var(--d-border, #E6E3DC)',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                                transition:
                                    'background-color var(--d-dur-sm, 180ms) var(--d-ease-enter, ease)',
                                '&:hover': {
                                    backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                ) : (
                    <Box
                        component="button"
                        type="button"
                        aria-label="Ask me"
                        onClick={() => setOpen(true)}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            border: 0,
                            cursor: 'pointer',
                            paddingLeft: '16px',
                            paddingRight: '20px',
                            height: 48,
                            borderRadius: '999px',
                            backgroundColor: 'var(--d-accent, #2383E2)',
                            color: '#FFFFFF',
                            fontSize: 14,
                            fontWeight: 600,
                            letterSpacing: '-0.005em',
                            boxShadow:
                                '0 10px 30px rgba(35, 131, 226, 0.35), 0 2px 8px rgba(0,0,0,0.10)',
                            transition:
                                'transform var(--d-dur-sm, 180ms) var(--d-ease-enter, ease), background-color var(--d-dur-sm, 180ms) var(--d-ease-enter, ease), box-shadow var(--d-dur-sm, 180ms) var(--d-ease-enter, ease)',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                backgroundColor: 'var(--d-accent-text, #1F6FBF)',
                                boxShadow:
                                    '0 14px 36px rgba(35, 131, 226, 0.42), 0 4px 12px rgba(0,0,0,0.12)',
                            },
                            '&:focus-visible': {
                                outline: '2px solid var(--d-accent, #2383E2)',
                                outlineOffset: 3,
                            },
                        }}
                    >
                        <ChatIcon sx={{ fontSize: 20 }} />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            Ask me
                        </Box>
                    </Box>
                )}
            </Box>
            <ChatPanel open={open} onClose={() => setOpen(false)} />
        </>
    );
};

export default FloatingChatLauncher;
