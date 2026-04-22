import React from 'react';
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Button,
} from '@mui/material';
import {
    AutoAwesome as SparkleIcon,
    Close as CloseIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';

// Small markdown renderer for the constrained shape the prompt returns.
const renderMarkdown = (text = '') => {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match.replace(/\n/g, '')}</ul>`);
    html = html.replace(/^\d+\. (.*)$/gm, '<li>$1</li>');
    html = html.replace(/\n{2,}/g, '<br/><br/>');
    html = html.replace(/\n/g, ' ');
    return html;
};

const CommitmentsAIAnalysisDialog = ({ open, onClose, loading, analysis, onRefresh, error }) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '14px',
                    boxShadow: '0 12px 40px rgba(15,23,42,0.18)',
                    overflow: 'hidden',
                    maxWidth: 640,
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--t-border)',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                        sx={{
                            width: 30,
                            height: 30,
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                            color: 'var(--t-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <SparkleIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 650, color: 'var(--t-text)' }}>
                            Commitment Tracker AI analysis
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: 'var(--t-text-muted)', mt: 0.2 }}>
                            Summary of the current filter window
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={onRefresh}
                        disabled={loading}
                        sx={{ color: 'var(--t-text-3)' }}
                        aria-label="Refresh"
                    >
                        <RefreshIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" onClick={onClose} sx={{ color: 'var(--t-text-3)' }} aria-label="Close">
                        <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            </Box>

            <DialogContent sx={{ padding: '18px 20px', backgroundColor: 'var(--t-surface)' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 1.5 }}>
                        <CircularProgress size={28} sx={{ color: '#6366F1' }} />
                        <Typography sx={{ fontSize: 12.5, color: 'var(--t-text-muted)' }}>Crunching the numbers…</Typography>
                    </Box>
                ) : error ? (
                    <Box sx={{ py: 4 }}>
                        <Typography sx={{ fontSize: 13, color: 'var(--t-danger-text)', mb: 2 }}>{error}</Typography>
                        <Button onClick={onRefresh} variant="outlined" size="small" sx={{ textTransform: 'none' }}>
                            Try again
                        </Button>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            fontSize: 13,
                            color: 'var(--t-text-2)',
                            lineHeight: 1.7,
                            '& h2': {
                                fontSize: 15,
                                fontWeight: 650,
                                color: 'var(--t-text)',
                                mt: 2,
                                mb: 1,
                                pb: 0.5,
                                borderBottom: '2px solid var(--t-border)',
                            },
                            '& h2:first-of-type': { mt: 0 },
                            '& h3': { fontSize: 13.5, fontWeight: 600, color: 'var(--t-text)', mt: 1.5, mb: 0.5 },
                            '& strong': { color: 'var(--t-text)' },
                            '& ul': { pl: 2.5, my: 0.5 },
                            '& li': { mb: 0.5 },
                        }}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(analysis) }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CommitmentsAIAnalysisDialog;
