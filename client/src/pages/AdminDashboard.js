import React, { useState, useEffect, useCallback } from 'react';
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
    Chip,
    IconButton,
    Button,
    AppBar,
    Toolbar,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Menu,
    MenuItem,
    CardActionArea,
    Avatar,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    Groups as GroupsIcon,
    TrendingUp as TrendingUpIcon,
    Comment as CommentIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import { getUsers } from '../services/authService';
import exportService from '../services/exportService';
import consultantService from '../services/consultantService';
import { API_BASE_URL } from '../utils/constants';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import DateRangeSelector from '../components/DateRangeSelector';
import TeamDetailDialog from '../components/TeamDetailDialog';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import TeamHierarchyView from '../components/TeamHierarchyView';
import ActivityHeatmap from '../components/ActivityHeatmap';
import AdminCommitmentDialog from '../components/AdminCommitmentDialog';
import UserManagementDialog from '../components/UserManagementDialog';
import ConsultantManagementDialog from '../components/ConsultantManagementDialog';
import { LeadStageChart } from '../components/Charts';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { getLeadStageColor, getAchievementColor, LEAD_STAGES_LIST, STATUS_LIST } from '../utils/constants';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();

    const [commitments, setCommitments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
    const [filteredCommitments, setFilteredCommitments] = useState([]);
    const [filters, setFilters] = useState({ search: '', stage: '', status: '', teamLead: '', consultant: '' });

    // Date range state
    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    // Dialog states
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamDetailOpen, setTeamDetailOpen] = useState(false);
    const [teamCommitments, setTeamCommitments] = useState([]);

    const [selectedConsultant, setSelectedConsultant] = useState(null);
    const [consultantDetailOpen, setConsultantDetailOpen] = useState(false);
    const [consultantPerformance, setConsultantPerformance] = useState(null);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    // Admin comment dialog state
    const [selectedCommitment, setSelectedCommitment] = useState(null);
    const [adminCommentDialogOpen, setAdminCommentDialogOpen] = useState(false);

    // User management dialog state
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Consultant management state
    const [consultants, setConsultants] = useState([]);
    const [consultantDialogOpen, setConsultantDialogOpen] = useState(false);
    // Reusing selectedConsultant state from line 85

    // Load commitments by date range
    const loadCommitments = useCallback(async () => {
        try {
            setLoading(true);
            const data = await commitmentService.getCommitmentsByDateRange(
                dateRange.startDate,
                dateRange.endDate
            );
            setCommitments(data.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load commitments');
        } finally {
            setLoading(false);
        }
    }, [dateRange.startDate, dateRange.endDate]);

    // Load users
    const loadUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data.data || data || []);
        } catch (err) {
            setError('Failed to load users');
        }
    };

    // Load consultants
    const loadConsultants = useCallback(async () => {
        try {
            const response = await consultantService.getConsultants();
            setConsultants(response.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, []);

    // Consultant CRUD handlers
    const handleCreateConsultant = async (consultantData) => {
        try {
            await consultantService.createConsultant(consultantData);
            await loadConsultants();
            setConsultantDialogOpen(false);
            setSelectedConsultant(null);
        } catch (err) {
            throw err;
        }
    };

    const handleUpdateConsultant = async (consultantData) => {
        try {
            await consultantService.updateConsultant(selectedConsultant._id, consultantData);
            await loadConsultants();
            setConsultantDialogOpen(false);
            setSelectedConsultant(null);
        } catch (err) {
            throw err;
        }
    };

    const handleSaveConsultant = async (consultantData) => {
        if (selectedConsultant) {
            await handleUpdateConsultant(consultantData);
        } else {
            await handleCreateConsultant(consultantData);
        }
    };

    const handleDeactivateConsultant = async (consultantId) => {
        if (window.confirm('Are you sure you want to deactivate this consultant?')) {
            try {
                await consultantService.deleteConsultant(consultantId);
                await loadConsultants();
            } catch (err) {
                setError('Failed to deactivate consultant');
            }
        }
    };


    useEffect(() => {
        loadUsers();
        loadConsultants();
    }, [loadConsultants]);

    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) {
            loadCommitments();
        }
    }, [dateRange, loadCommitments]);

    // Filter commitments
    useEffect(() => {
        let filtered = [...commitments];

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.studentName?.toLowerCase().includes(searchLower) ||
                c.commitmentMade?.toLowerCase().includes(searchLower) ||
                c.consultant?.name?.toLowerCase().includes(searchLower) ||
                c.teamName?.toLowerCase().includes(searchLower)
            );
        }

        if (filters.stage) {
            filtered = filtered.filter(c => c.leadStage === filters.stage);
        }

        if (filters.status) {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        if (filters.teamLead) {
            filtered = filtered.filter(c => c.teamLead?._id === filters.teamLead || c.teamLead === filters.teamLead);
        }

        if (filters.consultant) {
            filtered = filtered.filter(c => c.consultantName === filters.consultant);
        }

        setFilteredCommitments(filtered);
    }, [commitments, filters]);

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
    };

    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange);
    };

    const handleTeamClick = (team) => {
        setSelectedTeam(team);
        const teamComms = commitments.filter(c => c.teamName === team.teamName);
        setTeamCommitments(teamComms);
        setTeamDetailOpen(true);
    };

    const handleConsultantClick = async (consultant) => {
        setSelectedConsultant(consultant);
        setConsultantDetailOpen(true);
        setPerformanceLoading(true);

        try {
            const consultantName = typeof consultant === 'string' ? consultant : consultant.name;
            const data = await commitmentService.getConsultantPerformance(consultantName, 3);
            setConsultantPerformance(data);
        } catch (err) {
            setError('Failed to load consultant performance');
        } finally {
            setPerformanceLoading(false);
        }
    };

    const handleExportExcel = () => {
        const periodLabel = dateRange.viewType.replace('-', '_');
        exportService.exportCommitmentsToExcel(commitments, `organization_commitments_${periodLabel}`);
        setExportMenuAnchor(null);
    };

    const handleExportCSV = () => {
        const csvData = commitments.map(c => ({
            Team: c.teamName,
            Consultant: c.consultant?.name || 'N/A',
            Student: c.studentName || 'N/A',
            Commitment: c.commitmentMade,
            'Lead Stage': c.leadStage,
            'Achievement %': c.achievementPercentage || 0,
            Meetings: c.meetingsDone || 0,
            Status: c.status,
            Week: `W${c.weekNumber}`,
        }));
        const periodLabel = dateRange.viewType.replace('-', '_');
        exportService.exportToCSV(csvData, `organization_commitments_${periodLabel}`);
        setExportMenuAnchor(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenAdminComment = (commitment) => {
        setSelectedCommitment(commitment);
        setAdminCommentDialogOpen(true);
    };

    const handleSaveAdminComment = async (commitmentId, data) => {
        try {
            await commitmentService.updateCommitment(commitmentId, data);
            // Reload commitments
            await loadCommitments();
        } catch (err) {
            setError('Failed to save admin comment');
        }
    };

    const handleDeleteCommitment = async (commitmentId) => {
        if (!window.confirm('Are you sure you want to delete this commitment? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/commitments/${commitmentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to delete commitment');
            }

            // Reload commitments after successful delete
            await loadCommitments();
        } catch (err) {
            setError(err.message || 'Failed to delete commitment');
        }
    };

    // User management handlers
    const handleCreateUser = async (userData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ...userData,
                    role: 'team_lead' // Only create team leads
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create user');
            }

            await loadUsers();
            setUserDialogOpen(false);
            setSelectedUser(null);
        } catch (err) {
            throw err;
        }
    };

    const handleUpdateUser = async (userData) => {
        try {
            const updateData = {
                name: userData.name,
                teamName: userData.teamName,
                isActive: userData.isActive
            };

            // Only include password if it was provided
            if (userData.password) {
                updateData.password = userData.password;
            }

            await fetch(`${API_BASE_URL}/users/${selectedUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(updateData)
            });

            await loadUsers();
            setUserDialogOpen(false);
            setSelectedUser(null);
        } catch (err) {
            throw err;
        }
    };

    const handleSaveUser = async (userData) => {
        if (selectedUser) {
            await handleUpdateUser(userData);
        } else {
            await handleCreateUser(userData);
        }
    };

    const handleDeactivateUser = async (userId) => {
        if (window.confirm('Are you sure you want to deactivate this user?')) {
            try {
                await fetch(`${API_BASE_URL}/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                await loadUsers();
            } catch (err) {
                setError('Failed to deactivate user');
            }
        }
    };

    // Display commitments
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status
        ? filteredCommitments
        : commitments;

    // Organize teams
    const teamLeads = users.filter(u => u.role === 'team_lead');

    const teams = teamLeads.map(tl => {
        // Get all commitments for this team
        const teamComms = commitments.filter(c => c.teamName === tl.teamName);

        // Get unique consultant names from commitments
        const consultantNames = [...new Set(teamComms.map(c => c.consultantName))];

        // Build consultant stats from commitments
        const consultantsStats = consultantNames.map(consultantName => {
            const consultantComms = teamComms.filter(c => c.consultantName === consultantName);
            return {
                name: consultantName,
                commitmentCount: consultantComms.length,
                achievedCount: consultantComms.filter(c => c.admissionClosed || c.status === 'achieved').length,
                meetingsTotal: consultantComms.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
            };
        });

        return {
            teamName: tl.teamName,
            teamLead: tl,
            consultants: consultantsStats,
            totalCommitments: teamComms.length,
            achievedCommitments: teamComms.filter(c => c.admissionClosed || c.status === 'achieved').length,
            totalMeetings: teamComms.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
            closedAdmissions: teamComms.filter(c => c.admissionClosed).length,
        };
    });

    // Organization metrics
    const totalCommitments = commitments.length;
    const totalAchieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;
    const orgAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    // Calculate total consultants from teams
    const totalConsultants = teams.reduce((sum, team) => sum + team.consultants.length, 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Team Progress Tracker - Admin Dashboard
                    </Typography>
                    <Button
                        color="inherit"
                        startIcon={<DownloadIcon />}
                        onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                    >
                        Export
                    </Button>
                    <NotificationBell />
                    <Typography variant="body1" sx={{ ml: 2, mr: 2 }}>
                        {user?.name} (Admin)
                    </Typography>
                    <IconButton color="inherit" onClick={handleLogout}>
                        <LogoutIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>

            {/* Export Menu */}
            <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
            >
                <MenuItem onClick={handleExportExcel}>Export to Excel</MenuItem>
                <MenuItem onClick={handleExportCSV}>Export to CSV</MenuItem>
            </Menu>

            <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
                {/* Header */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" gutterBottom>
                        Organization Dashboard
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {formatWeekDisplay(weekInfo.weekNumber, weekInfo.year, weekInfo.weekStartDate, weekInfo.weekEndDate)}
                    </Typography>
                </Box>

                {/* Date Range Selector */}
                <Card elevation={2} sx={{ mb: 3 }}>
                    <CardContent>
                        <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                    </CardContent>
                </Card>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {/* Organization Metrics */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Total Commitments
                                </Typography>
                                <Typography variant="h3" sx={{ fontWeight: 700 }}>{totalCommitments}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {teams.length} Teams
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Organization Achievement
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{ color: getAchievementColor(orgAchievementRate), fontWeight: 700 }}
                                >
                                    {orgAchievementRate}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Total Meetings
                                </Typography>
                                <Typography variant="h3" sx={{ fontWeight: 700 }}>{totalMeetings}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {totalConsultants} Consultants
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Admissions Closed
                                </Typography>
                                <Typography variant="h3" sx={{ color: '#4CAF50', fontWeight: 700 }}>
                                    {totalClosed}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Analytics Charts and Heatmap */}
                {commitments.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                            Organization Analytics
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} lg={6}>
                                <LeadStageChart commitments={commitments} />
                            </Grid>
                            <Grid item xs={12} lg={6}>
                                <Card elevation={2}>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Team Performance Overview
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {teams.map(team => {
                                                const achievementRate = team.totalCommitments > 0
                                                    ? Math.round((team.achievedCommitments / team.totalCommitments) * 100)
                                                    : 0;
                                                return (
                                                    <Grid item xs={12} key={team.teamName}>
                                                        <Box sx={{ mb: 1 }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                    {team.teamName}
                                                                </Typography>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{ color: getAchievementColor(achievementRate), fontWeight: 600 }}
                                                                >
                                                                    {achievementRate}%
                                                                </Typography>
                                                            </Box>
                                                            <Box
                                                                sx={{
                                                                    height: 8,
                                                                    bgcolor: 'grey.200',
                                                                    borderRadius: 1,
                                                                    overflow: 'hidden',
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        height: '100%',
                                                                        width: `${achievementRate}%`,
                                                                        bgcolor: getAchievementColor(achievementRate),
                                                                        transition: 'width 0.3s ease',
                                                                    }}
                                                                />
                                                            </Box>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {team.totalCommitments} commitments • {team.consultants.length} consultants
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                );
                                            })}
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12}>
                                <ActivityHeatmap commitments={commitments} month={new Date()} />
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                        <Tab label="Teams Overview" />
                        <Tab label="All Commitments" />
                        <Tab label="Organization Hierarchy" />
                        <Tab label="User Management" />
                    </Tabs>
                </Box>

                {/* Tab Content */}
                {tabValue === 0 && (
                    // Teams Overview Tab
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                            Teams - Click to View Details
                        </Typography>
                        <Grid container spacing={3}>
                            {teams.map(team => {
                                const achievementRate = team.totalCommitments > 0
                                    ? Math.round((team.achievedCommitments / team.totalCommitments) * 100)
                                    : 0;
                                return (
                                    <Grid item xs={12} sm={6} lg={4} key={team.teamName}>
                                        <Card
                                            elevation={2}
                                            sx={{
                                                height: '100%',
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    transform: 'translateY(-8px)',
                                                    boxShadow: 6,
                                                    cursor: 'pointer',
                                                },
                                            }}
                                        >
                                            <CardActionArea onClick={() => handleTeamClick(team)}>
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Avatar sx={{ bgcolor: 'primary.main', mr: 1.5 }}>
                                                                <GroupsIcon />
                                                            </Avatar>
                                                            <Box>
                                                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                                    {team.teamName}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {team.teamLead.name}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                        <TrendingUpIcon color="primary" />
                                                    </Box>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                Commitments
                                                            </Typography>
                                                            <Typography variant="h4" sx={{ fontWeight: 600 }}>
                                                                {team.totalCommitments}
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                Achievement
                                                            </Typography>
                                                            <Typography
                                                                variant="h4"
                                                                sx={{ color: getAchievementColor(achievementRate), fontWeight: 600 }}
                                                            >
                                                                {achievementRate}%
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item xs={12}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {team.consultants.length} Team Members
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                                                        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                                                            Click to view team details →
                                                        </Typography>
                                                    </Box>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Box>
                )}

                {tabValue === 1 && (
                    // All Commitments Tab
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                All Organization Commitments
                            </Typography>

                            <CommitmentFilters
                                onFilterChange={handleFilterChange}
                                leadStages={LEAD_STAGES_LIST}
                                statuses={STATUS_LIST}
                                teamLeads={teamLeads}
                                consultants={consultants}
                            />

                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress />
                                </Box>
                            ) : displayCommitments.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography color="text.secondary">
                                        {commitments.length === 0
                                            ? 'No commitments for this period.'
                                            : 'No commitments match your filters.'}
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer sx={{ mt: 2 }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Week</TableCell>
                                                <TableCell>Date</TableCell>
                                                <TableCell>Day</TableCell>
                                                <TableCell>Time</TableCell>
                                                <TableCell>Team</TableCell>
                                                <TableCell>Consultant</TableCell>
                                                <TableCell>Student</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell>Lead Stage</TableCell>
                                                <TableCell align="center">Probability</TableCell>
                                                <TableCell align="center">Achievement</TableCell>
                                                <TableCell align="center">Meetings</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="center">Admin Comments</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {displayCommitments.map((commitment) => {
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
                                                    <TableRow key={commitment._id} hover>
                                                        <TableCell>W{commitment.weekNumber}</TableCell>
                                                        <TableCell>{dateFormatted}</TableCell>
                                                        <TableCell>{dayOfWeek}</TableCell>
                                                        <TableCell>{timeFormatted}</TableCell>
                                                        <TableCell>
                                                            <Chip label={commitment.teamName} size="small" variant="outlined" />
                                                        </TableCell>
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
                                                                sx={{
                                                                    color: achievement === 100 ? '#4caf50' : 'text.secondary',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {achievement}%
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {commitment.meetingsDone || 0}
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
                                                        <TableCell align="center">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenAdminComment(commitment)}
                                                                color={commitment.adminComment ? 'primary' : 'default'}
                                                                title={commitment.adminComment ? 'View/Edit Admin Comment' : 'Add Admin Comment'}
                                                            >
                                                                {commitment.adminComment ? <CommentIcon /> : <EditIcon />}
                                                            </IconButton>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenAdminComment(commitment)}
                                                                color="primary"
                                                                title="Edit Admin Comment"
                                                            >
                                                                <EditIcon />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleDeleteCommitment(commitment._id)}
                                                                color="error"
                                                                title="Delete Commitment"
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                )}

                {tabValue === 2 && (
                    // Organization Hierarchy Tab
                    <TeamHierarchyView
                        teams={teams}
                        adminUser={user}
                        onTeamClick={handleTeamClick}
                        onConsultantClick={handleConsultantClick}
                    />
                )}

                {tabValue === 3 && (
                    // User Management Tab
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h5">User Management</Typography>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        setSelectedUser(null);
                                        setUserDialogOpen(true);
                                    }}
                                >
                                    Add Team Lead
                                </Button>
                            </Box>

                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Team Name</TableCell>
                                            <TableCell>Role</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {users.filter(u => u.role !== 'consultant').map((user) => (
                                            <TableRow key={user._id} hover>
                                                <TableCell>{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>{user.teamName || '--'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={user.role === 'admin' ? 'Admin' : 'Team Lead'}
                                                        size="small"
                                                        color={user.role === 'admin' ? 'secondary' : 'primary'}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={user.isActive !== false ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        color={user.isActive !== false ? 'success' : 'default'}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setUserDialogOpen(true);
                                                        }}
                                                        title="Edit user"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                    {user.role !== 'admin' && (
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeactivateUser(user._id)}
                                                            title="Deactivate user"
                                                            disabled={user.isActive === false}
                                                        >
                                                            <CheckCircleIcon />
                                                        </IconButton>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Divider */}
                            <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

                            {/* Consultant Management Section */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h5">Consultant Management</Typography>
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={() => {
                                        setSelectedConsultant(null);
                                        setConsultantDialogOpen(true);
                                    }}
                                >
                                    Add Consultant
                                </Button>
                            </Box>

                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Phone</TableCell>
                                            <TableCell>Team Name</TableCell>
                                            <TableCell>Team Lead</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {consultants.map((consultant) => (
                                            <TableRow key={consultant._id} hover>
                                                <TableCell>{consultant.name}</TableCell>
                                                <TableCell>{consultant.email || '--'}</TableCell>
                                                <TableCell>{consultant.phone || '--'}</TableCell>
                                                <TableCell>{consultant.teamName}</TableCell>
                                                <TableCell>{consultant.teamLead?.name || '--'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={consultant.isActive !== false ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        color={consultant.isActive !== false ? 'success' : 'default'}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => {
                                                            setSelectedConsultant(consultant);
                                                            setConsultantDialogOpen(true);
                                                        }}
                                                        title="Edit consultant"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleDeactivateConsultant(consultant._id)}
                                                        title="Deactivate consultant"
                                                        disabled={consultant.isActive === false}
                                                    >
                                                        <CheckCircleIcon />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                )}
            </Container>

            {/* Team Detail Dialog */}
            <TeamDetailDialog
                open={teamDetailOpen}
                onClose={() => {
                    setTeamDetailOpen(false);
                    setSelectedTeam(null);
                    setTeamCommitments([]);
                }}
                team={selectedTeam}
                commitments={teamCommitments}
                onConsultantClick={handleConsultantClick}
            />

            {/* Consultant Detail Dialog */}
            <ConsultantDetailDialog
                open={consultantDetailOpen}
                onClose={() => {
                    setConsultantDetailOpen(false);
                    setSelectedConsultant(null);
                    setConsultantPerformance(null);
                }}
                consultant={selectedConsultant}
                performanceData={consultantPerformance}
                loading={performanceLoading}
            />

            {/* Admin Comment Dialog */}
            <AdminCommitmentDialog
                open={adminCommentDialogOpen}
                onClose={() => {
                    setAdminCommentDialogOpen(false);
                    setSelectedCommitment(null);
                }}
                commitment={selectedCommitment}
                onSave={handleSaveAdminComment}
            />

            {/* User Management Dialog */}
            <UserManagementDialog
                open={userDialogOpen}
                onClose={() => {
                    setUserDialogOpen(false);
                    setSelectedUser(null);
                }}
                onSave={handleSaveUser}
                user={selectedUser}
            />

            {/* Consultant Management Dialog */}
            <ConsultantManagementDialog
                open={consultantDialogOpen}
                onClose={() => {
                    setConsultantDialogOpen(false);
                    setSelectedConsultant(null);
                }}
                onSave={handleSaveConsultant}
                consultant={selectedConsultant}
                teamLeads={users.filter(u => u.role === 'team_lead')}
                currentUserRole={user?.role}
                currentUserTeamName={user?.teamName}
            />
        </Box>
    );
};

export default AdminDashboard;
