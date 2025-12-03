import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const ActivityHeatmap = ({ commitments, month = new Date() }) => {
    // Generate heatmap data
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

    // Transform to heatmap format
    const heatmapData = daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return {
            date: dateStr,
            count: activityMap[dateStr]?.count || 0,
            meetings: activityMap[dateStr]?.meetings || 0,
            achieved: activityMap[dateStr]?.achieved || 0,
        };
    });

    // Calculate totals for summary
    const totalDaysWithActivity = heatmapData.filter(d => d.count > 0).length;
    const maxActivity = Math.max(...heatmapData.map(d => d.count), 0);

    return (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon sx={{ color: 'primary.main' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Activity Heatmap
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
                
                {/* Compact Heatmap Container */}
                <Box sx={{ 
                    maxWidth: 800, 
                    mx: 'auto',
                    '& .react-calendar-heatmap': {
                        width: '100%',
                        maxHeight: 150,
                    },
                    '& .react-calendar-heatmap text': {
                        fontSize: '8px',
                        fill: '#666',
                    },
                    '& .react-calendar-heatmap rect': {
                        rx: 2,
                        ry: 2,
                    },
                }}>
                    <CalendarHeatmap
                        startDate={start}
                        endDate={end}
                        values={heatmapData}
                        classForValue={(value) => {
                            if (!value || value.count === 0) {
                                return 'color-empty';
                            }
                            if (value.count >= 5) return 'color-scale-4';
                            if (value.count >= 3) return 'color-scale-3';
                            if (value.count >= 2) return 'color-scale-2';
                            return 'color-scale-1';
                        }}
                        tooltipDataAttrs={(value) => {
                            return {
                                'data-tip': value.date ? `${value.count} commitments on ${format(new Date(value.date), 'MMM d')}` : 'No activity',
                            };
                        }}
                        showWeekdayLabels
                        gutterSize={3}
                    />
                </Box>

                {/* Legend */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">Less</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map((color, i) => (
                            <Box
                                key={i}
                                sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 0.5,
                                    backgroundColor: color,
                                }}
                            />
                        ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary">More</Typography>
                </Box>

                <style>{`
                    .react-calendar-heatmap .color-empty {
                        fill: #ebedf0;
                    }
                    .react-calendar-heatmap .color-scale-1 {
                        fill: #9be9a8;
                    }
                    .react-calendar-heatmap .color-scale-2 {
                        fill: #40c463;
                    }
                    .react-calendar-heatmap .color-scale-3 {
                        fill: #30a14e;
                    }
                    .react-calendar-heatmap .color-scale-4 {
                        fill: #216e39;
                    }
                    .react-calendar-heatmap rect:hover {
                        stroke: #555;
                        stroke-width: 1px;
                    }
                `}</style>
            </CardContent>
        </Card>
    );
};

export default ActivityHeatmap;
