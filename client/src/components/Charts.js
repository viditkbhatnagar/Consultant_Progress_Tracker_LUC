import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, Typography, Chip } from '@mui/material';
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

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Lead Stage Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
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
