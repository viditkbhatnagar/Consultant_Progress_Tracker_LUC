import React from 'react';
import { Box } from '@mui/material';

// gpt-image-2 now renders the full poster — title, tier amounts, taglines and
// motivational slogans are baked into the image — so we just present it cleanly
// in a rounded frame. Shared by the board, the TL modal and the page.
export default function TierImageView({ data }) {
    if (!data || !data.image) return null;
    return (
        <Box
            sx={{
                width: '100%',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: 4,
                aspectRatio: '1536 / 1024',
                bgcolor: '#0b1020',
            }}
        >
            <Box
                component="img"
                src={data.image}
                alt="Month-end tier standings"
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
        </Box>
    );
}
