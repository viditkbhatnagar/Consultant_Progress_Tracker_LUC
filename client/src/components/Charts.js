import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { getLeadStageColor } from '../utils/constants';

// Lead Stage Distribution Chart
export const LeadStageChart = ({ commitments }) => {
    const stageCounts = commitments.reduce((acc, commitment) => {
        const stage = commitment.leadStage;
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
    }, {});

    const data = Object.entries(stageCounts).map(([name, value]) => ({
        name,
        value,
        color: getLeadStageColor(name),
    }));

    // Read the active dashboardTheme tokens so chart colors follow light/dark.
    // Fallback to literal hex when tokens aren't in scope (legacy callers).
    const readToken = (name, fallback) => {
        if (typeof window === 'undefined') return fallback;
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    };
    const accent = readToken('--d-accent', '#2383E2');
    const accentText = readToken('--d-accent-text', '#1F6FBF');
    const warm = readToken('--d-warm', '#D97706');
    const success = readToken('--d-success', '#16A34A');
    const text2 = readToken('--d-text-2', '#2A2927');
    const textMuted = readToken('--d-text-muted', '#8A887E');
    const surface = readToken('--d-surface', '#FFFFFF');
    const border = readToken('--d-border', '#E6E3DC');
    const palette = [accent, warm, success, accentText, textMuted];

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill={text2} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight={500}>
                {`${name} (${(percent * 100).toFixed(0)}%)`}
            </text>
        );
    };

    return (
        <Box
            sx={{
                height: '100%',
                backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                border: '1px solid var(--d-border-soft, #ECE9E2)',
                borderRadius: '12px',
                p: 2.5,
            }}
        >
            <Typography
                sx={{
                    fontSize: 13,
                    color: 'var(--d-text-muted, #8A887E)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    mb: 1.5,
                }}
            >
                Lead Stage Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={renderCustomizedLabel}
                        outerRadius={100}
                        innerRadius={55}
                        dataKey="value"
                        paddingAngle={2}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={palette[index % palette.length]}
                                stroke={surface}
                                strokeWidth={2}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: surface,
                            borderRadius: 8,
                            border: `1px solid ${border}`,
                            color: text2,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 1.5, justifyContent: 'center' }}>
                {data.map((entry, index) => (
                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: palette[index % palette.length] }} />
                        <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-3, #57564E)', fontVariantNumeric: 'tabular-nums' }}>
                            {entry.name}: {entry.value}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

// Achievement vs Target Chart
export const AchievementChart = ({ commitments }) => {
    const data = commitments.map((commitment, index) => ({
        name: commitment.studentName || `C${index + 1}`,
        target: 100,
        achieved: commitment.achievementPercentage || 0,
    }));

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Achievement vs Target
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="target" fill="#E0E0E0" name="Target (100%)" />
                        <Bar dataKey="achieved" fill="#4CAF50" name="Achieved %" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

// Weekly Trend Chart
export const WeeklyTrendChart = ({ weeklyData }) => {
    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Weekly Performance Trend
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="commitments"
                            stroke="#2196F3"
                            name="Commitments"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="achieved"
                            stroke="#4CAF50"
                            name="Achieved"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="meetings"
                            stroke="#FF9800"
                            name="Meetings"
                            strokeWidth={2}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

// Consultant Performance Comparison
export const ConsultantPerformanceChart = ({ consultantStats }) => {
    const data = consultantStats.map(stat => ({
        name: stat.consultant.name,
        commitments: stat.total,
        achieved: stat.achieved,
        achievementRate: stat.achievementRate,
    }));

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Consultant Performance Comparison
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="commitments" fill="#2196F3" name="Total Commitments" />
                        <Bar yAxisId="left" dataKey="achieved" fill="#4CAF50" name="Achieved" />
                        <Bar yAxisId="right" dataKey="achievementRate" fill="#FF9800" name="Achievement %" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

// Meetings Distribution Chart
export const MeetingsChart = ({ commitments }) => {
    const data = commitments.map((commitment, index) => ({
        name: commitment.studentName || `C${index + 1}`,
        meetings: commitment.meetingsDone || 0,
    })).filter(item => item.meetings > 0);

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Meetings Done per Commitment
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="meetings" fill="#673AB7" name="Meetings Done" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
