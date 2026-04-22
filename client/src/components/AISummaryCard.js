import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, Button, Alert, Skeleton } from '@mui/material';
import {
    AutoAwesome as AutoAwesomeIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import DateRangeSelector from './DateRangeSelector';
import aiService from '../services/aiService';
import {
    gridStagger,
    riseItemVariants,
    useReducedMotionVariants,
} from '../utils/dashboardMotion';

const parseSections = (text) => {
    if (!text) return [];
    const sections = [];
    let currentSection = null;
    text.split('\n').forEach((line) => {
        if (line.startsWith('## ')) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: line.replace('## ', ''), lines: [] };
        } else if (line.startsWith('# ') && !line.startsWith('## ')) {
            // skip
        } else if (currentSection) {
            currentSection.lines.push(line);
        } else {
            if (!sections.length && !currentSection) {
                currentSection = { title: '', lines: [line] };
            }
        }
    });
    if (currentSection) sections.push(currentSection);
    return sections;
};

const renderLines = (lines) => {
    let key = 0;
    return lines.map((line) => {
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.replace(/^[-*]\s/, '');
            return (
                <Box key={key++} sx={{ display: 'flex', gap: 1, ml: 0.5, mb: 0.5 }}>
                    <Typography
                        sx={{
                            color: 'var(--d-accent, #2383E2)',
                            fontWeight: 700,
                            flexShrink: 0,
                            lineHeight: 1.7,
                        }}
                    >
                        &bull;
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'var(--d-text-2, #2A2927)', lineHeight: 1.7 }}
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
        }
        return (
            <Typography
                key={key++}
                variant="body2"
                sx={{ color: 'var(--d-text-2, #2A2927)', lineHeight: 1.7, mb: 0.3 }}
                dangerouslySetInnerHTML={{
                    __html: line
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                }}
            />
        );
    });
};

const SectionSurface = ({ children, padding = 20, sx = {} }) => (
    <Box
        sx={{
            backgroundColor: 'var(--d-surface, #FFFFFF)',
            border: '1px solid var(--d-border, #E6E3DC)',
            borderRadius: '14px',
            boxShadow: 'var(--d-shadow-card-sm)',
            p: `${padding}px`,
            ...sx,
        }}
    >
        {children}
    </Box>
);

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
    const initialLoad = useRef(false);

    const stagger = useReducedMotionVariants(gridStagger);
    const item = useReducedMotionVariants(riseItemVariants);

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
            setError(err.response?.data?.message || 'Failed to generate AI analysis. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!initialLoad.current) {
            initialLoad.current = true;
            fetchAnalysis(dateRange.startDate, dateRange.endDate);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDateRangeChange = useCallback(
        (newRange) => {
            setDateRange(newRange);
            fetchAnalysis(newRange.startDate, newRange.endDate);
        },
        [fetchAnalysis]
    );

    const sections = parseSections(analysis);

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 3,
                    flexWrap: 'wrap',
                    gap: 1.5,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <AutoAwesomeIcon sx={{ color: 'var(--d-accent, #2383E2)', fontSize: 26 }} />
                    <Typography
                        sx={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        AI Analysis
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {generatedAt && (
                        <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)' }}>
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
                            color: 'var(--d-accent, #2383E2)',
                            borderColor: 'var(--d-border, #E6E3DC)',
                            textTransform: 'none',
                            fontWeight: 600,
                            borderRadius: '10px',
                            backgroundColor: 'var(--d-surface, #FFFFFF)',
                            transition:
                                'background-color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                            '@media (hover: hover) and (pointer: fine)': {
                                '&:hover': {
                                    backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                                    borderColor: 'var(--d-accent, #2383E2)',
                                },
                            },
                        }}
                    >
                        Regenerate
                    </Button>
                </Box>
            </Box>

            <SectionSurface padding={16} sx={{ mb: 3 }}>
                <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
            </SectionSurface>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: '10px' }}
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

            {loading && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Box key={i} sx={{ flex: '1 1 calc(50% - 10px)', minWidth: 300 }}>
                            <SectionSurface>
                                <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1.5 }} />
                                <Skeleton variant="text" width="90%" height={16} />
                                <Skeleton variant="text" width="75%" height={16} />
                                <Skeleton variant="text" width="85%" height={16} />
                            </SectionSurface>
                        </Box>
                    ))}
                </Box>
            )}

            {!loading && sections.length > 0 && (
                <motion.div variants={stagger} initial="hidden" animate="show">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5 }}>
                        {sections.map((section, idx) => (
                            <motion.div
                                key={idx}
                                variants={item}
                                style={{ flex: '1 1 calc(50% - 10px)', minWidth: 300, display: 'flex' }}
                            >
                                <SectionSurface sx={{ flex: 1 }}>
                                    {section.title && (
                                        <Typography
                                            sx={{
                                                fontSize: 15,
                                                fontWeight: 700,
                                                color: 'var(--d-text, #191918)',
                                                letterSpacing: '-0.01em',
                                                mb: 1.25,
                                                pb: 1,
                                                borderBottom: '1px solid var(--d-border-soft, #ECE9E2)',
                                            }}
                                        >
                                            {section.title}
                                        </Typography>
                                    )}
                                    {renderLines(section.lines)}
                                </SectionSurface>
                            </motion.div>
                        ))}
                    </Box>
                </motion.div>
            )}

            {!loading && !error && analysis && sections.length === 0 && (
                <SectionSurface sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: 'var(--d-text-muted, #8A887E)' }}>{analysis}</Typography>
                </SectionSurface>
            )}
        </Box>
    );
};

export default AISummaryCard;
