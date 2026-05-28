import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import EChart from './charts/EChart';
import { lineOption } from './charts/presets';

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

    const trendOption = lineOption({
        categories: chartData.map((d) => d.date),
        series: [
            { name: 'Commitments', data: chartData.map((d) => d.commitments), color: '#2C3E50', symbolSize: 7 },
            { name: 'Meetings', data: chartData.map((d) => d.meetings), color: '#4CAF50', symbolSize: 6 },
            { name: 'Achieved', data: chartData.map((d) => d.achieved), color: '#FF9800', symbolSize: 6 },
        ],
    });

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
                <Box sx={{ width: '100%', mt: 2 }}>
                    <EChart option={trendOption} height={300} />
                </Box>
            </CardContent>
        </Card>
    );
};

export default ActivityHeatmap;
