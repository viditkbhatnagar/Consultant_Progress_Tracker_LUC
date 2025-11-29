import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tabs,
    Tab,
    CircularProgress,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getLeadStageColor, getAchievementColor } from '../utils/constants';

const ConsultantDetailDialog = ({ open, onClose, consultant, performanceData, loading }) => {
    const [tabValue, setTabValue] = React.useState(0);

    if (!performanceData) return null;

    const { monthlyStats = [], allCommitments = [] } = performanceData;

    // Prepare chart data
    const monthlyChartData = monthlyStats.map(stat => ({
        month: stat.month,
        commitments: stat.total,
        achieved: stat.achieved,
        achievementRate: stat.total > 0 ? Math.round((stat.achieved / stat.total) * 100) : 0,
        meetings: stat.meetings,
        closed: stat.closed,
    }));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { minHeight: '70vh' }
            }}
        >
            <DialogTitle>
                <Typography variant="h5">{consultant?.name} - Performance Details</Typography>
                <Typography variant="body2" color="text.secondary">
                    {consultant?.email} • {consultant?.teamName}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box>
                        {/* Summary Cards */}
                        <Grid container spacing={2} sx={{ mb: 4 }}>
                            <Grid item xs={6} sm={3}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="caption" color="text.secondary">
                                            Total Commitments
                                        </Typography>
                                        <Typography variant="h4">
                                            {allCommitments.length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="caption" color="text.secondary">
                                            Achieved
                                        </Typography>
                                        <Typography variant="h4" color="success.main">
                                            {allCommitments.filter(c => c.status === 'achieved' || c.admissionClosed).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="caption" color="text.secondary">
                                            Total Meetings
                                        </Typography>
                                        <Typography variant="h4">
                                            {allCommitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={6} sm={3}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="caption" color="text.secondary">
                                            Admissions Closed
                                        </Typography>
                                        <Typography variant="h4" color="success.main">
                                            {allCommitments.filter(c => c.admissionClosed).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Monthly Performance Chart */}
                        {monthlyChartData.length > 0 && (
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Monthly Performance Trend
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={monthlyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="commitments" fill="#3b82f6" name="Total Commitments" />
                                            <Bar dataKey="achieved" fill="#10b981" name="Achieved" />
                                            <Bar dataKey="closed" fill="#f59e0b" name="Closed" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Achievement Rate Chart */}
                        {monthlyChartData.length > 0 && (
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Achievement Rate Trend
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={monthlyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="achievementRate" stroke="#7c3aed" strokeWidth={2} name="Achievement %" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* Tabs for Monthly Details */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                                <Tab label="All Commitments" />
                                <Tab label="Monthly Breakdown" />
                            </Tabs>
                        </Box>

                        {tabValue === 0 && (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Week</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Day</TableCell>
                                            <TableCell>Time</TableCell>
                                            <TableCell>Student</TableCell>
                                            <TableCell>Description</TableCell>
                                            <TableCell>Lead Stage</TableCell>
                                            <TableCell align="center">Probability</TableCell>
                                            <TableCell align="center">Achievement</TableCell>
                                            <TableCell align="center">Meetings</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {allCommitments.map((commitment) => {
                                            // Calculate date, day, time formatting
                                            const commitmentDate = new Date(commitment.weekStartDate);
                                            const dayOfWeek = commitmentDate.toLocaleDateString('en-US', { weekday: 'long' });
                                            const dateFormatted = commitmentDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
                                            const timeFormatted = commitment.createdAt
                                                ? new Date(commitment.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                                : '--:--';
                                            // Simplified achievement: 100% if closed, 0% otherwise
                                            const achievement = commitment.admissionClosed ? 100 : 0;

                                            return (
                                                <TableRow key={commitment._id}>
                                                    <TableCell>W{commitment.weekNumber}</TableCell>
                                                    <TableCell>{dateFormatted}</TableCell>
                                                    <TableCell>{dayOfWeek}</TableCell>
                                                    <TableCell>{timeFormatted}</TableCell>
                                                    <TableCell>{commitment.studentName}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                            {commitment.commitmentMade}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={commitment.leadStage}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: getLeadStageColor(commitment.leadStage),
                                                                color: 'white',
                                                                fontSize: '0.75rem',
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color:
                                                                    (commitment.conversionProbability || 0) >= 70 ? '#4caf50' :
                                                                        (commitment.conversionProbability || 0) >= 40 ? '#ff9800' : '#f44336',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {commitment.conversionProbability || 0}%
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: achievement === 100 ? '#4caf50' : 'text.secondary',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {achievement}%
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">{commitment.meetingsDone || 0}</TableCell>
                                                    <TableCell>
                                                        {commitment.admissionClosed ? (
                                                            <Chip label="Closed" color="success" size="small" />
                                                        ) : (
                                                            <Chip label={commitment.status} size="small" variant="outlined" />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}

                        {tabValue === 1 && (
                            <Grid container spacing={2}>
                                {monthlyStats.map((stat) => (
                                    <Grid item xs={12} sm={6} md={4} key={stat.month}>
                                        <Card variant="outlined">
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom>
                                                    {stat.month}
                                                </Typography>
                                                <Grid container spacing={1}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Total
                                                        </Typography>
                                                        <Typography variant="h5">{stat.total}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Achieved
                                                        </Typography>
                                                        <Typography variant="h5" color="success.main">
                                                            {stat.achieved}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Meetings
                                                        </Typography>
                                                        <Typography variant="h6">{stat.meetings}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Closed
                                                        </Typography>
                                                        <Typography variant="h6" color="warning.main">
                                                            {stat.closed}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConsultantDetailDialog;
