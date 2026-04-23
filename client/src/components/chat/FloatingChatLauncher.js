import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';
import { useAuth } from '../../context/AuthContext';

// Hosts the chat drawer and listens for the `askme:open` window event
// dispatched by the sidebar "Ask me" items. The floating pill launcher
// was removed — sidebar entries are the only way in now.
const FloatingChatLauncher = () => {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        const handler = () => setOpen(true);
        window.addEventListener('askme:open', handler);
        return () => window.removeEventListener('askme:open', handler);
    }, []);

    if (!isAuthenticated) return null;
    if (/^\/login/.test(location.pathname)) return null;

    return <ChatPanel open={open} onClose={() => setOpen(false)} />;
};

export default FloatingChatLauncher;
