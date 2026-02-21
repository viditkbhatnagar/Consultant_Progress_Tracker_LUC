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
    Close as CloseIcon,
    TrendingUp as TrendingUpIcon,
    AddCircleOutline as AddCircleIcon,
    Person as PersonIcon,
    Add as AddIcon,
    Visibility as VisibilityIcon,
    Comment as CommentIcon,
    AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import exportService from '../services/exportService';
import consultantService from '../services/consultantService';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import DateRangeSelector from '../components/DateRangeSelector';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import TeamLeadCommitmentDialog from '../components/TeamLeadCommitmentDialog';
import ConsultantManagementDialog from '../components/ConsultantManagementDialog';
import Sidebar, { DRAWER_WIDTH } from '../components/Sidebar';
import AISummaryCard from '../components/AISummaryCard';
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

    // Consultant management state
    const [consultants, setConsultants] = useState([]);
    const [consultantDialogOpen, setConsultantDialogOpen] = useState(false);
    const [selectedConsultantForEdit, setSelectedConsultantForEdit] = useState(null);
    const [filters, setFilters] = useState({ search: '', stage: '', status: '', consultant: '' });

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
            if (!dateRange.startDate || !dateRange.endDate) return;
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
    const handleSaveConsultant = async (consultantData) => {
        try {
            if (selectedConsultantForEdit) {
                await consultantService.updateConsultant(selectedConsultantForEdit._id, consultantData);
            } else {
                await consultantService.createConsultant(consultantData);
            }
            await loadConsultants();
            setConsultantDialogOpen(false);
            setSelectedConsultantForEdit(null);
        } catch (err) {
            console.error('Failed to save consultant:', err);
            throw err;
        }
    };

    const handleDeactivateConsultant = async (consultantId) => {
        if (window.confirm('Are you sure you want to deactivate this consultant?')) {
            try {
                await consultantService.deleteConsultant(consultantId);
                await loadConsultants();
            } catch (err) {
                console.error('Failed to deactivate consultant:', err);
            }
        }
    };

    useEffect(() => {
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
                c.consultant?.name?.toLowerCase().includes(searchLower)
            );
        }

        if (filters.stage) {
            filtered = filtered.filter(c => c.leadStage === filters.stage);
        }

        if (filters.status) {
            filtered = filtered.filter(c => c.status === filters.status);
        }

        if (filters.consultant) {
            filtered = filtered.filter(c => {
                const consultantName = c.consultantName || c.consultant?.name || '';
                return consultantName.trim() === filters.consultant.trim();
            });
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
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status || filters.consultant
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

    // Extract unique consultants for form dropdown - use actual consultants, not stats
    const teamConsultants = consultants.map(consultant => ({
        name: consultant.name,
        _id: consultant._id,
    }));


    // Overall team metrics
    const totalCommitments = commitments.length;
    const totalAchieved = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = commitments.filter(c => c.admissionClosed).length;
    const teamAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#A0D2EB' }}>
            {/* Sidebar */}
            <Sidebar
                onAddCommitment={handleAddCommitment}
                onExport={setExportMenuAnchor}
                onLogout={handleLogout}
                onAIAnalysis={() => setTabValue(2)}
                onDashboard={() => setTabValue(0)}
                aiAnalysisActive={tabValue === 2}
            />

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: `calc(100% - ${DRAWER_WIDTH}px)`,
                    backgroundColor: '#A0D2EB', // Light Blue
                    minHeight: '100vh',
                }}
            >
                {/* Export Menu */}
                <Menu
                    anchorEl={exportMenuAnchor}
                    open={Boolean(exportMenuAnchor)}
                    onClose={() => setExportMenuAnchor(null)}
                >
                    <MenuItem onClick={handleExportExcel}>Export to Excel</MenuItem>
                    <MenuItem onClick={handleExportCSV}>Export to CSV</MenuItem>
                </Menu>

                <Container maxWidth="xl" sx={{ py: 2 }}>
                    {/* Header */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" gutterBottom sx={{ color: '#2C3E50', fontWeight: 700 }}>
                            Team Dashboard - {user?.teamName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#34495E', opacity: 0.9 }}>
                            {formatWeekDisplay(weekInfo.weekNumber, weekInfo.year, weekInfo.weekStartDate, weekInfo.weekEndDate)}
                        </Typography>
                    </Box>

                    {/* Date Range Selector */}
                    <Card elevation={0} sx={{ mb: 3, backgroundColor: '#E5EAF5', borderRadius: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                        <Card
                            elevation={0}
                            sx={{
                                flex: '1 1 220px',
                                minWidth: 220,
                                background: '#E5EAF5',
                                color: '#2C3E50',
                                borderRadius: 3,
                                boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Typography sx={{ opacity: 0.95, mb: 1, fontWeight: 600 }}>
                                    Total Commitments
                                </Typography>
                                <Typography variant="h2" sx={{ fontWeight: 700, mb: 0.5 }}>{totalCommitments}</Typography>
                                <Typography sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                                    {consultantStatsArray.length} Consultants
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card
                            elevation={0}
                            sx={{
                                flex: '1 1 220px',
                                minWidth: 220,
                                background: '#E5EAF5',
                                color: '#2C3E50',
                                borderRadius: 3,
                                boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Typography sx={{ opacity: 0.95, mb: 1, fontWeight: 600 }}>
                                    Team Achievement
                                </Typography>
                                <Typography variant="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    {teamAchievementRate}%
                                </Typography>
                                <Typography sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                                    {totalAchieved} of {totalCommitments} achieved
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card
                            elevation={0}
                            sx={{
                                flex: '1 1 220px',
                                minWidth: 220,
                                background: '#E5EAF5',
                                color: '#2C3E50',
                                borderRadius: 3,
                                boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Typography sx={{ opacity: 0.95, mb: 1, fontWeight: 600 }}>
                                    Total Meetings
                                </Typography>
                                <Typography variant="h2" sx={{ fontWeight: 700, mb: 0.5 }}>{totalMeetings}</Typography>
                                <Typography sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                                    Across all consultants
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card
                            elevation={0}
                            sx={{
                                flex: '1 1 220px',
                                minWidth: 220,
                                background: '#E5EAF5',
                                color: '#2C3E50',
                                borderRadius: 3,
                                boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Typography sx={{ opacity: 0.95, mb: 1, fontWeight: 600 }}>
                                    Admissions Closed
                                </Typography>
                                <Typography variant="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    {totalClosed}
                                </Typography>
                                <Typography sx={{ opacity: 0.9, fontSize: '0.875rem' }}>
                                    Successful conversions
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Analytics Charts and Heatmap */}
                    {commitments.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 700, color: '#2C3E50' }}>
                                Team Analytics
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {/* Charts Row */}
                                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                    <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
                                        <LeadStageChart commitments={commitments} />
                                    </Box>
                                    <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
                                        <Card elevation={0} sx={{ height: '100%', backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                                            <CardContent sx={{ p: 3 }}>
                                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                                                    Consultant Performance
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {consultantStatsArray.map(stat => (
                                                        <Box key={stat.consultant}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                    {stat.consultant}
                                                                </Typography>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{ color: getAchievementColor(stat.achievementRate), fontWeight: 700 }}
                                                                >
                                                                    {stat.achievementRate}%
                                                                </Typography>
                                                            </Box>
                                                            <Box
                                                                sx={{
                                                                    height: 10,
                                                                    bgcolor: 'grey.100',
                                                                    borderRadius: 5,
                                                                    overflow: 'hidden',
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        height: '100%',
                                                                        width: `${stat.achievementRate}%`,
                                                                        background: stat.achievementRate >= 70
                                                                            ? 'linear-gradient(90deg, #11998e 0%, #38ef7d 100%)'
                                                                            : stat.achievementRate >= 40
                                                                                ? 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)'
                                                                                : 'linear-gradient(90deg, #eb3349 0%, #f45c43 100%)',
                                                                        borderRadius: 5,
                                                                        transition: 'width 0.5s ease',
                                                                    }}
                                                                />
                                                            </Box>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {stat.total} commitments • {stat.meetings} meetings • {stat.closed} closed
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                            <Tab label="Team Overview" />
                            <Tab label="All Commitments" />
                            <Tab label="AI Analysis" icon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    {tabValue === 0 && (
                        // Team Overview Tab
                        <Box>
                            {/* Consultant Management Card */}
                            <Card sx={{ mb: 3, backgroundColor: '#E5EAF5', borderRadius: 3 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="h6">My Team Consultants</Typography>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<AddIcon />}
                                            onClick={() => {
                                                setSelectedConsultantForEdit(null);
                                                setConsultantDialogOpen(true);
                                            }}
                                        >
                                            Add Consultant
                                        </Button>
                                    </Box>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Email</TableCell>
                                                    <TableCell>Phone</TableCell>
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
                                                                onClick={() => {
                                                                    setSelectedConsultantForEdit(consultant);
                                                                    setConsultantDialogOpen(true);
                                                                }}
                                                                title="Edit consultant"
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDeactivateConsultant(consultant._id)}
                                                                title="Deactivate consultant"
                                                                disabled={consultant.isActive === false}
                                                            >
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>

                            <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                                Consultant Performance - Click to View Details
                            </Typography>
                            <Grid container spacing={3}>
                                {consultantStatsArray.map(stat => (
                                    <Grid item xs={12} sm={6} lg={4} key={stat.consultant}>
                                        <Card
                                            elevation={0}
                                            sx={{
                                                height: '100%',
                                                backgroundColor: '#E5EAF5',
                                                borderRadius: 3,
                                                boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)',
                                                transition: 'all 0.3s ease',
                                                '&:hover': {
                                                    transform: 'translateY(-8px)',
                                                    boxShadow: '0 8px 24px rgba(160, 210, 235, 0.4)',
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
                        <Card elevation={0} sx={{ backgroundColor: '#E5EAF5', borderRadius: 3, boxShadow: '0 2px 8px rgba(229, 234, 245, 0.3)' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                    All Team Commitments
                                </Typography>

                                <CommitmentFilters
                                    onFilterChange={handleFilterChange}
                                    leadStages={LEAD_STAGES_LIST}
                                    statuses={STATUS_LIST}
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
                                                    <TableCell>Consultant</TableCell>
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
                                                                    <Chip
                                                                        label={commitment.status}
                                                                        size="small"
                                                                        variant="outlined"
                                                                    />
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

                                                            {/* Admin Comments - Display only */}
                                                            <TableCell align="center">
                                                                {commitment.adminComment ? (
                                                                    <Typography variant="body2" sx={{ maxWidth: 150 }} noWrap title={commitment.adminComment}>
                                                                        {commitment.adminComment}
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">--</Typography>
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

                    {/* AI Analysis Tab */}
                    {tabValue === 2 && (
                        <AISummaryCard />
                    )}

                </Container>
            </Box>

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
                onEditCommitment={handleEditCommitment}
                onOpenTLComment={(commitment) => {
                    setSelectedCommitment(commitment);
                    setCorrectiveAction(commitment.correctiveActionByTL || '');
                    setCorrectiveDialogOpen(true);
                }}
                userRole="team_lead"
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

            {/* Consultant Management Dialog */}
            <ConsultantManagementDialog
                open={consultantDialogOpen}
                onClose={() => {
                    setConsultantDialogOpen(false);
                    setSelectedConsultantForEdit(null);
                }}
                onSave={handleSaveConsultant}
                consultant={selectedConsultantForEdit}
                teamLeads={[]}
                currentUserRole="team_lead"
                currentUserTeamName={user?.teamName}
            />
        </Box>
    );
};

export default TeamLeadDashboard;
