import React, { useState, useEffect } from 'react';
import {
    Container,
    Box,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    IconButton,
    Chip,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    AppBar,
    Toolbar,
    Menu,
    MenuItem,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import exportService from '../services/exportService';
import CommitmentFormDialog from '../components/CommitmentFormDialog';
import NotificationBell from '../components/NotificationBell';
import CommitmentFilters from '../components/CommitmentFilters';
import { LeadStageChart, AchievementChart, MeetingsChart } from '../components/Charts';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { getAchievementColor, getLeadStageColor, LEAD_STAGES_LIST, STATUS_LIST } from '../utils/constants';

const ConsultantDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();

    const [commitments, setCommitments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [selectedCommitment, setSelectedCommitment] = useState(null);
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

    // Filter commitments whenever commitments or filters change
    useEffect(() => {
        let filtered = [...commitments];

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.studentName?.toLowerCase().includes(searchLower) ||
                c.commitmentMade?.toLowerCase().includes(searchLower)
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

    const handleCreateCommitment = async (commitmentData) => {
        try {
            await commitmentService.createCommitment(commitmentData);
            loadCommitments();
            setFormOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create commitment');
        }
    };

    const handleUpdateCommitment = async (commitmentData) => {
        try {
            await commitmentService.updateCommitment(selectedCommitment._id, commitmentData);
            loadCommitments();
            setFormOpen(false);
            setSelectedCommitment(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update commitment');
        }
    };

    const handleEdit = (commitment) => {
        setSelectedCommitment(commitment);
        setFormOpen(true);
    };

    const handleCloseAdmission = async (commitment) => {
        try {
            await commitmentService.closeAdmission(commitment._id, new Date(), null);
            loadCommitments();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to close admission');
        }
    };

    const handleExportExcel = () => {
        exportService.exportCommitmentsToExcel(commitments, `my_commitments_week${weekInfo.weekNumber}`);
        setExportMenuAnchor(null);
    };

    const handleExportCSV = () => {
        const csvData = commitments.map(c => ({
            Student: c.studentName || 'N/A',
            Commitment: c.commitmentMade,
            'Lead Stage': c.leadStage,
            'Meetings': c.meetingsDone || 0,
            'Achievement %': c.achievementPercentage || 0,
            Status: c.status,
        }));
        exportService.exportToCSV(csvData, `my_commitments_week${weekInfo.weekNumber}`);
        setExportMenuAnchor(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Calculate metrics (use filtered commitments for display)
    const displayCommitments = filteredCommitments.length > 0 || filters.search || filters.stage || filters.status
        ? filteredCommitments
        : commitments;

    const totalCommitments = commitments.length;
    const achievedCommitments = commitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = commitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const closedAdmissions = commitments.filter(c => c.admissionClosed).length;
    const achievementRate = totalCommitments > 0 ? Math.round((achievedCommitments / totalCommitments) * 100) : 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* App Bar */}
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Team Progress Tracker - Consultant Dashboard
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
                        {user?.name}
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
                        My Dashboard
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

                {/* Metrics Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    My Commitments
                                </Typography>
                                <Typography variant="h3">{totalCommitments}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Achievement Rate
                                </Typography>
                                <Typography
                                    variant="h3"
                                    sx={{ color: getAchievementColor(achievementRate) }}
                                >
                                    {achievementRate}%
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Meetings Done
                                </Typography>
                                <Typography variant="h3">{totalMeetings}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography color="text.secondary" gutterBottom>
                                    Admissions Closed
                                </Typography>
                                <Typography variant="h3" sx={{ color: '#4CAF50' }}>
                                    {closedAdmissions}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Analytics Charts */}
                {commitments.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                            Analytics
                        </Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <LeadStageChart commitments={commitments} />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <MeetingsChart commitments={commitments} />
                            </Grid>
                            <Grid item xs={12}>
                                <AchievementChart commitments={commitments.slice(0, 10)} />
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* Quick Add Button */}
                <Box sx={{ mb: 3 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => {
                            setSelectedCommitment(null);
                            setFormOpen(true);
                        }}
                        size="large"
                    >
                        Add New Commitment
                    </Button>
                </Box>

                {/* Commitments Table */}
                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Current Week Commitments
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
                                    No commitments for this week. Click "Add New Commitment" to get started!
                                </Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Student</TableCell>
                                            <TableCell>Commitment</TableCell>
                                            <TableCell>Lead Stage</TableCell>
                                            <TableCell align="center">Probability</TableCell>
                                            <TableCell align="center">Meetings</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="center">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayCommitments.map((commitment) => (
                                            <TableRow key={commitment._id}>
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
                                                    {commitment.conversionProbability}%
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
                                                        onClick={() => handleEdit(commitment)}
                                                        color="primary"
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                    {!commitment.admissionClosed && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleCloseAdmission(commitment)}
                                                            color="success"
                                                            title="Mark as Closed"
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
                        )}
                    </CardContent>
                </Card>
            </Container>

            {/* Commitment Form Dialog */}
            <CommitmentFormDialog
                open={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setSelectedCommitment(null);
                }}
                onSubmit={selectedCommitment ? handleUpdateCommitment : handleCreateCommitment}
                initialData={selectedCommitment}
            />
        </Box>
    );
};

export default ConsultantDashboard;
