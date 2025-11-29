import React from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import { Card, CardContent, Typography, Tooltip as MuiTooltip, Box } from '@mui/material';
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

    // Custom tooltip
    const TooltipContent = ({ value }) => {
        if (!value || value.count === 0) return null;
        return (
            <Box sx={{ p: 1 }}>
                <Typography variant="caption" display="block">
                    {format(new Date(value.date), 'MMM dd, yyyy')}
                </Typography>
                <Typography variant="caption" display="block">
                    Commitments: {value.count}
                </Typography>
                <Typography variant="caption" display="block">
                    Meetings: {value.meetings}
                </Typography>
                <Typography variant="caption" display="block">
                    Achieved: {value.achieved}
                </Typography>
            </Box>
        );
    };

    return (
        <Card elevation={2}>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Activity Heatmap - {format(month, 'MMMM yyyy')}
                </Typography>
                <Box sx={{ mt: 2 }}>
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
                                'data-tip': value.date ? `${value.count} commitments` : 'No activity',
                            };
                        }}
                        showWeekdayLabels
                    />
                </Box>
                <style>{`
                    .react-calendar-heatmap {
                        width: 100%;
                    }
                    .react-calendar-heatmap .color-empty {
                        fill: #f0f0f0;
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
                    .react-calendar-heatmap text {
                        font-size: 10px;
                        fill: #666;
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
