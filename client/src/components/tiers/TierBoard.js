import React, { useState, useCallback } from 'react';
import { Box, Button } from '@mui/material';
import { EditOutlined as EditIcon } from '@mui/icons-material';
import TierEditDialog from './TierEditDialog';
import TierDataPanel from './TierDataPanel';

// Tier Fight tab. The poster image-generation UI is intentionally hidden for
// both admins and team leads — this tab now shows the tier standings (tables)
// followed by visual breakdowns. Admins keep a small "Edit tiers" control to
// manage tier membership (that's data management, not image generation).
export default function TierBoard({ isAdmin = false, mode = 'light' }) {
    const [editOpen, setEditOpen] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

    return (
        <Box>
            {isAdmin ? (
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setEditOpen(true)}
                        sx={{ textTransform: 'none' }}
                    >
                        Edit tiers
                    </Button>
                </Box>
            ) : null}

            {/* Tier standings: per-tier tables first, then visual breakdowns */}
            <TierDataPanel version={dataVersion} mode={mode} />

            {isAdmin ? (
                <TierEditDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={bumpData} />
            ) : null}
        </Box>
    );
}
