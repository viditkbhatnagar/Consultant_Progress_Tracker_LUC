import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Autocomplete, TextField, Box, Typography } from '@mui/material';
import tierService from '../../services/tierService';
import consultantService from '../../services/consultantService';

// Admin dialog to edit which consultants belong to each tier.
export default function TierEditDialog({ open, onClose, onSaved }) {
    const [all, setAll] = useState([]);
    const [tiers, setTiers] = useState({ 1: [], 2: [], 3: [] });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const [cRes, tRes] = await Promise.all([
                    consultantService.getConsultants({ organization: 'luc' }),
                    tierService.getTiers(),
                ]);
                setAll((cRes.data || []).map((c) => ({ _id: c._id, name: c.name })));
                const map = { 1: [], 2: [], 3: [] };
                for (const t of tRes.data?.tiers || []) {
                    map[t.tier] = (t.members || []).map((m) => ({ _id: m._id, name: m.name }));
                }
                setTiers(map);
            } catch {
                /* ignore */
            }
        })();
    }, [open]);

    const save = async () => {
        setSaving(true);
        try {
            for (const tier of [1, 2, 3]) {
                await tierService.updateTier(tier, tiers[tier].map((m) => m._id));
            }
            if (onSaved) onSaved();
            onClose();
        } catch {
            /* ignore */
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Edit tier members</DialogTitle>
            <DialogContent dividers>
                {[1, 2, 3].map((tier) => (
                    <Box key={tier} sx={{ mb: 2.5 }}>
                        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{`Tier ${tier}`}</Typography>
                        <Autocomplete
                            multiple
                            size="small"
                            options={all}
                            getOptionLabel={(o) => o.name || ''}
                            isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
                            value={tiers[tier]}
                            onChange={(e, v) => setTiers((p) => ({ ...p, [tier]: v }))}
                            renderInput={(params) => <TextField {...params} placeholder="Add consultants" />}
                        />
                    </Box>
                ))}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
}
