import React, { useState, useEffect } from 'react';
import {
    Container,
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
    Paper,
    Chip,
    AppBar,
    Toolbar,
    IconButton,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Button,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    CheckCircle as CheckCircleIcon,
    People as PeopleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import authService from '../services/authService';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { getLeadStageColor, getAchievementColor } from '../utils/constants';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();

    const [commitments, setCommitments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);

    // Load data
    const loadData = async () => {
        try {
            setLoading(true);
            const [commitmentsData, usersData] = await Promise.all([
                commitmentService.getCurrentWeekCommitments(),
                authService.getUsers(),
            ]);
            setCommitments(commitmentsData.data || []);
            setUsers(usersData.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Calculate organization-wide metrics
    const totalCommitments = commitments.length;
    const totalAchieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;
    const orgAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    const totalConsultants = users.filter(u => u.role === 'consultant').length;
    const totalTeamLeads = users.filter(u => u.role === 'team_lead').length;

    // Group by team lead for team stats
    const teamGroups = commitments.reduce((groups, commitment) => {
        const teamLeadId = commitment.teamLead._id;
        if (!groups[teamLeadId]) {
            groups[teamLeadId] = {
                teamLead: commitment.teamLead,
                teamName: commitment.teamName,
                commitments: [],
            };
        }
        groups[teamLeadId].commitments.push(commitment);
        return groups;
    }, {});

    const teamStats = Object.values(teamGroups).map(group => {
        const total = group.commitments.length;
        const achieved = group.commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
        const meetings = group.commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
        const closed = group.commitments.filter(c => c.admissionClosed).length;
        const achievementRate = total > 0 ? Math.round((achieved / total) * 100) : 0;

        return {
            teamLead: group.teamLead,
            teamName: group.teamName,
            total,
            achieved,
            meetings,
            closed,
            achievementRate,
        };
    });

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Team Progress Tracker - Admin Dashboard
                    </Typography>
                    <Typography variant="body1" sx={{ mr: 2 }}>
                        {user?.name}
                    </Typography>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
                {/* Header */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom>
                        Organization Dashboard
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {formatWeekDisplay(weekInfo.weekNumber, weekInfo.year, weekInfo.weekStartDate, weekInfo.weekEndDate)}
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* Organization Metrics */}
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} sm={6} md={2.4}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="body2">
                                            Total Commitments
                                        </Typography>
                                        <Typography variant="h4">{totalCommitments}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2.4}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="body2">
                                            Achievement Rate
                                        </Typography>
                                        <Typography
                                            variant="h4"
                                            sx={{ color: getAchievementColor(orgAchievementRate) }}
                                        >
                                            {orgAchievementRate}%
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2.4}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="body2">
                                            Total Meetings
                                        </Typography>
                                        <Typography variant="h4">{totalMeetings}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2.4}>
                                <Card>
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="body2">
                                            Admissions Closed
                                        </Typography>
                                        <Typography variant="h4" sx={{ color: '#4CAF50' }}>
                                            {totalClosed}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} sm={6} md={2.4}>
                                <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                                    <CardContent>
                                        <Typography color="white" gutterBottom variant="body2">
                                            Active Users
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'white' }}>
                                            <PeopleIcon sx={{ mr: 1, fontSize: 32 }} />
                                            <Typography variant="h4">{users.length}</Typography>
                                        </Box>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                            {totalConsultants} Consultants, {totalTeamLeads} Leads
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Tabs */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                                <Tab label="Team Performance" />
                                <Tab label="All Commitments" />
                                <Tab label="User Management" />
                            </Tabs>
                        </Box>

                        {/* Team Performance Tab */}
                        {tabValue === 0 && (
                            <Box>
                                <Typography variant="h6" gutterBottom>
                                    Performance by Team
                                </Typography>
                                <Grid container spacing={3}>
                                    {teamStats.map(stat => (
                                        <Grid item xs={12} md={6} lg={4} key={stat.teamLead._id}>
                                            <Card>
                                                <CardContent>
                                                    <Typography variant="h6" gutterBottom>
                                                        {stat.teamName}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                                        Lead: {stat.teamLead.name}
                                                    </Typography>
                                                    <Grid container spacing={2} sx={{ mt: 1 }}>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Commitments
                                                            </Typography>
                                                            <Typography variant="h5">{stat.total}</Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Achievement
                                                            </Typography>
                                                            <Typography
                                                                variant="h5"
                                                                sx={{ color: getAchievementColor(stat.achievementRate) }}
                                                            >
                                                                {stat.achievementRate}%
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Meetings
                                                            </Typography>
                                                            <Typography variant="h6">{stat.meetings}</Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Closed
                                                            </Typography>
                                                            <Typography variant="h6" sx={{ color: '#4CAF50' }}>
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

                        {/* All Commitments Tab */}
                        {tabValue === 1 && (
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        All Organization Commitments
                                    </Typography>
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Team</TableCell>
                                                    <TableCell>Consultant</TableCell>
                                                    <TableCell>Student</TableCell>
                                                    <TableCell>Commitment</TableCell>
                                                    <TableCell>Lead Stage</TableCell>
                                                    <TableCell align="center">Achievement</TableCell>
                                                    <TableCell>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {commitments.map((commitment) => (
                                                    <TableRow key={commitment._id}>
                                                        <TableCell>{commitment.teamName}</TableCell>
                                                        <TableCell>{commitment.consultant.name}</TableCell>
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
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {commitment.achievementPercentage || 0}%
                                                        </TableCell>
                                                        <TableCell>
                                                            {commitment.admissionClosed ? (
                                                                <Chip
                                                                    label="Closed"
                                                                    color="success"
                                                                    size="small"
                                                                    icon={<CheckCircleIcon />}
                                                                />
                                                            ) : (
                                                                <Chip
                                                                    label={commitment.status}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* User Management Tab */}
                        {tabValue === 2 && (
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Typography variant="h6">
                                            User Management
                                        </Typography>
                                        <Button variant="contained" size="small">
                                            Add User
                                        </Button>
                                    </Box>
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Email</TableCell>
                                                    <TableCell>Role</TableCell>
                                                    <TableCell>Team</TableCell>
                                                    <TableCell>Phone</TableCell>
                                                    <TableCell>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {users.map((u) => (
                                                    <TableRow key={u._id}>
                                                        <TableCell>{u.name}</TableCell>
                                                        <TableCell>{u.email}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.role.replace('_', ' ')}
                                                                size="small"
                                                                color={
                                                                    u.role === 'admin' ? 'error' :
                                                                        u.role === 'team_lead' ? 'primary' :
                                                                            'default'
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell>{u.teamName || '-'}</TableCell>
                                                        <TableCell>{u.phone || '-'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.isActive ? 'Active' : 'Inactive'}
                                                                size="small"
                                                                color={u.isActive ? 'success' : 'default'}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </Container>
        </Box>
    );
};

export default AdminDashboard;
