import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import { AutoAwesome as GenerateIcon, EmojiEvents as TrophyIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import tierService from '../../services/tierService';
import { onSocketEvents } from '../../services/socket';
import TierEditDialog from './TierEditDialog';
import TierImageView from './TierImageView';

export default function TierBoard({ isAdmin = false }) {
    const [latest, setLatest] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

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
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
                        Edit tiers
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

            <TierEditDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} />
        </Box>
    );
}
