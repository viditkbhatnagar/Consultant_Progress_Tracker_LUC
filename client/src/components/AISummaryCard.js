import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Alert,
    Skeleton,
} from '@mui/material';
import {
    AutoAwesome as AutoAwesomeIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import DateRangeSelector from './DateRangeSelector';
import aiService from '../services/aiService';

// Parse AI markdown into sections (split on ## headings)
const parseSections = (text) => {
    if (!text) return [];
    const sections = [];
    let currentSection = null;

    text.split('\n').forEach((line) => {
        if (line.startsWith('## ')) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: line.replace('## ', ''), lines: [] };
        } else if (line.startsWith('# ') && !line.startsWith('## ')) {
            // Skip top-level headings (sometimes GPT adds one)
        } else if (currentSection) {
            currentSection.lines.push(line);
        } else {
            // Content before any heading — put in an intro section
            if (!sections.length && !currentSection) {
                currentSection = { title: '', lines: [line] };
            }
        }
    });
    if (currentSection) sections.push(currentSection);
    return sections;
};

// Render lines within a section card
const renderLines = (lines) => {
    let key = 0;
    return lines.map((line) => {
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.replace(/^[-*]\s/, '');
            return (
                <Box key={key++} sx={{ display: 'flex', gap: 1, ml: 0.5, mb: 0.4 }}>
                    <Typography sx={{ color: '#5c6bc0', fontWeight: 700, flexShrink: 0, lineHeight: 1.7 }}>
                        &bull;
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: '#34495E', lineHeight: 1.7 }}
                        dangerouslySetInnerHTML={{
                            __html: content
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                        }}
                    />
                </Box>
            );
        } else if (line.trim() === '') {
            return <Box key={key++} sx={{ height: 6 }} />;
        } else {
            return (
                <Typography
                    key={key++}
                    variant="body2"
                    sx={{ color: '#34495E', lineHeight: 1.7, mb: 0.3 }}
                    dangerouslySetInnerHTML={{
                        __html: line
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                    }}
                />
            );
        }
    });
};

const AISummaryCard = () => {
    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });
    const [analysis, setAnalysis] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedAt, setGeneratedAt] = useState(null);

    // Track whether we've triggered initial load
    const initialLoad = useRef(false);

    const fetchAnalysis = useCallback(async (start, end) => {
        if (!start || !end) return;
        setLoading(true);
        setError('');

        try {
            const response = await aiService.generateAnalysis(start, end);
            if (response.success) {
                setAnalysis(response.analysis);
                setGeneratedAt(new Date());
            } else {
                setError(response.message || 'Failed to generate analysis.');
            }
        } catch (err) {
            const message =
                err.response?.data?.message ||
                'Failed to generate AI analysis. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-generate on mount
    useEffect(() => {
        if (!initialLoad.current) {
            initialLoad.current = true;
            fetchAnalysis(dateRange.startDate, dateRange.endDate);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-regenerate when date range changes (after initial load)
    const handleDateRangeChange = useCallback((newRange) => {
        setDateRange(newRange);
        fetchAnalysis(newRange.startDate, newRange.endDate);
    }, [fetchAnalysis]);

    const sections = parseSections(analysis);

    return (
        <Box>
            {/* Header row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AutoAwesomeIcon sx={{ color: '#5c6bc0', fontSize: 28 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#2C3E50' }}>
                        AI Analysis
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {generatedAt && (
                        <Typography variant="caption" sx={{ color: '#7f8c8d' }}>
                            Generated {format(generatedAt, 'h:mm a')}
                        </Typography>
                    )}
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => fetchAnalysis(dateRange.startDate, dateRange.endDate)}
                        disabled={loading}
                        sx={{
                            color: '#5c6bc0',
                            borderColor: '#5c6bc0',
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: 2,
                            '&:hover': {
                                borderColor: '#3f51b5',
                                backgroundColor: 'rgba(92, 107, 192, 0.08)',
                            },
                        }}
                    >
                        Regenerate
                    </Button>
                </Box>
            </Box>

            {/* Date Range Selector */}
            <Card elevation={0} sx={{ mb: 3, backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                <CardContent>
                    <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                </CardContent>
            </Card>

            {/* Error state */}
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => fetchAnalysis(dateRange.startDate, dateRange.endDate)}
                        >
                            Retry
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* Loading state — skeleton section cards */}
            {loading && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Box key={i} sx={{ flex: '1 1 calc(50% - 12px)', minWidth: 300 }}>
                            <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1.5 }} />
                                    <Skeleton variant="text" width="90%" height={18} />
                                    <Skeleton variant="text" width="75%" height={18} />
                                    <Skeleton variant="text" width="85%" height={18} />
                                    <Skeleton variant="text" width="50%" height={18} sx={{ mt: 1 }} />
                                </CardContent>
                            </Card>
                        </Box>
                    ))}
                </Box>
            )}

            {/* Analysis — rendered as section cards */}
            {!loading && sections.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {sections.map((section, idx) => (
                        <Box key={idx} sx={{ flex: '1 1 calc(50% - 12px)', minWidth: 300 }}>
                            <Card
                                elevation={0}
                                sx={{
                                    height: '100%',
                                    backgroundColor: '#E5EAF5',
                                    borderRadius: 3,
                                    boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                                }}
                            >
                                <CardContent sx={{ p: 3 }}>
                                    {section.title && (
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontWeight: 700,
                                                color: '#2C3E50',
                                                mb: 1.5,
                                                pb: 1,
                                                borderBottom: '2px solid #c5cae9',
                                            }}
                                        >
                                            {section.title}
                                        </Typography>
                                    )}
                                    {renderLines(section.lines)}
                                </CardContent>
                            </Card>
                        </Box>
                    ))}
                </Box>
            )}

            {/* No data state */}
            {!loading && !error && analysis && sections.length === 0 && (
                <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ color: '#7f8c8d' }}>{analysis}</Typography>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default AISummaryCard;
