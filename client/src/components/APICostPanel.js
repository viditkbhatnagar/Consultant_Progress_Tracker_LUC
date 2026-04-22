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
    ChatBubbleOutline as ChatIcon,
    AutoAwesome as AnalysisIcon,
    Groups as TeamIcon,
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

// Small stat card — used in summary strip.
const StatCard = ({ title, value, subtitle, icon: Icon, accent = 'accent' }) => {
    const colorVar =
        accent === 'warm'
            ? 'var(--d-warm, #D97706)'
            : accent === 'success'
                ? 'var(--d-success, #16A34A)'
                : 'var(--d-accent, #2383E2)';
    return (
        <Surface sx={{ flex: '1 1 220px', minWidth: 220 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <Icon sx={{ color: colorVar, fontSize: 20 }} />
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
};

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
    '& tbody tr:hover': { backgroundColor: 'var(--d-surface-hover, #EFEDE8)' },
};

const numSx = { fontVariantNumeric: 'tabular-nums' };
const fmtCost = (n) => `$${(n || 0).toFixed(6)}`;
const fmtTokens = (n) => (n || 0).toLocaleString();

const TypeChip = ({ type }) => {
    const chat = type === 'chat';
    return (
        <Chip
            icon={chat ? <ChatIcon sx={{ fontSize: 14 }} /> : <AnalysisIcon sx={{ fontSize: 14 }} />}
            label={chat ? 'Chatbot' : 'Analysis'}
            size="small"
            sx={{
                fontWeight: 600,
                fontSize: 11,
                height: 22,
                backgroundColor: chat
                    ? 'var(--d-warm-bg, rgba(217,119,6,0.08))'
                    : 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                color: chat
                    ? 'var(--d-warm-text, #B45309)'
                    : 'var(--d-accent-text, #1F6FBF)',
                '& .MuiChip-icon': {
                    color: chat ? 'var(--d-warm, #D97706)' : 'var(--d-accent, #2383E2)',
                    ml: '6px',
                },
            }}
        />
    );
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
                if (response.success) setData(response.data);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load usage data.');
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map((i) => (
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

    const { summary, byTeam = [], byUser = [], daily = [], recentCalls = [] } = data;

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

            {/* Summary strip — now 4 cards: Analysis, Chatbot, Tokens, Total */}
            <motion.div variants={stagger} initial="hidden" animate="show">
                <Box sx={{ display: 'flex', gap: 2.5, mb: 3, flexWrap: 'wrap' }}>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard
                            title="AI Analysis"
                            value={summary.analysis.calls}
                            subtitle={`${fmtTokens(summary.analysis.tokens)} tokens · ${fmtCost(summary.analysis.cost)}`}
                            icon={AnalysisIcon}
                            accent="accent"
                        />
                    </motion.div>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard
                            title="Chatbot"
                            value={summary.chat.calls}
                            subtitle={`${fmtTokens(summary.chat.tokens)} tokens · ${fmtCost(summary.chat.cost)}`}
                            icon={ChatIcon}
                            accent="warm"
                        />
                    </motion.div>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard
                            title="Total Tokens"
                            value={fmtTokens(summary.totalTokens)}
                            subtitle="Across all AI features"
                            icon={TokenIcon}
                        />
                    </motion.div>
                    <motion.div variants={item} style={{ flex: '1 1 220px', minWidth: 220, display: 'flex' }}>
                        <StatCard
                            title="Total Cost"
                            value={fmtCost(summary.totalCost)}
                            subtitle="GPT-4o-mini · $0.15/$0.60 per 1M"
                            icon={MoneyIcon}
                            accent="success"
                        />
                    </motion.div>
                </Box>
            </motion.div>

            {/* Usage by Team — shows which team is spending on what feature */}
            {byTeam.length > 0 && (
                <Surface sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <TeamIcon sx={{ color: 'var(--d-accent, #2383E2)', fontSize: 20 }} />
                        <Typography
                            sx={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: 'var(--d-text, #191918)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Usage by Team
                        </Typography>
                    </Box>
                    <TableContainer>
                        <Table size="small" sx={tableSx}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Team</TableCell>
                                    <TableCell>Organization</TableCell>
                                    <TableCell align="right">Analysis queries</TableCell>
                                    <TableCell align="right">Analysis cost</TableCell>
                                    <TableCell align="right">Chatbot queries</TableCell>
                                    <TableCell align="right">Chatbot cost</TableCell>
                                    <TableCell align="right">Total cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {byTeam.map((t) => (
                                    <TableRow key={`${t.team}-${t.organization}`}>
                                        <TableCell sx={{ fontWeight: 600 }}>{t.team}</TableCell>
                                        <TableCell>
                                            {t.organization ? (
                                                <Chip
                                                    label={t.organization}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 600,
                                                        fontSize: 10.5,
                                                        height: 20,
                                                        backgroundColor: 'var(--d-surface-muted)',
                                                        color: 'var(--d-text-3)',
                                                    }}
                                                />
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={numSx}>{t.analysisCalls}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtCost(t.analysisCost)}</TableCell>
                                        <TableCell align="right" sx={numSx}>{t.chatCalls}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtCost(t.chatCost)}</TableCell>
                                        <TableCell align="right" sx={{ ...numSx, fontWeight: 600 }}>
                                            {fmtCost(t.totalCost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {/* By user */}
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
                                    <TableCell>Team</TableCell>
                                    <TableCell align="right">Analysis queries</TableCell>
                                    <TableCell align="right">Chatbot queries</TableCell>
                                    <TableCell align="right">Tokens</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {byUser.map((u) => (
                                    <TableRow key={u.name}>
                                        <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={
                                                    u.role === 'admin'
                                                        ? 'Admin'
                                                        : u.role === 'team_lead'
                                                            ? 'Team Lead'
                                                            : u.role === 'skillhub'
                                                                ? 'Skillhub'
                                                                : u.role === 'manager'
                                                                    ? 'Manager'
                                                                    : u.role}
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
                                        <TableCell>{u.team || '—'}</TableCell>
                                        <TableCell align="right" sx={numSx}>{u.analysisCalls || 0}</TableCell>
                                        <TableCell align="right" sx={numSx}>{u.chatCalls || 0}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtTokens(u.tokens)}</TableCell>
                                        <TableCell align="right" sx={{ ...numSx, fontWeight: 600 }}>
                                            {fmtCost(u.cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {/* Daily — now split by type */}
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
                                    <TableCell align="right">Analysis queries</TableCell>
                                    <TableCell align="right">Chatbot queries</TableCell>
                                    <TableCell align="right">Tokens</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {daily.map((d) => (
                                    <TableRow key={d.date}>
                                        <TableCell>{d.date}</TableCell>
                                        <TableCell align="right" sx={numSx}>{d.analysisCalls || 0}</TableCell>
                                        <TableCell align="right" sx={numSx}>{d.chatCalls || 0}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtTokens(d.tokens)}</TableCell>
                                        <TableCell align="right" sx={{ ...numSx, fontWeight: 600 }}>
                                            {fmtCost(d.cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Surface>
            )}

            {/* Recent calls */}
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
                                    <TableCell>Type</TableCell>
                                    <TableCell>User</TableCell>
                                    <TableCell>Team</TableCell>
                                    <TableCell align="right">Prompt</TableCell>
                                    <TableCell align="right">Completion</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                    <TableCell align="right">Cost</TableCell>
                                    <TableCell>Window</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {recentCalls.map((call, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {new Date(call.createdAt).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <TypeChip type={call.type} />
                                        </TableCell>
                                        <TableCell>{call.user}</TableCell>
                                        <TableCell>{call.team || '—'}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtTokens(call.promptTokens)}</TableCell>
                                        <TableCell align="right" sx={numSx}>{fmtTokens(call.completionTokens)}</TableCell>
                                        <TableCell align="right" sx={{ ...numSx, fontWeight: 600 }}>
                                            {fmtTokens(call.totalTokens)}
                                        </TableCell>
                                        <TableCell align="right" sx={{ ...numSx, fontWeight: 600 }}>
                                            {fmtCost(call.cost)}
                                        </TableCell>
                                        <TableCell sx={{ color: 'var(--d-text-muted, #8A887E)', fontSize: 12 }}>
                                            {call.dateRange?.startDate
                                                ? `${call.dateRange.startDate} → ${call.dateRange.endDate}`
                                                : '—'}
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
                        No AI calls yet. Generate an AI analysis or ask the chatbot a question to see usage here.
                    </Typography>
                </Surface>
            )}
        </Box>
    );
};

export default APICostPanel;
