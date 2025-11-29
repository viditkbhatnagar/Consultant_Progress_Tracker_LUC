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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import { getUsers } from '../services/authService';
import exportService from '../services/exportService';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import DateRangeSelector from '../components/DateRangeSelector';
import TeamDetailDialog from '../components/TeamDetailDialog';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import TeamHierarchyView from '../components/TeamHierarchyView';
import ActivityHeatmap from '../components/ActivityHeatmap';
import AdminCommitmentDialog from '../components/AdminCommitmentDialog';
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
    const [filters, setFilters] = useState({ search: '', stage: '', status: '' });

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
            const userData = await getUsers();
            setUsers(userData.data || []);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

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

    // Display commitments
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status
        ? filteredCommitments
        : commitments;

    // Organize teams
    const teamLeads = users.filter(u => u.role === 'team_lead');
    const admins = users.filter(u => u.role === 'admin');

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
                                                <TableCell>Team</TableCell>
                                                <TableCell>Consultant</TableCell>
                                                <TableCell>Student</TableCell>
                                                <TableCell>Commitment</TableCell>
                                                <TableCell>Lead Stage</TableCell>
                                                <TableCell align="center">Achievement</TableCell>
                                                <TableCell align="center">Meetings</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {displayCommitments.map((commitment) => (
                                                <TableRow key={commitment._id} hover>
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
                                                            sx={{ color: getAchievementColor(commitment.achievementPercentage || 0), fontWeight: 600 }}
                                                        >
                                                            {commitment.achievementPercentage || 0}%
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
                                                </TableRow>
                                            ))}
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
        </Box>
    );
};

export default AdminDashboard;
