import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// App-wide full-screen ("focus") mode. When on, the sidebars hide and the
// main content fills the screen; we also request the browser Fullscreen API
// for a truly immersive view. State is kept in sync with the Fullscreen API so
// pressing Esc (or F11) restores the sidebar automatically.
const FullscreenContext = createContext({
    isFullscreen: false,
    toggle: () => {},
    enter: () => {},
    exit: () => {},
});

export const useFullscreen = () => useContext(FullscreenContext);

export const FullscreenProvider = ({ children }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const enter = useCallback(() => {
        setIsFullscreen(true);
        // Best-effort — if the browser blocks it, focus mode (sidebar hidden)
        // still works.
        document.documentElement.requestFullscreen?.().catch(() => {});
    }, []);

    const exit = useCallback(() => {
        setIsFullscreen(false);
        if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
    }, []);

    const toggle = useCallback(() => {
        if (isFullscreen || document.fullscreenElement) exit();
        else enter();
    }, [isFullscreen, enter, exit]);

    // Sync state when the user leaves full screen via Esc / F11 / browser UI.
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) setIsFullscreen(false);
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    return (
        <FullscreenContext.Provider value={{ isFullscreen, toggle, enter, exit }}>
            {children}
        </FullscreenContext.Provider>
    );
};

export default FullscreenContext;
