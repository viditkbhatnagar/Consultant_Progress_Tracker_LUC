import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Alert,
    AppBar,
    Box,
    CircularProgress,
    IconButton,
    Toolbar,
    Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, OpenInNew as OpenIcon } from '@mui/icons-material';
import { fetchPdfBlobUrl } from '../services/docsChatService';

// Authenticated PDF viewer for /program-docs/*. The file is fetched as a
// blob with the user's JWT header, wrapped in an object URL, and rendered
// in a full-viewport iframe with the native browser PDF viewer. Page
// navigation uses the PDF `#page=N` fragment, which every modern browser
// (Chrome/Edge/Safari/Firefox) honours.
const PdfViewer = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const rawUrl = params.get('url');
    const page = parseInt(params.get('page') || '1', 10) || 1;
    const title = params.get('title') || 'Program document';

    const [blobUrl, setBlobUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!rawUrl) {
            setError('No PDF URL supplied.');
            setLoading(false);
            return undefined;
        }
        let revoked = false;
        let currentUrl = '';
        (async () => {
            try {
                const u = await fetchPdfBlobUrl(rawUrl);
                if (revoked) {
                    URL.revokeObjectURL(u);
                    return;
                }
                currentUrl = u;
                setBlobUrl(u);
            } catch (err) {
                setError(err.message || 'Failed to load PDF.');
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            revoked = true;
            if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
    }, [rawUrl]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <AppBar position="static" color="default" elevation={0}>
                <Toolbar variant="dense">
                    <IconButton edge="start" onClick={() => navigate(-1)}>
                        <BackIcon />
                    </IconButton>
                    <Typography
                        variant="subtitle1"
                        sx={{ flex: 1, fontWeight: 600, ml: 1 }}
                    >
                        {title} · page {page}
                    </Typography>
                    {blobUrl && (
                        <IconButton
                            onClick={() => window.open(blobUrl + `#page=${page}`, '_blank')}
                            title="Open in new tab"
                        >
                            <OpenIcon />
                        </IconButton>
                    )}
                </Toolbar>
            </AppBar>
            <Box sx={{ flex: 1, position: 'relative', bgcolor: '#1f1f1f' }}>
                {loading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                        }}
                    >
                        <CircularProgress color="inherit" size={28} />
                    </Box>
                )}
                {error && (
                    <Box sx={{ p: 3 }}>
                        <Alert severity="error">{error}</Alert>
                    </Box>
                )}
                {!loading && !error && blobUrl && (
                    <iframe
                        title={title}
                        src={`${blobUrl}#page=${page}`}
                        style={{
                            border: 0,
                            width: '100%',
                            height: '100%',
                            background: '#fff',
                        }}
                    />
                )}
            </Box>
        </Box>
    );
};

export default PdfViewer;
