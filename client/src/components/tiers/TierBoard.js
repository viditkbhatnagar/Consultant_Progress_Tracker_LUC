import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, CircularProgress, Snackbar, Alert,
    FormControl, InputLabel, Select, MenuItem, TextField, Chip,
} from '@mui/material';
import {
    AutoAwesome as GenerateIcon,
    EmojiEvents as TrophyIcon,
    EditOutlined as EditIcon,
    CloudUploadOutlined as UploadIcon,
} from '@mui/icons-material';
import tierService from '../../services/tierService';
import { onSocketEvents } from '../../services/socket';
import TierEditDialog from './TierEditDialog';
import TierImageView from './TierImageView';
import TierDataPanel from './TierDataPanel';
import TierHistory from './TierHistory';

export default function TierBoard({ isAdmin = false, mode = 'light' }) {
    const [latest, setLatest] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

    // Admin generation controls.
    const [themes, setThemes] = useState([]);
    const [themeKey, setThemeKey] = useState('');
    const [thoughts, setThoughts] = useState('');
    const [imageFile, setImageFile] = useState(null);

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
        const off = onSocketEvents(['tier-image'], () => { load(); bumpData(); setToast(true); });
        return off;
    }, [load, bumpData]);

    // Scene list for the admin dropdown (kept in sync with the server's THEMES).
    useEffect(() => {
        if (!isAdmin) return;
        tierService.getTiers().then((res) => setThemes(res.data?.themes || [])).catch(() => {});
    }, [isAdmin]);

    const generate = async () => {
        setGenerating(true);
        setError('');
        try {
            const res = await tierService.generateImage({ theme: themeKey, thoughts: thoughts.trim(), image: imageFile });
            setLatest(res.data);
            bumpData();
        } catch (e) {
            setError(e.response?.data?.message || 'Generation failed — check the OpenAI key.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <Box>
            {isAdmin ? (
                <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 210 }}>
                            <InputLabel>Scene</InputLabel>
                            <Select value={themeKey} label="Scene" onChange={(e) => setThemeKey(e.target.value)}>
                                <MenuItem value=""><em>Random — surprise me</em></MenuItem>
                                {themes.map((t) => (
                                    <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button component="label" variant="outlined" startIcon={<UploadIcon />} sx={{ textTransform: 'none' }}>
                            {imageFile ? 'Change image' : 'Upload image (optional)'}
                            <input hidden type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                        </Button>
                        {imageFile ? (
                            <Chip
                                label={imageFile.name.length > 22 ? `${imageFile.name.slice(0, 22)}…` : imageFile.name}
                                onDelete={() => setImageFile(null)}
                                size="small"
                            />
                        ) : null}
                    </Box>
                    <TextField
                        size="small"
                        label="Your thoughts (optional — added onto the poster)"
                        value={thoughts}
                        onChange={(e) => setThoughts(e.target.value)}
                        inputProps={{ maxLength: 240 }}
                        fullWidth
                    />
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button variant="contained" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <GenerateIcon />} onClick={generate} disabled={generating}>
                            {generating ? 'Generating…' : 'Generate Tier Fight'}
                        </Button>
                        <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
                            Edit tiers
                        </Button>
                        {generating ? <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>OpenAI is drawing the scene (~1 min)…</Typography> : null}
                        {error ? <Typography sx={{ fontSize: 13, color: 'var(--d-danger, #C0392B)' }}>{error}</Typography> : null}
                    </Box>
                </Box>
            ) : null}

            {latest ? (
                <TierImageView data={latest} />
            ) : (
                <Box sx={{ py: 6, textAlign: 'center', color: 'var(--d-text-muted, #8A887E)', border: '1px dashed var(--d-border, #ddd)', borderRadius: '14px' }}>
                    <Typography>{isAdmin ? 'No poster yet — pick a scene (or leave it random) and click “Generate Tier Fight”.' : 'No tier standings posted yet.'}</Typography>
                </Box>
            )}

            {/* Raw tier data behind the poster: 3-line trend + per-tier tables */}
            <TierDataPanel version={dataVersion} mode={mode} />

            {/* Date-wise archive of every generated poster (from S3) */}
            <TierHistory version={dataVersion} />

            <Snackbar open={toast} autoHideDuration={6000} onClose={() => setToast(false)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="info" variant="filled" icon={<TrophyIcon />} onClose={() => setToast(false)} sx={{ fontWeight: 600 }}>
                    🥊 New tier standings just posted!
                </Alert>
            </Snackbar>

            <TierEditDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={() => { load(); bumpData(); }} />
        </Box>
    );
}
