import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
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
} from '@mui/material';
import {
    Edit as EditIcon,
    Close as CloseIcon,
    Add as AddIcon,
    AutoAwesome as AutoAwesomeIcon,
    FactCheck as CommitmentsIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import consultantService from '../services/consultantService';
import DateRangeSelector from '../components/DateRangeSelector';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import TeamLeadCommitmentDialog from '../components/TeamLeadCommitmentDialog';
import ConsultantManagementDialog from '../components/ConsultantManagementDialog';
import Sidebar from '../components/Sidebar';
import AISummaryCard from '../components/AISummaryCard';
import { LeadStageChart } from '../components/Charts';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import { startOfWeek, endOfWeek, format } from 'date-fns';

import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import SectionCard from '../components/dashboard/SectionCard';
import KPIStrip from '../components/dashboard/KPIStrip';
import DashboardTabs, { AnimatedTabPanel } from '../components/dashboard/DashboardTabs';
import PerformerCard from '../components/dashboard/PerformerCard';
import PerformerGrid from '../components/dashboard/PerformerGrid';
import ProgressBar from '../components/dashboard/ProgressBar';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import { riseVariants, useReducedMotionVariants } from '../utils/dashboardMotion';

const TeamLeadDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();
    const themeState = useDashboardThemeState('dashboard-theme-mode');
    const riseV = useReducedMotionVariants(riseVariants);

    const [commitments, setCommitments] = useState([]);
    const [error, setError] = useState('');
    const [selectedCommitment, setSelectedCommitment] = useState(null);
    const [correctiveDialogOpen, setCorrectiveDialogOpen] = useState(false);
    const [correctiveAction, setCorrectiveAction] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const [filteredCommitments, setFilteredCommitments] = useState([]);
    const [filters] = useState({ search: '', stage: '', status: '', consultant: '' });

    const [consultants, setConsultants] = useState([]);
    const [consultantDialogOpen, setConsultantDialogOpen] = useState(false);
    const [selectedConsultantForEdit, setSelectedConsultantForEdit] = useState(null);

    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    const [selectedConsultant, setSelectedConsultant] = useState(null);
    const [consultantDetailOpen, setConsultantDetailOpen] = useState(false);
    const [consultantPerformance, setConsultantPerformance] = useState(null);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
    const [editingCommitment, setEditingCommitment] = useState(null);

    const loadCommitments = useCallback(async () => {
        try {
            if (!dateRange.startDate || !dateRange.endDate) return;
            const data = await commitmentService.getCommitmentsByDateRange(
                dateRange.startDate,
                dateRange.endDate
            );
            setCommitments(data.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load commitments');
        }
    }, [dateRange.startDate, dateRange.endDate]);

    const loadConsultants = useCallback(async () => {
        try {
            const response = await consultantService.getConsultants();
            setConsultants(response.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, []);

    const handleSaveConsultant = async (consultantData) => {
        if (selectedConsultantForEdit) {
            await consultantService.updateConsultant(selectedConsultantForEdit._id, consultantData);
        } else {
            await consultantService.createConsultant(consultantData);
        }
        await loadConsultants();
        setConsultantDialogOpen(false);
        setSelectedConsultantForEdit(null);
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

    useEffect(() => {
        let filtered = [...commitments];
        if (filters.search) {
            const s = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.studentName?.toLowerCase().includes(s) ||
                c.commitmentMade?.toLowerCase().includes(s) ||
                c.consultantName?.toLowerCase().includes(s)
            );
        }
        if (filters.stage) filtered = filtered.filter(c => c.leadStage === filters.stage);
        if (filters.status) filtered = filtered.filter(c => c.status === filters.status);
        if (filters.consultant) {
            filtered = filtered.filter(c => (c.consultantName || '').trim() === filters.consultant.trim());
        }
        setFilteredCommitments(filtered);
    }, [commitments, filters]);

    const handleDateRangeChange = (newRange) => {
        setDateRange(newRange);
    };

    const handleConsultantClick = async (consultant) => {
        setSelectedConsultant(consultant);
        setConsultantDetailOpen(true);
        setPerformanceLoading(true);
        try {
            const consultantName = typeof consultant === 'string' ? consultant : consultant.name;
            const data = await commitmentService.getConsultantPerformance(consultantName, {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            });
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

    const displayCommitments =
        filteredCommitments.length > 0 || filters.search || filters.stage || filters.status || filters.consultant
            ? filteredCommitments
            : commitments;

    // Commitment exports now flow through Export Center (/exports) — sidebar
    // and in-context dashboard menus removed in Phase 4 (plan §4 cleanup).

    const handleAddCommitment = () => {
        setEditingCommitment(null);
        setCommitmentDialogOpen(true);
    };

    const handleEditCommitment = (commitment) => {
        setEditingCommitment(commitment);
        setCommitmentDialogOpen(true);
    };

    const handleSaveCommitment = async (commitmentData) => {
        if (editingCommitment) {
            await commitmentService.updateCommitment(editingCommitment._id, commitmentData);
        } else {
            await commitmentService.createCommitment(commitmentData);
        }
        await loadCommitments();
        if (consultantDetailOpen && selectedConsultant) {
            setPerformanceLoading(true);
            try {
                const consultantName = typeof selectedConsultant === 'string' ? selectedConsultant : selectedConsultant.name;
                const data = await commitmentService.getConsultantPerformance(consultantName, {
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                });
                setConsultantPerformance(data);
            } catch (err) {
                console.error('Failed to refresh consultant performance:', err);
            } finally {
                setPerformanceLoading(false);
            }
        }
        setCommitmentDialogOpen(false);
        setEditingCommitment(null);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Derived metrics
    const consultantStats = displayCommitments.reduce((acc, c) => {
        const name = c.consultantName || 'Unknown';
        if (!acc[name]) acc[name] = { consultant: name, total: 0, achieved: 0, meetings: 0, closed: 0 };
        acc[name].total++;
        acc[name].meetings += c.meetingsDone || 0;
        if (c.status === 'achieved' || c.admissionClosed) acc[name].achieved++;
        if (c.admissionClosed) acc[name].closed++;
        return acc;
    }, {});
    const consultantStatsArray = Object.values(consultantStats).map(s => ({
        ...s,
        achievementRate: s.total > 0 ? Math.round((s.achieved / s.total) * 100) : 0,
    }));
    // Sort for top performer highlight.
    const sortedStats = [...consultantStatsArray].sort((a, b) => b.achievementRate - a.achievementRate);
    const topPerformer = sortedStats[0]?.achievementRate >= 70 ? sortedStats[0].consultant : null;

    const teamConsultants = consultants.map(c => ({ name: c.name, _id: c._id }));

    const totalCommitments = displayCommitments.length;
    const totalAchieved = displayCommitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = displayCommitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = displayCommitments.filter(c => c.admissionClosed).length;
    const teamAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;

    const sidebar = (
        <Sidebar
            onAddCommitment={handleAddCommitment}
            onLogout={handleLogout}
            onAIAnalysis={() => setTabValue(2)}
            onDashboard={() => setTabValue(0)}
            aiAnalysisActive={tabValue === 2}
        />
    );

    const kpiItems = [
        {
            label: 'Total Commitments',
            value: totalCommitments,
            sub: `${consultantStatsArray.length} consultants`,
            accent: 'accent',
        },
        {
            label: 'Team Achievement',
            value: teamAchievementRate,
            format: (v) => `${v}%`,
            sub: `${totalAchieved} of ${totalCommitments} achieved`,
            accent: teamAchievementRate >= 70 ? 'success' : teamAchievementRate >= 40 ? 'warm' : 'danger',
        },
        {
            label: 'Total Meetings',
            value: totalMeetings,
            sub: 'Across all consultants',
            accent: 'accent',
        },
        {
            label: 'Admissions Closed',
            value: totalClosed,
            sub: 'Successful conversions',
            accent: 'warm',
        },
    ];

    const tabs = [
        { value: 0, label: 'Team Overview' },
        {
            value: 'commitments',
            label: 'Commitments',
            icon: <CommitmentsIcon sx={{ fontSize: 18 }} />,
        },
        { value: 2, label: 'AI Analysis', icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} /> },
    ];

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Team Lead"
                title={`${user?.teamName || 'My Team'} Dashboard`}
                subtitle={formatWeekDisplay(weekInfo.weekNumber, weekInfo.year, weekInfo.weekStartDate, weekInfo.weekEndDate)}
            />

            <SectionCard eyebrow="Date range" padding={18}>
                <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
            </SectionCard>

            {error && (
                <motion.div variants={riseV} style={{ marginBottom: 24 }}>
                    <Alert severity="error" onClose={() => setError('')}>
                        {error}
                    </Alert>
                </motion.div>
            )}

            <KPIStrip items={kpiItems} />

            {commitments.length > 0 && (
                <SectionCard title="Team Analytics" eyebrow="This period">
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2.5,
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <LeadStageChart commitments={displayCommitments} />
                        </Box>
                        <Box
                            sx={{
                                minWidth: 0,
                                backgroundColor: 'var(--d-surface-muted)',
                                border: '1px solid var(--d-border-soft)',
                                borderRadius: '12px',
                                p: 2,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 13,
                                    color: 'var(--d-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    fontWeight: 600,
                                    mb: 1.5,
                                }}
                            >
                                Consultant performance
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                                {consultantStatsArray.map((stat) => (
                                    <Box key={stat.consultant}>
                                        <ProgressBar
                                            label={stat.consultant}
                                            value={stat.achievementRate}
                                        />
                                        <Typography
                                            sx={{
                                                mt: 0.5,
                                                fontSize: 11.5,
                                                color: 'var(--d-text-muted)',
                                            }}
                                        >
                                            {stat.total} commitments · {stat.meetings} meetings · {stat.closed} closed
                                        </Typography>
                                    </Box>
                                ))}
                                {consultantStatsArray.length === 0 && (
                                    <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted)' }}>
                                        No consultant activity yet in this period.
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </SectionCard>
            )}

            <DashboardTabs
                value={tabValue}
                onChange={(v) => {
                    if (v === 'commitments') {
                        navigate('/commitments');
                        return;
                    }
                    setTabValue(v);
                }}
                tabs={tabs}
            />

            <AnimatedTabPanel panelKey={tabValue}>
                {tabValue === 0 && (
                    <Box>
                        <SectionCard
                            title="My team consultants"
                            right={
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                        setSelectedConsultantForEdit(null);
                                        setConsultantDialogOpen(true);
                                    }}
                                    sx={{
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        background: 'var(--d-accent)',
                                        '&:hover': { background: 'var(--d-accent-text)' },
                                        boxShadow: 'none',
                                    }}
                                >
                                    Add Consultant
                                </Button>
                            }
                        >
                            <TableContainer>
                                <Table size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'var(--d-border-soft)', color: 'var(--d-text-2)' } }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</TableCell>
                                            <TableCell sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</TableCell>
                                            <TableCell sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</TableCell>
                                            <TableCell sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</TableCell>
                                            <TableCell align="center" sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {consultants.map((consultant) => (
                                            <TableRow
                                                key={consultant._id}
                                                sx={{
                                                    transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                                    '&:hover': { backgroundColor: 'var(--d-surface-hover)' },
                                                }}
                                            >
                                                <TableCell>{consultant.name}</TableCell>
                                                <TableCell>{consultant.email || '--'}</TableCell>
                                                <TableCell>{consultant.phone || '--'}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={consultant.isActive !== false ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        sx={{
                                                            fontWeight: 600,
                                                            fontSize: 11,
                                                            height: 22,
                                                            backgroundColor: consultant.isActive !== false ? 'var(--d-success-bg)' : 'var(--d-surface-muted)',
                                                            color: consultant.isActive !== false ? 'var(--d-success-text)' : 'var(--d-text-muted)',
                                                            border: '1px solid',
                                                            borderColor: consultant.isActive !== false ? 'transparent' : 'var(--d-border)',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell align="center">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setSelectedConsultantForEdit(consultant);
                                                            setConsultantDialogOpen(true);
                                                        }}
                                                        sx={{ color: 'var(--d-accent)' }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeactivateConsultant(consultant._id)}
                                                        disabled={consultant.isActive === false}
                                                        sx={{ color: 'var(--d-danger)' }}
                                                    >
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </SectionCard>

                        <SectionCard title="Consultant performance" eyebrow="Click a card to drill in">
                            <PerformerGrid>
                                {consultantStatsArray.map((stat) => (
                                    <PerformerCard
                                        key={stat.consultant}
                                        name={stat.consultant}
                                        subtitle={`${stat.total} commitments · ${stat.meetings} meetings`}
                                        metricLabel="Achievement"
                                        metricValue={stat.achievementRate}
                                        stats={[
                                            { label: 'Commitments', value: stat.total },
                                            { label: 'Meetings', value: stat.meetings },
                                            { label: 'Closed', value: stat.closed },
                                        ]}
                                        onClick={() => handleConsultantClick(stat.consultant)}
                                        highlight={stat.consultant === topPerformer}
                                    />
                                ))}
                                {consultantStatsArray.length === 0 && (
                                    <Typography sx={{ color: 'var(--d-text-muted)', fontSize: 14 }}>
                                        No commitments in this period yet.
                                    </Typography>
                                )}
                            </PerformerGrid>
                        </SectionCard>
                    </Box>
                )}

                {tabValue === 2 && <AISummaryCard />}
            </AnimatedTabPanel>

            {/* Dialogs */}
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
        </DashboardShell>
    );
};

export default TeamLeadDashboard;
