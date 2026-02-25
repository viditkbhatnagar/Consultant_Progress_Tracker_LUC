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
    IconButton,
    Tooltip as MuiTooltip,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    Visibility as VisibilityIcon,
    Comment as CommentIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getLeadStageColor, getAchievementColor } from '../utils/constants';

const ConsultantDetailDialog = ({ 
    open, 
    onClose, 
    consultant, 
    performanceData, 
    loading,
    onEditCommitment,
    onOpenTLComment,
    userRole, // 'admin' or 'team_lead'
}) => {
    const [tabValue, setTabValue] = React.useState(0);

    if (!performanceData) return null;

    const { monthlyStats = [], allCommitments = [] } = performanceData;
    const isAdmin = userRole === 'admin';

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
                        {/* Tabs for Commitments - Moved to Top */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                                <Tab label="All Commitments" />
                                <Tab label="Monthly Breakdown" />
                            </Tabs>
                        </Box>

                        {tabValue === 0 && (
                            <Box sx={{ mb: 4 }}>
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
                                                <TableCell align="center">Follow-up Date</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="center">Closed Date</TableCell>
                                                <TableCell align="center">TL Comments</TableCell>
                                                <TableCell align="center">Admin Comments</TableCell>
                                                <TableCell align="center">Actions</TableCell>
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
                                                // Calculate achievement: 100% if achieved or admission closed, else 0%
                                                const achievement = (commitment.status === 'achieved' || commitment.admissionClosed) ? 100 : 0;

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

                                                        {/* Follow-up Date */}
                                                        <TableCell align="center">
                                                            {commitment.followUpDate ? (
                                                                <Typography variant="body2" sx={{ fontWeight: 500, color: 'info.main' }}>
                                                                    {format(new Date(commitment.followUpDate), 'MMM d, yyyy')}
                                                                </Typography>
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">--</Typography>
                                                            )}
                                                        </TableCell>

                                                        {/* Status */}
                                                        <TableCell>
                                                            {commitment.admissionClosed ? (
                                                                <Chip
                                                                    label="Admitted & Closed"
                                                                    color="success"
                                                                    size="small"
                                                                    icon={<CheckCircleIcon />}
                                                                />
                                                            ) : (
                                                                <Chip label={commitment.status} size="small" variant="outlined" />
                                                            )}
                                                        </TableCell>

                                                        {/* Admission Closed Date */}
                                                        <TableCell align="center">
                                                            {commitment.admissionClosedDate ? (
                                                                <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.main' }}>
                                                                    {format(new Date(commitment.admissionClosedDate), 'MMM d, yyyy')}
                                                                </Typography>
                                                            ) : (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    -
                                                                </Typography>
                                                            )}
                                                        </TableCell>

                                                        {/* TL Comments */}
                                                        <TableCell align="center">
                                                            {commitment.correctiveActionByTL ? (
                                                                <MuiTooltip
                                                                    title={
                                                                        <Box sx={{ p: 1 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                                                Team Lead Comment:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {commitment.correctiveActionByTL}
                                                                            </Typography>
                                                                        </Box>
                                                                    }
                                                                    arrow
                                                                    placement="left"
                                                                >
                                                                    <IconButton
                                                                        size="small"
                                                                        color="primary"
                                                                        onClick={isAdmin ? undefined : () => onOpenTLComment && onOpenTLComment(commitment)}
                                                                        title={isAdmin ? "View TL comment" : "View/Edit TL comment"}
                                                                        disabled={isAdmin}
                                                                    >
                                                                        <VisibilityIcon fontSize="small" />
                                                                    </IconButton>
                                                                </MuiTooltip>
                                                            ) : (
                                                                isAdmin ? (
                                                                    <Typography variant="body2" color="text.secondary">--</Typography>
                                                                ) : (
                                                                    <IconButton
                                                                        size="small"
                                                                        color="action"
                                                                        onClick={() => onOpenTLComment && onOpenTLComment(commitment)}
                                                                        title="Add TL comment"
                                                                    >
                                                                        <CommentIcon fontSize="small" />
                                                                    </IconButton>
                                                                )
                                                            )}
                                                        </TableCell>

                                                        {/* Admin Comments */}
                                                        <TableCell align="center">
                                                            {commitment.adminComment ? (
                                                                <MuiTooltip
                                                                    title={
                                                                        <Box sx={{ p: 1 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                                                Admin Comment:
                                                                            </Typography>
                                                                            <Typography variant="body2">
                                                                                {commitment.adminComment}
                                                                            </Typography>
                                                                        </Box>
                                                                    }
                                                                    arrow
                                                                    placement="left"
                                                                >
                                                                    <IconButton
                                                                        size="small"
                                                                        color="primary"
                                                                        onClick={isAdmin ? () => onEditCommitment && onEditCommitment(commitment) : undefined}
                                                                        title={isAdmin ? "View/Edit Admin Comment" : "View Admin Comment"}
                                                                        disabled={!isAdmin}
                                                                    >
                                                                        <VisibilityIcon fontSize="small" />
                                                                    </IconButton>
                                                                </MuiTooltip>
                                                            ) : (
                                                                isAdmin ? (
                                                                    <IconButton
                                                                        size="small"
                                                                        color="action"
                                                                        onClick={() => onEditCommitment && onEditCommitment(commitment)}
                                                                        title="Add Admin Comment"
                                                                    >
                                                                        <CommentIcon fontSize="small" />
                                                                    </IconButton>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">--</Typography>
                                                                )
                                                            )}
                                                        </TableCell>

                                                        {/* Actions */}
                                                        <TableCell align="center">
                                                            {isAdmin ? (
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => onEditCommitment && onEditCommitment(commitment)}
                                                                    title="Edit/Add Admin Comment"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            ) : (
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => onEditCommitment && onEditCommitment(commitment)}
                                                                    title="Edit commitment"
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        )}

                        {tabValue === 1 && (
                            <Box sx={{ mb: 4 }}>
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
                            </Box>
                        )}

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
