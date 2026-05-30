import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Button, Snackbar, Alert, IconButton } from '@mui/material';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '../context/AuthContext';
import { onSocketEvents, onSocketConnect } from '../services/socket';
import announcementService from '../services/announcementService';
import { DRAWER_WIDTH } from './Sidebar';

// App-wide announcement banner — mounted once at the App root so it shows on
// every authenticated page (not buried in the bell). Guarantees visibility:
//   - fetches active announcements on load + on socket (re)connect, so users
//     who were offline when one fired still see it,
//   - listens for the live `announcement` socket event for an instant toast,
//   - the top banner stays pinned until the user clicks "Got it" (per-user ack),
//     so it can't scroll away or vanish after one render.
export default function AnnouncementBanner() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [toast, setToast] = useState(null);
    const bannerRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const res = await announcementService.getActiveAnnouncements();
            setItems(Array.isArray(res?.data) ? res.data : []);
        } catch {
            /* best-effort — the banner never blocks the app */
        }
    }, []);

    useEffect(() => {
        if (!user) {
            setItems([]);
            setToast(null);
            return undefined;
        }
        load();
        const offConnect = onSocketConnect(load);
        const offEvents = onSocketEvents(['announcement'], (payload) => {
            if (!payload || !payload._id) return;
            setItems((prev) =>
                prev.some((p) => String(p._id) === String(payload._id)) ? prev : [payload, ...prev]
            );
            setToast(payload);
        });
        // Safety-net poll: re-fetch every 30s so the banner self-appears even
        // if the live socket event is missed — nobody has to refresh the page.
        const interval = setInterval(load, 30000);
        return () => {
            offConnect();
            offEvents();
            clearInterval(interval);
        };
    }, [user, load]);

    const dismiss = useCallback(async (id) => {
        setItems((prev) => prev.filter((p) => String(p._id) !== String(id)));
        try {
            await announcementService.acknowledgeAnnouncement(id);
        } catch {
            /* ignore — already removed locally */
        }
    }, []);

    // Push the page down by the live banner height so it never covers the page
    // header / nav. Cleared when there's nothing active or on unmount.
    useEffect(() => {
        const h = items.length && bannerRef.current ? bannerRef.current.offsetHeight : 0;
        document.body.style.paddingTop = h ? `${h}px` : '';
        return () => {
            document.body.style.paddingTop = '';
        };
    }, [items]);

    const toastEl = (
        <Snackbar
            open={!!toast}
            autoHideDuration={6000}
            onClose={() => setToast(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ mt: items.length ? 6 : 0 }}
        >
            <Alert
                severity="success"
                icon={<CampaignRoundedIcon />}
                onClose={() => setToast(null)}
                variant="filled"
                sx={{ fontWeight: 600, boxShadow: 4 }}
            >
                {toast?.title} — {toast?.message}
            </Alert>
        </Snackbar>
    );

    if (!user || items.length === 0) return toastEl;

    const top = items[0];
    const more = items.length - 1;

    return (
        <>
            <Box
                ref={bannerRef}
                role="status"
                aria-live="polite"
                sx={{
                    position: 'fixed',
                    top: 0,
                    // Start to the right of the permanent 280px sidebar so its
                    // higher-z-index drawer can't clip the banner's left edge,
                    // and the sidebar logo stays fully visible.
                    left: `${DRAWER_WIDTH}px`,
                    right: 0,
                    zIndex: (t) => t.zIndex.drawer + 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: { xs: 1.5, md: 3 },
                    py: 1,
                    background: 'linear-gradient(90deg, #1F7A35, #2E9E4B)',
                    color: '#fff',
                    boxShadow: '0 2px 14px rgba(0,0,0,0.20)',
                }}
            >
                <CampaignRoundedIcon fontSize="small" />
                <Typography component="span" sx={{ fontWeight: 800, mr: 0.5, whiteSpace: 'nowrap' }}>
                    {top.title}
                </Typography>
                <Typography
                    component="span"
                    sx={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                    {top.message}
                </Typography>
                {more > 0 && (
                    <Typography component="span" sx={{ fontWeight: 700, opacity: 0.9, whiteSpace: 'nowrap' }}>
                        +{more} more
                    </Typography>
                )}
                <Button
                    size="small"
                    onClick={() => dismiss(top._id)}
                    sx={{
                        color: '#1F7A35',
                        bgcolor: '#fff',
                        fontWeight: 700,
                        flexShrink: 0,
                        '&:hover': { bgcolor: '#eef7f0' },
                    }}
                >
                    Got it
                </Button>
                <IconButton
                    size="small"
                    aria-label="Dismiss announcement"
                    onClick={() => dismiss(top._id)}
                    sx={{ color: '#fff', flexShrink: 0, ml: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
                >
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
            </Box>
            {toastEl}
        </>
    );
}
