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
    IconButton,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    AppBar,
    Toolbar,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Menu,
    MenuItem,
} from '@mui/material';
import {
    Edit as EditIcon,
    Logout as LogoutIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import exportService from '../services/exportService';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import { ConsultantPerformanceChart, LeadStageChart, WeeklyTrendChart } from '../components/Charts';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { getLeadStageColor, getAchievementColor, LEAD_STAGES_LIST, STATUS_LIST } from '../utils/constants';

const TeamLeadDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();

    const [commitments, setCommitments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCommitment, setSelectedCommitment] = useState(null);
    const [correctiveDialogOpen, setCorrectiveDialogOpen] = useState(false);
    const [correctiveAction, setCorrectiveAction] = useState('');
    const [prospectRating, setProspectRating] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
    const [filteredCommitments, setFilteredCommitments] = useState([]);
    const [filters, setFilters] = useState({ search: '', stage: '', status: '' });

    // Load commitments
    const loadCommitments = async () => {
        try {
            setLoading(true);
            const data = await commitmentService.getCurrentWeekCommitments();
            setCommitments(data.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load commitments');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCommitments();
    }, []);

    // Filter commitments
    useEffect(() => {
        let filtered = [...commitments];

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.studentName?.toLowerCase().includes(searchLower) ||
                c.commitmentMade?.toLowerCase().includes(searchLower) ||
                c.consultant?.name?.toLowerCase().includes(searchLower)
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

    const handleOpenCorrective = (commitment) => {
        setSelectedCommitment(commitment);
        setCorrectiveAction(commitment.correctiveActionByTL || '');
        setProspectRating(commitment.prospectForWeek || '');
        setCorrectiveDialogOpen(true);
    };

    const handleSaveCorrective = async () => {
        try {
            await commitmentService.updateCommitment(selectedCommitment._id, {
                correctiveActionByTL: correctiveAction,
                prospectForWeek: prospectRating ? parseInt(prospectRating) : null,
            });
            loadCommitments();
            setCorrectiveDialogOpen(false);
            setSelectedCommitment(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update commitment');
        }
    };

    const handleExportExcel = () => {
        exportService.exportCommitmentsToExcel(commitments, `team_commitments_week${weekInfo.weekNumber}`);
        setExportMenuAnchor(null);
    };

    const handleExportCSV = () => {
        const csvData = commitments.map(c => ({
            Consultant: c.consultant?.name || 'N/A',
            Student: c.studentName || 'N/A',
            Commitment: c.commitmentMade,
            'Lead Stage': c.leadStage,
            'Achievement %': c.achievementPercentage || 0,
            Meetings: c.meetingsDone || 0,
            Status: c.status,
        }));
        exportService.exportToCSV(csvData, `team_commitments_week${weekInfo.weekNumber}`);
        setExportMenuAnchor(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Display commitments
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status
        ? filteredCommitments
        : commitments;

    // Group commitments by consultant
    const consultantGroups = commitments.reduce((groups, commitment) => {
        const consultantId = commitment.consultant._id;
        if (!groups[consultantId]) {
            groups[consultantId] = {
                consultant: commitment.consultant,
                commitments: [],
            };
        }
        groups[consultantId].commitments.push(commitment);
        return groups;
    }, {});

    const consultantStats = Object.values(consultantGroups).map(group => {
        const total = group.commitments.length;
        const achieved = group.commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
        const meetings = group.commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
        const closed = group.commitments.filter(c => c.admissionClosed).length;
        const achievementRate = total > 0 ? Math.round((achieved / total) * 100) : 0;

        return {
            consultant: group.consultant,
            total,
            achieved,
            meetings,
            closed,
            achievementRate,
            commitments: group.commitments,
        };
    });

    // Overall team metrics
    const totalCommitments = commitments.length;
    const totalAchieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;
    const teamAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Team Progress Tracker - Team Lead Dashboard
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
                        {user?.name} ({user?.teamName})
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
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom>
                        Team Dashboard - {user?.teamName}
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

                {/* Team Metrics Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Total Commitments
                                </Typography>
                                <Typography variant="h3">{totalCommitments}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Team Achievement
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{ color: getAchievementColor(teamAchievementRate) }}
                                >
                                    {teamAchievementRate}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Total Meetings
                                </Typography>
                                <Typography variant="h3">{totalMeetings}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Admissions Closed
                                </Typography>
                                <Typography variant="h3" sx={{ color: '#4CAF50' }}>
                                    {totalClosed}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Analytics Charts */}
                {commitments.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                            Team Analytics
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <LeadStageChart commitments={commitments} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <ConsultantPerformanceChart consultantStats={consultantStats} />
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                        <Tab label="Team Overview" />
                        <Tab label="All Commitments" />
                    </Tabs>
                </Box>

                {/* Tab Content */}
                {tabValue === 0 && (
                    // Team Overview Tab
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                            Consultant Performance
                        </Typography>
                        <Grid container spacing={3}>
                            {consultantStats.map(stat => (
                                <Grid item xs={12} md={6} lg={4} key={stat.consultant._id}>
                                    <Card elevation={2}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>
                                                {stat.consultant.name}
                                            </Typography>
                                            <Grid container spacing={2}>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Commitments
                                                    </Typography>
                                                    <Typography variant="h4">{stat.total}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Achievement
                                                    </Typography>
                                                    <Typography
                                                        variant="h4"
                                                        sx={{ color: getAchievementColor(stat.achievementRate) }}
                                                    >
                                                        {stat.achievementRate}%
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Meetings
                                                    </Typography>
                                                    <Typography variant="h5">{stat.meetings}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Closed
                                                    </Typography>
                                                    <Typography variant="h5" sx={{ color: '#4CAF50' }}>
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

                {tabValue === 1 && (
                    // All Commitments Tab
                    <Card elevation={2}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                All Team Commitments
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
                                            ? 'No commitments for this week.'
                                            : 'No commitments match your filters.'}
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
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
                                                <TableRow key={commitment._id}>
                                                    <TableCell>{commitment.consultant.name}</TableCell>
                                                    <TableCell>{commitment.studentName || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
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
                                                            sx={{ color: getAchievementColor(commitment.achievementPercentage || 0) }}
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
                                                            onClick={() => handleOpenCorrective(commitment)}
                                                            color="primary"
                                                            title="Add Corrective Action"
                                                        >
                                                            <EditIcon />
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
            </Container>

            {/* Corrective Action Dialog */}
            <Dialog
                open={correctiveDialogOpen}
                onClose={() => setCorrectiveDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Add Corrective Action</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Consultant: {selectedCommitment?.consultant.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                            Commitment: {selectedCommitment?.commitmentMade}
                        </Typography>

                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Corrective Action"
                            value={correctiveAction}
                            onChange={(e) => setCorrectiveAction(e.target.value)}
                            placeholder="Enter corrective action or guidance for this commitment"
                            sx={{ mb: 2 }}
                        />

                        <TextField
                            fullWidth
                            type="number"
                            label="Prospect Rating (1-10)"
                            value={prospectRating}
                            onChange={(e) => setProspectRating(e.target.value)}
                            inputProps={{ min: 1, max: 10 }}
                            helperText="Rate the prospect potential for this week"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCorrectiveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveCorrective} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default TeamLeadDashboard;
