import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import { AutoAwesome as GenerateIcon, EmojiEvents as TrophyIcon } from '@mui/icons-material';
import tierService from '../../services/tierService';
import { onSocketEvents } from '../../services/socket';

const TIER_STYLES = {
    1: { color: '#1F7A35', label: 'TIER 1' },
    2: { color: '#2383E2', label: 'TIER 2' },
    3: { color: '#C99700', label: 'TIER 3' },
};
const fmt = (n) => Number(n || 0).toLocaleString();

// Renders the AI scene with the exact tier labels + amounts overlaid as real
// text (always crisp/correct). Used on the TL tab + the admin section.
function TierImageView({ data }) {
    const tiers = [...(data.tiers || [])].sort((a, b) => a.tier - b.tier);
    const lead = tiers.reduce((m, t) => (t.mtdAchieved > (m?.mtdAchieved || -1) ? t : m), null);
    return (
        <Box sx={{ position: 'relative', width: '100%', borderRadius: '14px', overflow: 'hidden', boxShadow: 4, aspectRatio: '1792 / 1024', bgcolor: '#0b1020' }}>
            <Box component="img" src={data.image} alt="Tier standings" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)' }} />
            <Box sx={{ position: 'absolute', top: '4%', left: 0, right: 0, textAlign: 'center', px: 2 }}>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, sm: 30, md: 40 }, color: '#fff', textShadow: '0 3px 10px rgba(0,0,0,0.7)', letterSpacing: '0.02em', lineHeight: 1 }}>
                    {(data.headline || 'MONTH-END RACE IS ON!').toUpperCase()}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: 10, sm: 14 }, color: '#FFD54A', textShadow: '0 2px 6px rgba(0,0,0,0.7)', mt: 0.5 }}>
                    {data.monthName ? `${data.monthName} — ` : ''}every admission counts
                </Typography>
            </Box>
            <Box sx={{ position: 'absolute', bottom: '5%', left: '3%', right: '3%', display: 'flex', gap: { xs: 1, sm: 2 }, justifyContent: 'center' }}>
                {tiers.map((t) => {
                    const st = TIER_STYLES[t.tier] || TIER_STYLES[1];
                    const isLead = lead && t.tier === lead.tier;
                    return (
                        <Box key={t.tier} sx={{
                            flex: 1, maxWidth: 300, bgcolor: 'rgba(255,255,255,0.95)', borderRadius: '12px',
                            border: `3px solid ${st.color}`, px: { xs: 1, sm: 2 }, py: { xs: 0.75, sm: 1.5 }, textAlign: 'center',
                            boxShadow: isLead ? `0 0 0 3px ${st.color}55, 0 8px 20px rgba(0,0,0,0.35)` : '0 6px 16px rgba(0,0,0,0.3)',
                            transform: isLead ? 'translateY(-6px)' : 'none', transition: 'transform .2s',
                        }}>
                            <Typography sx={{ fontWeight: 900, fontSize: { xs: 12, sm: 17 }, color: st.color, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                {isLead ? <TrophyIcon sx={{ fontSize: { xs: 13, sm: 18 } }} /> : null}{st.label}
                            </Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, sm: 26 }, color: st.color, lineHeight: 1.15 }}>{fmt(t.mtdAchieved)}</Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

export default function TierBoard({ isAdmin = false }) {
    const [latest, setLatest] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await tierService.getLatestImage();
            setLatest(res.data || null);
        } catch {
            /* best-effort */
        }
    }, []);

    useEffect(() => {
        load();
        const off = onSocketEvents(['tier-image'], () => { load(); setToast(true); });
        return off;
    }, [load]);

    const generate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await tierService.generateImage();
            setLatest(res.data);
        } catch (e) {
            setError(e.response?.data?.message || 'Generation failed — check the OpenAI key.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Box>
            {isAdmin ? (
                <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button variant="contained" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <GenerateIcon />} onClick={generate} disabled={generating}>
                        {generating ? 'Generating…' : 'Generate Tier Image'}
                    </Button>
                    {generating ? <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>OpenAI is drawing the scene (~15s)…</Typography> : null}
                    {error ? <Typography sx={{ fontSize: 13, color: 'var(--d-danger, #C0392B)' }}>{error}</Typography> : null}
                </Box>
            ) : null}

            {latest ? (
                <TierImageView data={latest} />
            ) : (
                <Box sx={{ py: 6, textAlign: 'center', color: 'var(--d-text-muted, #8A887E)', border: '1px dashed var(--d-border, #ddd)', borderRadius: '14px' }}>
                    <Typography>{isAdmin ? 'No tier image yet — click “Generate Tier Image”.' : 'No tier standings posted yet.'}</Typography>
                </Box>
            )}

            <Snackbar open={toast} autoHideDuration={6000} onClose={() => setToast(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="info" variant="filled" icon={<TrophyIcon />} onClose={() => setToast(false)} sx={{ fontWeight: 600 }}>
                    🏁 New tier standings just posted!
                </Alert>
            </Snackbar>
        </Box>
    );
}
