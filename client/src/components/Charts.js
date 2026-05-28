import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { getLeadStageColor } from '../utils/constants';
import EChart from './charts/EChart';
import { donutOption, barOption, lineOption } from './charts/presets';

// All charts render via the shared themed <EChart> wrapper (Apache
// ECharts). Export names + props are unchanged so the dashboard pages
// that import these need no edits.

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

    const option = donutOption({
        data,
        radius: ['55%', '72%'],
        showLabel: true,
        labelFormatter: '{b} ({d}%)',
    });

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
            <EChart option={option} height={320} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mt: 1.5, justifyContent: 'center' }}>
                {data.map((entry) => (
                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color }} />
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
    const names = commitments.map((c, i) => c.studentName || `C${i + 1}`);
    const option = barOption({
        categories: names,
        series: [
            { name: 'Target (100%)', data: commitments.map(() => 100), color: '#E0E0E0' },
            { name: 'Achieved %', data: commitments.map((c) => c.achievementPercentage || 0), color: '#4CAF50' },
        ],
    });

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Achievement vs Target
                </Typography>
                <EChart option={option} height={300} />
            </CardContent>
        </Card>
    );
};

// Weekly Trend Chart
export const WeeklyTrendChart = ({ weeklyData }) => {
    const weeks = (weeklyData || []).map((w) => w.week);
    const option = lineOption({
        categories: weeks,
        series: [
            { name: 'Commitments', data: (weeklyData || []).map((w) => w.commitments), color: '#2196F3' },
            { name: 'Achieved', data: (weeklyData || []).map((w) => w.achieved), color: '#4CAF50' },
            { name: 'Meetings', data: (weeklyData || []).map((w) => w.meetings), color: '#FF9800' },
        ],
    });

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Weekly Performance Trend
                </Typography>
                <EChart option={option} height={300} />
            </CardContent>
        </Card>
    );
};

// Consultant Performance Comparison (dual Y-axis)
export const ConsultantPerformanceChart = ({ consultantStats }) => {
    const names = consultantStats.map((s) => s.consultant.name);
    const option = barOption({
        categories: names,
        yAxes: [{}, { axisLabel: { formatter: '{value}%' } }],
        series: [
            { name: 'Total Commitments', data: consultantStats.map((s) => s.total), color: '#2196F3', yAxisIndex: 0 },
            { name: 'Achieved', data: consultantStats.map((s) => s.achieved), color: '#4CAF50', yAxisIndex: 0 },
            { name: 'Achievement %', data: consultantStats.map((s) => s.achievementRate), color: '#FF9800', yAxisIndex: 1 },
        ],
    });

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Consultant Performance Comparison
                </Typography>
                <EChart option={option} height={300} />
            </CardContent>
        </Card>
    );
};

// Meetings Distribution Chart
export const MeetingsChart = ({ commitments }) => {
    const data = commitments
        .map((c, i) => ({ name: c.studentName || `C${i + 1}`, meetings: c.meetingsDone || 0 }))
        .filter((item) => item.meetings > 0);
    const option = barOption({
        categories: data.map((d) => d.name),
        series: [{ name: 'Meetings Done', data: data.map((d) => d.meetings), color: '#673AB7' }],
    });

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Meetings Done per Commitment
                </Typography>
                <EChart option={option} height={300} />
            </CardContent>
        </Card>
    );
};
