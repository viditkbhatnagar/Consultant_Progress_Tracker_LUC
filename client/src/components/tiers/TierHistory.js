import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Dialog, DialogContent, IconButton, Button, CircularProgress, Tooltip } from '@mui/material';
import {
    Close as CloseIcon,
    Download as DownloadIcon,
    FolderRounded as FolderIcon,
    DownloadingRounded as DownloadAllIcon,
} from '@mui/icons-material';
import tierService from '../../services/tierService';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const fileNameFor = (it) => `month-end-race-${new Date(it.createdAt).toISOString().slice(0, 10)}-${it.theme || 'tier'}.png`;

// Click an anchor to download. Presigned S3 URLs carry Content-Disposition so
// they download cross-origin without CORS; data-URL fallbacks use `download`.
function triggerDownload(url, filename) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// One folder card per date. Cover = the day's latest poster, with a folder
// badge + image count; click to open the folder.
function FolderCard({ folder, onOpen }) {
    const cover = folder.list.find((it) => it.url) || folder.list[0];
    return (
        <Box
            onClick={onOpen}
            sx={{
                borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
                border: '1px solid var(--d-border-soft, #ECE9E2)', bgcolor: 'var(--d-surface, #fff)',
                transition: 'transform .15s, box-shadow .15s',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
            }}
        >
            <Box sx={{ position: 'relative', aspectRatio: '1536 / 1024', bgcolor: '#0b1020' }}>
                {cover?.url ? <Box component="img" src={cover.url} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.92)' }} /> : null}
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)' }} />
                <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', px: 1, py: 0.25, borderRadius: '999px' }}>
                    <FolderIcon sx={{ fontSize: 16 }} />
                    <Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{folder.list.length}</Typography>
                </Box>
            </Box>
            <Box sx={{ px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'var(--d-text, #191918)' }}>{fmtDate(folder.list[0].createdAt)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-muted, #8A887E)' }}>{folder.list.length} {folder.list.length === 1 ? 'image' : 'images'} · click to open</Typography>
            </Box>
        </Box>
    );
}

// Date-grouped archive of every generated poster (newest day first) as FOLDERS.
// Open a folder to see its posters; download any single poster or the whole day.
export default function TierHistory({ version = 0 }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openFolder, setOpenFolder] = useState(null);
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

    // Group by calendar date (items arrive newest-first → folders newest-first).
    const folders = useMemo(() => {
        const map = new Map();
        for (const it of items) {
            const key = new Date(it.createdAt).toISOString().slice(0, 10);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(it);
        }
        return [...map.entries()].map(([date, list]) => ({ date, list }));
    }, [items]);

    if (loading && items.length === 0) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={20} /></Box>;
    if (items.length === 0) return null;

    const downloadAll = (list) => list.forEach((it, i) => setTimeout(() => triggerDownload(it.downloadUrl || it.url, fileNameFor(it)), i * 400));

    return (
        <Box sx={{ mt: 4 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'var(--d-text, #191918)', mb: 1.5 }}>
                Past standings — by date
            </Typography>

            {/* Folder grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(4,1fr)' }, gap: 2 }}>
                {folders.map((f) => <FolderCard key={f.date} folder={f} onOpen={() => setOpenFolder(f)} />)}
            </Box>

            {/* Open folder — its posters with download buttons */}
            <Dialog open={!!openFolder} onClose={() => setOpenFolder(null)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.75, borderBottom: '1px solid var(--d-border-soft, #ECE9E2)' }}>
                    <FolderIcon sx={{ color: 'var(--d-accent, #2383E2)' }} />
                    <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{openFolder ? fmtDate(openFolder.list[0].createdAt) : ''}</Typography>
                        <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)' }}>{openFolder ? `${openFolder.list.length} ${openFolder.list.length === 1 ? 'image' : 'images'}` : ''}</Typography>
                    </Box>
                    <Button size="small" variant="outlined" startIcon={<DownloadAllIcon />} onClick={() => openFolder && downloadAll(openFolder.list)}>
                        Download all
                    </Button>
                    <IconButton aria-label="Close" onClick={() => setOpenFolder(null)}><CloseIcon /></IconButton>
                </Box>
                <DialogContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)' }, gap: 2 }}>
                        {openFolder?.list.map((it) => (
                            <Box key={it._id} sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--d-border-soft, #ECE9E2)', bgcolor: '#0b1020', position: 'relative' }}>
                                <Box component="img" src={it.url} alt="" onClick={() => setActive(it)} sx={{ width: '100%', display: 'block', cursor: 'zoom-in', aspectRatio: '1536 / 1024', objectFit: 'cover' }} />
                                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, background: 'linear-gradient(0deg, rgba(0,0,0,0.7), transparent)' }}>
                                    <Typography sx={{ flex: 1, color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {fmtTime(it.createdAt)}{it.theme ? ` · ${it.theme}` : ''}
                                    </Typography>
                                    <Tooltip title="Download">
                                        <IconButton size="small" onClick={() => triggerDownload(it.downloadUrl || it.url, fileNameFor(it))} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.18)', '&:hover': { bgcolor: 'rgba(255,255,255,0.32)' } }}>
                                            <DownloadIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
            </Dialog>

            {/* Enlarged single poster */}
            <Dialog open={!!active} onClose={() => setActive(null)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '14px', overflow: 'hidden', bgcolor: '#0b1020' } }}>
                <IconButton aria-label="Close" onClick={() => setActive(null)} sx={{ position: 'absolute', right: 8, top: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' }, zIndex: 2 }}><CloseIcon /></IconButton>
                {active ? (
                    <Button onClick={() => triggerDownload(active.downloadUrl || active.url, fileNameFor(active))} startIcon={<DownloadIcon />} variant="contained" sx={{ position: 'absolute', left: 12, top: 12, zIndex: 2, bgcolor: '#1F3A5F', '&:hover': { bgcolor: '#16304f' } }}>
                        Download
                    </Button>
                ) : null}
                {active?.url ? <Box component="img" src={active.url} alt="" sx={{ width: '100%', display: 'block' }} /> : null}
            </Dialog>
        </Box>
    );
}
