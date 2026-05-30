import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Dialog, IconButton, CircularProgress } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import tierService from '../../services/tierService';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Date-grouped archive of every generated poster (newest day first), served via
// short-lived presigned S3 URLs. Click a thumbnail to view full size. Refreshes
// when `version` changes (a new poster was generated).
export default function TierHistory({ version = 0 }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState(null);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        tierService
            .getImageHistory()
            .then((res) => { if (alive) setItems(Array.isArray(res.data) ? res.data : []); })
            .catch(() => { /* best-effort */ })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [version]);

    // Group by calendar date. `items` arrive newest-first, so Map insertion
    // order keeps the groups (and the cards within them) newest-first too.
    const groups = useMemo(() => {
        const map = new Map();
        for (const it of items) {
            const key = new Date(it.createdAt).toISOString().slice(0, 10);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(it);
        }
        return [...map.entries()];
    }, [items]);

    if (loading && items.length === 0) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={20} /></Box>;
    if (items.length === 0) return null;

    return (
        <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--d-text, #191918)', mb: 1.5 }}>
                Past standings — by date
            </Typography>
            {groups.map(([date, list]) => (
                <Box key={date} sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--d-text-muted, #8A887E)', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1 }}>
                        {fmtDate(list[0].createdAt)} · {list.length} {list.length === 1 ? 'image' : 'images'}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
                        {list.map((it) => (
                            <Box
                                key={it._id}
                                onClick={() => it.url && setActive(it)}
                                sx={{
                                    cursor: it.url ? 'pointer' : 'default', borderRadius: '12px', overflow: 'hidden',
                                    border: '1px solid var(--d-border-soft, #ECE9E2)', bgcolor: '#0b1020',
                                    aspectRatio: '1536 / 1024', position: 'relative', transition: 'transform .15s, box-shadow .15s',
                                    '&:hover': it.url ? { transform: 'translateY(-2px)', boxShadow: 4 } : {},
                                }}
                            >
                                {it.url ? <Box component="img" src={it.url} alt="Tier standings" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 1, py: 0.5, background: 'linear-gradient(0deg, rgba(0,0,0,0.65), transparent)', color: '#fff' }}>
                                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {fmtTime(it.createdAt)}{it.theme ? ` · ${it.theme}` : ''}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            ))}
            <Dialog open={!!active} onClose={() => setActive(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '14px', overflow: 'hidden', bgcolor: '#0b1020' } }}>
                <IconButton onClick={() => setActive(null)} aria-label="Close" sx={{ position: 'absolute', right: 8, top: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' }, zIndex: 1 }}>
                    <CloseIcon />
                </IconButton>
                {active?.url ? <Box component="img" src={active.url} alt="Tier standings" sx={{ width: '100%', display: 'block' }} /> : null}
            </Dialog>
        </Box>
    );
}
