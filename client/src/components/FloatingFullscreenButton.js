import React from 'react';
import { Tooltip, Fab } from '@mui/material';
import { Fullscreen as FullscreenIcon, FullscreenExit as FullscreenExitIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFullscreen } from '../context/FullscreenContext';

// A small fixed button (stacked above the chat launcher) that toggles
// full-screen focus mode on every authenticated page. Stays visible in
// full screen so the user can always exit.
export default function FloatingFullscreenButton() {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const { isFullscreen, toggle } = useFullscreen();

    if (!isAuthenticated) return null;
    if (/^\/login/.test(location.pathname)) return null;

    return (
        <Tooltip title={isFullscreen ? 'Exit full screen' : 'Full screen'} placement="left">
            <Fab
                size="small"
                onClick={toggle}
                aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                sx={{
                    position: 'fixed',
                    bottom: 96,
                    right: 24,
                    zIndex: (t) => t.zIndex.drawer + 2,
                    bgcolor: 'var(--d-surface, #ffffff)',
                    color: 'var(--d-text-2, #333333)',
                    border: '1px solid var(--d-border, rgba(0,0,0,0.12))',
                    boxShadow: 3,
                    '&:hover': { bgcolor: 'var(--d-surface-hover, #f3f3f3)' },
                }}
            >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </Fab>
        </Tooltip>
    );
}
