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
    CardActionArea,
    Avatar,
    Tooltip,
} from '@mui/material';
import {
    Edit as EditIcon,
    Logout as LogoutIcon,
    Download as DownloadIcon,
    CheckCircle as CheckCircleIcon,
    TrendingUp as TrendingUpIcon,
    Person as PersonIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon,
    Comment as CommentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import exportService from '../services/exportService';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import DateRangeSelector from '../components/DateRangeSelector';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import ActivityHeatmap from '../components/ActivityHeatmap';
import TeamLeadCommitmentDialog from '../components/TeamLeadCommitmentDialog';
import { ConsultantPerformanceChart, LeadStageChart } from '../components/Charts';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { getLeadStageColor, getAchievementColor, LEAD_STAGES_LIST, STATUS_LIST } from '../utils/constants';
import { startOfWeek, endOfWeek, format } from 'date-fns';

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

    // Consultant detail dialog state
    const [selectedConsultant, setSelectedConsultant] = useState(null);
    const [consultantDetailOpen, setConsultantDetailOpen] = useState(false);
    const [consultantPerformance, setConsultantPerformance] = useState(null);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    // Commitment form dialog state
    const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
    const [editingCommitment, setEditingCommitment] = useState(null);

    // Load commitments by date range - use useCallback to fix dependency warning
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

    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange);
    };

    const handleConsultantClick = async (consultant) => {
        setSelectedConsultant(consultant);
        setConsultantDetailOpen(true);
        setPerformanceLoading(true);

        try {
            // Use consultant name instead of ID
            const consultantName = typeof consultant === 'string' ? consultant : consultant.name;
            const data = await commitmentService.getConsultantPerformance(consultantName, 3);
            setConsultantPerformance(data);
        } catch (err) {
            setError('Failed to load consultant performance');
        } finally {
            setPerformanceLoading(false);
        }
    };



    const handleSaveCorrective = async () => {
        try {
            await commitmentService.updateCommitment(selectedCommitment._id, {
                correctiveActionByTL: correctiveAction,
            });
            loadCommitments();
            setCorrectiveDialogOpen(false);
            setSelectedCommitment(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update commitment');
        }
    };

    const handleExportExcel = () => {
        const periodLabel = dateRange.viewType.replace('-', '_');
        exportService.exportCommitmentsToExcel(commitments, `team_commitments_${periodLabel}`);
        setExportMenuAnchor(null);
    };

    const handleExportCSV = () => {
        const csvData = commitments.map(c => ({
            Consultant: c.consultantName || 'N/A',
            Student: c.studentName || 'N/A',
            Commitment: c.commitmentMade,
            'Lead Stage': c.leadStage,
            'Achievement %': c.achievementPercentage || 0,
            Meetings: c.meetingsDone || 0,
            Status: c.status,
            Week: `W${c.weekNumber}`,
        }));
        const periodLabel = dateRange.viewType.replace('-', '_');
        exportService.exportToCSV(csvData, `team_commitments_${periodLabel}`);
        setExportMenuAnchor(null);
    };

    const handleAddCommitment = () => {
        setEditingCommitment(null);
        setCommitmentDialogOpen(true);
    };

    const handleEditCommitment = (commitment) => {
        setEditingCommitment(commitment);
        setCommitmentDialogOpen(true);
    };

    const handleSaveCommitment = async (commitmentData) => {
        try {
            if (editingCommitment) {
                // Update existing commitment
                await commitmentService.updateCommitment(editingCommitment._id, commitmentData);
            } else {
                // Create new commitment
                await commitmentService.createCommitment(commitmentData);
            }

            // Reload commitments
            await loadCommitments();

            // If consultant detail dialog is open, refresh its data to show the new/updated commitment
            if (consultantDetailOpen && selectedConsultant) {
                setPerformanceLoading(true);
                try {
                    const consultantName = typeof selectedConsultant === 'string' ? selectedConsultant : selectedConsultant.name;
                    const data = await commitmentService.getConsultantPerformance(consultantName, 3);
                    setConsultantPerformance(data);
                } catch (err) {
                    console.error('Failed to refresh consultant performance:', err);
                } finally {
                    setPerformanceLoading(false);
                }
            }

            // Close the commitment dialog
            setCommitmentDialogOpen(false);
            setEditingCommitment(null);
        } catch (err) {
            console.error('Error saving commitment:', err);
            setError('Failed to save commitment');
        }
    };
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Display commitments
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status
        ? filteredCommitments
        : commitments;

    // Calculate consultant stats
    const consultantStats = commitments.reduce((acc, commitment) => {
        const consultantName = commitment.consultantName || 'Unknown';

        if (!acc[consultantName]) {
            acc[consultantName] = {
                consultant: consultantName, // Store name as string
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

    const consultantStatsArray = Object.values(consultantStats).map(stat => ({
        ...stat,
        achievementRate: stat.total > 0 ? Math.round((stat.achieved / stat.total) * 100) : 0,
    }));

    // Extract unique consultants for form dropdown
    const teamConsultants = consultantStatsArray.map(stat => ({
        name: stat.consultant,
    }));


    // Overall team metrics
    const totalCommitments = commitments.length;
    const totalAchieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;
    const teamAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Team Progress Tracker - Team Lead Dashboard
                    </Typography>
                    <Button
                        color="inherit"
                        startIcon={<AddIcon />}
                        onClick={handleAddCommitment}
                        sx={{ mr: 2 }}
                    >
                        Add Commitment
                    </Button>
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
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" gutterBottom>
                        Team Dashboard - {user?.teamName}
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

                {/* Team Metrics Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Total Commitments
                                </Typography>
                                <Typography variant="h3" sx={{ fontWeight: 700 }}>{totalCommitments}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom variant="subtitle2">
                                    Team Achievement
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{ color: getAchievementColor(teamAchievementRate), fontWeight: 700 }}
                                >
                                    {teamAchievementRate}%
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
                            Team Analytics
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} lg={6}>
                                <LeadStageChart commitments={commitments} />
                            </Grid>
                            <Grid item xs={12} lg={6}>
                                <ConsultantPerformanceChart consultantStats={consultantStatsArray} />
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
                        <Tab label="Team Overview" />
                        <Tab label="All Commitments" />
                    </Tabs>
                </Box>

                {/* Tab Content */}
                {tabValue === 0 && (
                    // Team Overview Tab
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                            Consultant Performance - Click to View Details
                        </Typography>
                        <Grid container spacing={3}>
                            {consultantStatsArray.map(stat => (
                                <Grid item xs={12} sm={6} lg={4} key={stat.consultant}>
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
                                        <CardActionArea onClick={() => handleConsultantClick(stat.consultant)}>
                                            <CardContent>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                                                            <PersonIcon />
                                                        </Avatar>
                                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                            {stat.consultant}
                                                        </Typography>
                                                    </Box>
                                                    <IconButton size="small" color="primary">
                                                        <TrendingUpIcon />
                                                    </IconButton>
                                                </Box>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Commitments
                                                        </Typography>
                                                        <Typography variant="h4" sx={{ fontWeight: 600 }}>{stat.total}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Achievement
                                                        </Typography>
                                                        <Typography
                                                            variant="h4"
                                                            sx={{ color: getAchievementColor(stat.achievementRate), fontWeight: 600 }}
                                                        >
                                                            {stat.achievementRate}%
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Meetings
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 600 }}>{stat.meetings}</Typography>
                                                    </Grid>
                                                    <Grid item xs={6}>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            Closed
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                                                            {stat.closed}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                                <Box sx={{ mt: 2, textAlign: 'center' }}>
                                                    <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                                                        Click to view full details →
                                                    </Typography>
                                                </Box>
                                            </CardContent>
                                        </CardActionArea>
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
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
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
                                                <TableCell>Consultant</TableCell>
                                                <TableCell>Student</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell>Lead Stage</TableCell>
                                                <TableCell align="center">Probability</TableCell>
                                                <TableCell align="center">Achievement</TableCell>
                                                <TableCell align="center">Meetings</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="center">TL Comments</TableCell>
                                                <TableCell align="center">Admin Comments</TableCell>
                                                <TableCell align="center">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {displayCommitments.map((commitment) => {
                                                // Calculate simple achievement: 100% if admission closed, else 0%
                                                const achievement = commitment.admissionClosed ? 100 : 0;
                                                const commitmentDate = new Date(commitment.weekStartDate);
                                                const dayOfWeek = format(commitmentDate, 'EEEE');
                                                const dateFormatted = format(commitmentDate, 'MMM dd, yyyy');
                                                const timeFormatted = format(commitment.createdAt ? new Date(commitment.createdAt) : commitmentDate, 'hh:mm a');

                                                return (
                                                    <TableRow key={commitment._id} hover>
                                                        {/* Week */}
                                                        <TableCell>W{commitment.weekNumber}</TableCell>

                                                        {/* Date */}
                                                        <TableCell>{dateFormatted}</TableCell>

                                                        {/* Day */}
                                                        <TableCell>{dayOfWeek}</TableCell>

                                                        {/* Time */}
                                                        <TableCell>{timeFormatted}</TableCell>

                                                        {/* Consultant */}
                                                        <TableCell>{commitment.consultantName}</TableCell>

                                                        {/* Student */}
                                                        <TableCell>{commitment.studentName || 'N/A'}</TableCell>

                                                        {/* Description (renamed from Commitment) */}
                                                        <TableCell>
                                                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                                {commitment.commitmentMade}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Lead Stage */}
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

                                                        {/* Conversion Probability */}
                                                        <TableCell align="center">
                                                            <Typography
                                                                sx={{
                                                                    color:
                                                                        (commitment.conversionProbability || 0) >= 70 ? 'success.main' :
                                                                            (commitment.conversionProbability || 0) >= 40 ? 'warning.main' : 'error.main',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {commitment.conversionProbability || 0}%
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Achievement - Simplified: 100% if closed, 0% otherwise */}
                                                        <TableCell align="center">
                                                            <Typography
                                                                sx={{
                                                                    color: achievement === 100 ? 'success.main' : 'text.secondary',
                                                                    fontWeight: 600
                                                                }}
                                                            >
                                                                {achievement}%
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Meetings */}
                                                        <TableCell align="center">
                                                            {commitment.meetingsDone || 0}
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
                                                                <Chip
                                                                    label={commitment.status}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            )}
                                                        </TableCell>

                                                        {/* TL Comments - Action button: Eye if exists, Comment icon if not */}
                                                        <TableCell align="center">
                                                            {commitment.correctiveActionByTL ? (
                                                                <Tooltip
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
                                                                        onClick={() => {
                                                                            setSelectedCommitment(commitment);
                                                                            setCorrectiveAction(commitment.correctiveActionByTL || '');

                                                                            setCorrectiveDialogOpen(true);
                                                                        }}
                                                                        title="View/Edit TL comment"
                                                                    >
                                                                        <VisibilityIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                <IconButton
                                                                    size="small"
                                                                    color="action"
                                                                    onClick={() => {
                                                                        setSelectedCommitment(commitment);
                                                                        setCorrectiveAction('');

                                                                        setCorrectiveDialogOpen(true);
                                                                    }}
                                                                    title="Add TL comment"
                                                                >
                                                                    <CommentIcon fontSize="small" />
                                                                </IconButton>
                                                            )}
                                                        </TableCell>

                                                        {/* Actions - Edit for both consultants and TLs */}
                                                        <TableCell align="center">
                                                            <IconButton
                                                                size="small"
                                                                color="primary"
                                                                onClick={() => handleEditCommitment(commitment)}
                                                                title="Edit commitment"
                                                            >
                                                                <EditIcon fontSize="small" />
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
                            Consultant: {selectedCommitment?.consultantName}
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

                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCorrectiveDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveCorrective} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

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

            {/* Add/Edit Commitment Dialog */}
            <TeamLeadCommitmentDialog
                open={commitmentDialogOpen}
                onClose={() => {
                    setCommitmentDialogOpen(false);
                    setEditingCommitment(null);
                }}
                onSave={handleSaveCommitment}
                commitment={editingCommitment}
                teamConsultants={teamConsultants}
                user={user}
            />
        </Box>
    );
};

export default TeamLeadDashboard;
