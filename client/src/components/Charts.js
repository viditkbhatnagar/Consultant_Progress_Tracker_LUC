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

    const RADIAN = Math.PI / 180;
    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="#333" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                {`${name} (${(percent * 100).toFixed(0)}%)`}
            </text>
        );
    };

    return (
        <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
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
                            innerRadius={50}
                            fill="#8884d8"
                            dataKey="value"
                            paddingAngle={2}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: 8, 
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, justifyContent: 'center' }}>
                    {data.map((entry) => (
                        <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: entry.color }} />
                            <Typography variant="caption" color="text.secondary">
                                {entry.name}: {entry.value}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </CardContent>
        </Card>
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
