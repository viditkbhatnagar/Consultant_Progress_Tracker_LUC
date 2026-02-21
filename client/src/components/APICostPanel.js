import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
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
import aiService from '../services/aiService';

const StatCard = ({ title, value, subtitle, icon: Icon }) => (
    <Card
        elevation={0}
        sx={{
            flex: '1 1 200px',
            minWidth: 200,
            backgroundColor: '#E5EAF5',
            borderRadius: 3,
            boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
        }}
    >
        <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Icon sx={{ color: '#5c6bc0', fontSize: 22 }} />
                <Typography sx={{ color: '#7f8c8d', fontWeight: 500, fontSize: '0.85rem' }}>
                    {title}
                </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#2C3E50', mb: 0.5 }}>
                {value}
            </Typography>
            {subtitle && (
                <Typography sx={{ color: '#7f8c8d', fontSize: '0.8rem' }}>
                    {subtitle}
                </Typography>
            )}
        </CardContent>
    </Card>
);

const APICostPanel = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
            <Box>
                <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
                    {[1, 2, 3].map((i) => (
                        <Box key={i} sx={{ flex: '1 1 200px', minWidth: 200 }}>
                            <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Skeleton variant="text" width="60%" height={20} />
                                    <Skeleton variant="text" width="40%" height={40} />
                                    <Skeleton variant="text" width="50%" height={16} />
                                </CardContent>
                            </Card>
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>;
    }

    if (!data) return null;

    const { summary, byUser, daily, recentCalls } = data;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <MoneyIcon sx={{ color: '#5c6bc0', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2C3E50' }}>
                    API Cost Tracker
                </Typography>
            </Box>

            {/* Summary Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                <StatCard
                    title="Total API Calls"
                    value={summary.totalCalls}
                    subtitle="All-time usage"
                    icon={AnalyticsIcon}
                />
                <StatCard
                    title="Total Tokens Used"
                    value={formatTokens(summary.totalTokens)}
                    subtitle="Prompt + Completion"
                    icon={TokenIcon}
                />
                <StatCard
                    title="Total Cost"
                    value={formatCost(summary.totalCost)}
                    subtitle="GPT-4o-mini pricing"
                    icon={MoneyIcon}
                />
            </Box>

            {/* Usage by User */}
            {byUser.length > 0 && (
                <Card elevation={0} sx={{ mb: 4, backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C3E50', mb: 2 }}>
                            Usage by User
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>Role</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Calls</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Tokens</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Cost</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {byUser.map((u) => (
                                        <TableRow key={u.name}>
                                            <TableCell sx={{ color: '#34495E' }}>{u.name}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={u.role === 'admin' ? 'Admin' : 'Team Lead'}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: u.role === 'admin' ? '#5c6bc0' : '#A0D2EB',
                                                        color: u.role === 'admin' ? '#fff' : '#2C3E50',
                                                        fontWeight: 600,
                                                        fontSize: '0.75rem',
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{u.calls}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{formatTokens(u.tokens)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E', fontWeight: 600 }}>{formatCost(u.cost)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Daily Usage (last 30 days) */}
            {daily.length > 0 && (
                <Card elevation={0} sx={{ mb: 4, backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C3E50', mb: 2 }}>
                            Daily Usage (Last 30 Days)
                        </Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>Date</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Calls</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Tokens</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Cost</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {daily.map((d) => (
                                        <TableRow key={d.date}>
                                            <TableCell sx={{ color: '#34495E' }}>{d.date}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{d.calls}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{formatTokens(d.tokens)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E', fontWeight: 600 }}>{formatCost(d.cost)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {/* Recent Calls */}
            {recentCalls.length > 0 && (
                <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <HistoryIcon sx={{ color: '#5c6bc0', fontSize: 22 }} />
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2C3E50' }}>
                                Recent API Calls
                            </Typography>
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>Time</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>User</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Prompt</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Completion</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Total</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2C3E50' }}>Cost</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#2C3E50' }}>Date Range</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {recentCalls.map((call, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell sx={{ color: '#34495E', whiteSpace: 'nowrap' }}>
                                                {new Date(call.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell sx={{ color: '#34495E' }}>{call.user}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{formatTokens(call.promptTokens)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E' }}>{formatTokens(call.completionTokens)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E', fontWeight: 600 }}>{formatTokens(call.totalTokens)}</TableCell>
                                            <TableCell align="right" sx={{ color: '#34495E', fontWeight: 600 }}>{formatCost(call.cost)}</TableCell>
                                            <TableCell sx={{ color: '#7f8c8d', fontSize: '0.8rem' }}>
                                                {call.dateRange?.startDate} to {call.dateRange?.endDate}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            )}

            {summary.totalCalls === 0 && (
                <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3 }}>
                    <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#7f8c8d' }}>
                            No API calls have been made yet. Generate an AI analysis to see usage data here.
                        </Typography>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default APICostPanel;
