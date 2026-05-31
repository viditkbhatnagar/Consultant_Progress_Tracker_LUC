import React, { useState, useEffect } from 'react';
import { Dialog, Box, Typography, Button, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { onSocketEvents } from '../../services/socket';
import tierService from '../../services/tierService';
import TierImageView from './TierImageView';

// Pops a celebratory modal (banner) whenever the admin generates a new tier
// image — shown to non-admin users (team leads) on whatever page they're on.
// The admin already sees the result inline on their dashboard, so they're
// excluded to avoid a redundant popup over their own action.
export default function TierAnnounceModal() {
    const { user, isAuthenticated } = useAuth();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (!isAuthenticated || user?.role === 'admin') return undefined;
        const off = onSocketEvents(['tier-image'], async () => {
            try {
                const res = await tierService.getLatestImage();
                if (res.data && res.data.image) {
                    setData(res.data);
                    setOpen(true);
                }
            } catch {
                /* ignore */
            }
        });
        return off;
    }, [isAuthenticated, user?.role]);

    if (!isAuthenticated || user?.role === 'admin' || /^\/login/.test(location.pathname)) return null;

    return (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '18px', overflow: 'hidden' } }}>
            <Box sx={{ bgcolor: '#C0392B', color: '#fff', textAlign: 'center', py: 1.75, position: 'relative' }}>
                <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: '0.02em' }}>🥊 Tier Fight Update!</Typography>
                <IconButton onClick={() => setOpen(false)} aria-label="Close" sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
                <Typography sx={{ fontWeight: 700, mb: 1.5, textAlign: 'center', color: 'var(--d-text-2, #333)' }}>
                    Fresh tier standings just dropped — every admission counts!
                </Typography>
                <TierImageView data={data} />
                <Button fullWidth variant="contained" onClick={() => setOpen(false)} sx={{ mt: 2, py: 1.25, bgcolor: '#1F3A5F', fontWeight: 700, fontSize: 15, '&:hover': { bgcolor: '#16304f' } }}>
                    Let’s finish strong! 🚀
                </Button>
            </Box>
        </Dialog>
    );
}
