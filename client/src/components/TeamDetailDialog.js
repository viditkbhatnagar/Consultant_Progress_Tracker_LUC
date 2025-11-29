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
    Avatar,
    CardActionArea,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getLeadStageColor, getAchievementColor } from '../utils/constants';
import { Groups as GroupsIcon, TrendingUp as TrendingUpIcon } from '@mui/icons-material';

const TeamDetailDialog = ({ open, onClose, team, commitments, onConsultantClick }) => {
    if (!team) return null;

    // Calculate team stats
    const totalCommitments = commitments.length;
    const achieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const achievementRate = totalCommitments > 0 ? Math.round((achieved / totalCommitments) * 100) : 0;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;

    // Group by consultant
    const consultantStats = commitments.reduce((acc, commitment) => {
        const consultantName = commitment.consultantName;
        if (!acc[consultantName]) {
            acc[consultantName] = {
                name: consultantName,
                total: 0,
                achieved: 0,
                meetings: 0,
                closed: 0,
            };
        }
        acc[consultantName].total++;
        acc[consultantName].meetings += commitment.meetingsDone || 0;
        if (commitment.status === 'achieved' || commitment.admissionClosed) acc[consultantName].achieved++;
        if (commitment.admissionClosed) acc[consultantName].closed++;
        return acc;
    }, {});

    const consultantData = Object.values(consultantStats).map(stat => ({
        name: stat.name,
        commitments: stat.total,
        achieved: stat.achieved,
        achievementRate: stat.total > 0 ? Math.round((stat.achieved / stat.total) * 100) : 0,
        meetings: stat.meetings,
        closed: stat.closed,
    }));

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                        <GroupsIcon />
                    </Avatar>
                    <Box>
                        <Typography variant="h5">{team.teamName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Team Lead: {team.teamLead.name}
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {/* Team Summary Stats */}
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={6} sm={3}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="caption" color="text.secondary">
                                    Total Commitments
                                </Typography>
                                <Typography variant="h4">{totalCommitments}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="caption" color="text.secondary">
                                    Achievement Rate
                                </Typography>
                                <Typography variant="h4" sx={{ color: getAchievementColor(achievementRate) }}>
                                    {achievementRate}%
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
                                <Typography variant="h4">{totalMeetings}</Typography>
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
                                    {totalClosed}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Consultant Performance Chart */}
                {consultantData.length > 0 && (
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Consultant Performance Comparison
                            </Typography>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={consultantData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="commitments" fill="#3b82f6" name="Total" />
                                    <Bar dataKey="achieved" fill="#10b981" name="Achieved" />
                                    <Bar dataKey="closed" fill="#f59e0b" name="Closed" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Clickable Consultant Cards */}
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                    Team Members - Click to View Details
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {consultantData.map((data) => (
                        <Grid item xs={12} sm={6} md={4} key={data.name}>
                            <Card
                                elevation={2}
                                sx={{
                                    transition: 'all 0.3s ease',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 6,
                                    },
                                }}
                            >
                                <CardActionArea onClick={() => onConsultantClick && onConsultantClick(data.name)}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {data.name}
                                            </Typography>
                                            <TrendingUpIcon color="primary" />
                                        </Box>
                                        <Grid container spacing={1}>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Commitments
                                                </Typography>
                                                <Typography variant="h5">{data.commitments}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Achievement
                                                </Typography>
                                                <Typography
                                                    variant="h5"
                                                    sx={{ color: getAchievementColor(data.achievementRate) }}
                                                >
                                                    {data.achievementRate}%
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Meetings
                                                </Typography>
                                                <Typography variant="body1">{data.meetings}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Closed
                                                </Typography>
                                                <Typography variant="body1" color="success.main">
                                                    {data.closed}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                                            <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                                                Click for full details →
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Recent Commitments Table */}
                <Typography variant="h6" gutterBottom>
                    Recent Commitments
                </Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Consultant</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Commitment</TableCell>
                                <TableCell>Lead Stage</TableCell>
                                <TableCell align="center">Achievement</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {commitments.slice(0, 10).map((commitment) => (
                                <TableRow key={commitment._id} hover>
                                    <TableCell>{commitment.consultantName}</TableCell>
                                    <TableCell>{commitment.studentName || 'N/A'}</TableCell>
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
                                            sx={{ color: getAchievementColor(commitment.achievementPercentage || 0), fontWeight: 600 }}
                                        >
                                            {commitment.achievementPercentage || 0}%
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {commitment.admissionClosed ? (
                                            <Chip label="Closed" color="success" size="small" />
                                        ) : (
                                            <Chip label={commitment.status} size="small" variant="outlined" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default TeamDetailDialog;
