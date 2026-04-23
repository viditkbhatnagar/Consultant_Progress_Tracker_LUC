import React, { useState } from 'react';
import { Box } from '@mui/material';
import { ChatBubbleOutline as ChatIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import { useAuth } from '../../context/AuthContext';

// Floating "Ask me" launcher. Only shown while the chat drawer is
// CLOSED — the drawer has its own close button in the header, so a
// floating close FAB would be redundant. Hidden on /login and for any
// unauthenticated view.
const FloatingChatLauncher = () => {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) return null;
    if (/^\/login/.test(location.pathname)) return null;

    return (
        <>
            {!open && (
                <Box
                    sx={{
                        position: 'fixed',
                        right: { xs: 16, sm: 24 },
                        bottom: { xs: 16, sm: 24 },
                        zIndex: (theme) => theme.zIndex.drawer + 2,
                    }}
                >
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
                </Box>
            )}
            <ChatPanel open={open} onClose={() => setOpen(false)} />
        </>
    );
};

export default FloatingChatLauncher;
