import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    Skeleton,
    Chip,
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    Token as TokenIcon,
    Analytics as AnalyticsIcon,
    History as HistoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import aiService from '../services/aiService';
import {
    gridStagger,
    riseItemVariants,
    useReducedMotionVariants,
} from '../utils/dashboardMotion';

const Surface = ({ children, padding = 20, sx = {} }) => (
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

const StatCard = ({ title, value, subtitle, icon: Icon }) => (
    <Surface sx={{ flex: '1 1 220px', minWidth: 220 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Icon sx={{ color: 'var(--d-accent, #2383E2)', fontSize: 20 }} />
            <Typography
                sx={{
                    color: 'var(--d-text-muted, #8A887E)',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                }}
            >
                {title}
            </Typography>
        </Box>
        <Typography
            sx={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--d-text, #191918)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                mb: 0.5,
                lineHeight: 1.1,
            }}
        >
            {value}
        </Typography>
        {subtitle && (
            <Typography sx={{ color: 'var(--d-text-muted, #8A887E)', fontSize: 12 }}>
                {subtitle}
            </Typography>
        )}
    </Surface>
);

const tableSx = {
    '& .MuiTableCell-root': {
        borderColor: 'var(--d-border-soft, #ECE9E2)',
        color: 'var(--d-text-2, #2A2927)',
    },
    '& .MuiTableCell-head': {
        color: 'var(--d-text-muted, #8A887E)',
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    '& tbody tr': {
        transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
    },
    '& tbody tr:hover': {
        backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
    },
};

const APICostPanel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const stagger = useReducedMotionVariants(gridStagger);
    const item = useReducedMotionVariants(riseItemVariants);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const response = await aiService.getUsageStats();
                if (response.success) {
                    setData(response.data);
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load usage data.');
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    const formatCost = (cost) => `$${cost.toFixed(6)}`;
    const formatTokens = (tokens) => tokens.toLocaleString();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ flex: '1 1 220px', minWidth: 220 }}>
                        <Surface>
                            <Skeleton variant="text" width="60%" height={18} />
                            <Skeleton variant="text" width="40%" height={36} />
                            <Skeleton variant="text" width="50%" height={14} />
                        </Surface>
                    </Box>
                ))}
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>;
    }

    if (!data) return null;

    const { summary, byUser, daily, recentCalls } = data;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                <MoneyIcon sx={{ color: 'var(--d-accent, #2383E2)', fontSize: 26 }} />
                <Typography
                    sx={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: 'var(--d-text, #191918)',
                        letterSpacing: '-0.01em',
                    }}
                >
                    API Cost Tracker
                </Typography>
            </Box>

            <motion.div variants={stagger} initial="hidden" animate="show">
                <Box sx={{ display: 'flex', gap: 2.5, mb: 3, flexWrap: 'wrap' }}>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard title="Total API Calls" value={summary.totalCalls} subtitle="All-time usage" icon={AnalyticsIcon} />
                    </motion.div>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard title="Total Tokens" value={formatTokens(summary.totalTokens)} subtitle="Prompt + completion" icon={TokenIcon} />
                    </motion.div>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard title="Total Cost" value={formatCost(summary.totalCost)} subtitle="GPT-4o-mini pricing" icon={MoneyIcon} />
                    </motion.div>
                </Box>
            </motion.div>

            {byUser.length > 0 && (
                <Surface sx={{ mb: 3 }}>
                    <Typography
                        sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.01em',
                            mb: 1.5,
                        }}
                    >
                        Usage by User
                    </Typography>
                    <TableContainer>
                        <Table size="small" sx={tableSx}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>User</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell align="right">Calls</TableCell>
                                    <TableCell align="right">Tokens</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {byUser.map((u) => (
                                    <TableRow key={u.name}>
                                        <TableCell>{u.name}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={u.role === 'admin' ? 'Admin' : 'Team Lead'}
                                                size="small"
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    height: 22,
                                                    backgroundColor:
                                                        u.role === 'admin'
                                                            ? 'var(--d-warm-bg, rgba(217,119,6,0.08))'
                                                            : 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                                                    color:
                                                        u.role === 'admin'
                                                            ? 'var(--d-warm-text, #B45309)'
                                                            : 'var(--d-accent-text, #1F6FBF)',
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {u.calls}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTokens(u.tokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {formatCost(u.cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {daily.length > 0 && (
                <Surface sx={{ mb: 3 }}>
                    <Typography
                        sx={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.01em',
                            mb: 1.5,
                        }}
                    >
                        Daily Usage (last 30 days)
                    </Typography>
                    <TableContainer>
                        <Table size="small" sx={tableSx}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right">Calls</TableCell>
                                    <TableCell align="right">Tokens</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {daily.map((d) => (
                                    <TableRow key={d.date}>
                                        <TableCell>{d.date}</TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {d.calls}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTokens(d.tokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {formatCost(d.cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {recentCalls.length > 0 && (
                <Surface>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <HistoryIcon sx={{ color: 'var(--d-accent, #2383E2)', fontSize: 20 }} />
                        <Typography
                            sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: 'var(--d-text, #191918)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Recent API Calls
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small" sx={tableSx}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Time</TableCell>
                                    <TableCell>User</TableCell>
                                    <TableCell align="right">Prompt</TableCell>
                                    <TableCell align="right">Completion</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                    <TableCell>Date Range</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {recentCalls.map((call, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {new Date(call.createdAt).toLocaleString()}
                                        </TableCell>
                                        <TableCell>{call.user}</TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTokens(call.promptTokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTokens(call.completionTokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {formatTokens(call.totalTokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            {formatCost(call.cost)}
                                        </TableCell>
                                        <TableCell sx={{ color: 'var(--d-text-muted, #8A887E)', fontSize: 12 }}>
                                            {call.dateRange?.startDate} to {call.dateRange?.endDate}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {summary.totalCalls === 0 && (
                <Surface sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: 'var(--d-text-muted, #8A887E)' }}>
                        No API calls have been made yet. Generate an AI analysis to see usage data here.
                    </Typography>
                </Surface>
            )}
        </Box>
    );
};

export default APICostPanel;
