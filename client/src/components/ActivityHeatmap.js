import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ActivityHeatmap = ({ commitments, month = new Date() }) => {
    // Generate chart data
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start, end });

    // Create a map of dates to activity counts
    const activityMap = {};
    commitments.forEach(commitment => {
        const date = format(new Date(commitment.weekStartDate), 'yyyy-MM-dd');
        if (!activityMap[date]) {
            activityMap[date] = {
                count: 0,
                meetings: 0,
                achieved: 0,
            };
        }
        activityMap[date].count++;
        activityMap[date].meetings += commitment.meetingsDone || 0;
        if (commitment.status === 'achieved' || commitment.admissionClosed) {
            activityMap[date].achieved++;
        }
    });

    // Transform to chart format with day labels
    const chartData = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return {
            date: format(day, 'MMM d'),
            fullDate: dateStr,
            commitments: activityMap[dateStr]?.count || 0,
            meetings: activityMap[dateStr]?.meetings || 0,
            achieved: activityMap[dateStr]?.achieved || 0,
        };
    });

    // Calculate totals for summary
    const totalDaysWithActivity = chartData.filter(d => d.commitments > 0).length;
    const maxActivity = Math.max(...chartData.map(d => d.commitments), 0);

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <Box
                    sx={{
                        backgroundColor: 'white',
                        border: '1px solid #E5EAF5',
                        borderRadius: 2,
                        p: 1.5,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                        {payload[0].payload.date}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#2C3E50', display: 'block' }}>
                        Commitments: {payload[0].value}
                    </Typography>
                    {payload[1] && (
                        <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block' }}>
                            Meetings: {payload[1].value}
                        </Typography>
                    )}
                    {payload[2] && (
                        <Typography variant="caption" sx={{ color: '#FF9800', display: 'block' }}>
                            Achieved: {payload[2].value}
                        </Typography>
                    )}
                </Box>
            );
        }
        return null;
    };

    return (
        <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon sx={{ color: '#2C3E50' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2C3E50' }}>
                            Activity Trends
                        </Typography>
                        <Chip
                            label={format(month, 'MMMM yyyy')}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 500 }}
                        />
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Chip label={`${totalDaysWithActivity} active days`} size="small" color="success" variant="outlined" />
                        <Chip label={`Peak: ${maxActivity} commitments`} size="small" color="primary" variant="outlined" />
                    </Stack>
                </Box>

                {/* Line Chart */}
                <Box sx={{ width: '100%', height: 300, mt: 2 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF5" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#2C3E50' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#2C3E50' }}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: '12px' }}
                                iconType="line"
                            />
                            <Line
                                type="monotone"
                                dataKey="commitments"
                                stroke="#2C3E50"
                                strokeWidth={2}
                                dot={{ fill: '#2C3E50', r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Commitments"
                            />
                            <Line
                                type="monotone"
                                dataKey="meetings"
                                stroke="#4CAF50"
                                strokeWidth={2}
                                dot={{ fill: '#4CAF50', r: 3 }}
                                name="Meetings"
                            />
                            <Line
                                type="monotone"
                                dataKey="achieved"
                                stroke="#FF9800"
                                strokeWidth={2}
                                dot={{ fill: '#FF9800', r: 3 }}
                                name="Achieved"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            </CardContent>
        </Card>
    );
};

export default ActivityHeatmap;
