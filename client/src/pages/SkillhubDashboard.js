import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    Paper,
    Button,
    Chip,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    CircularProgress,
    IconButton,
    Tooltip,
    Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../context/AuthContext';
import { ORGANIZATION_LABELS, getLeadStageColor } from '../utils/constants';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import consultantService from '../services/consultantService';
import commitmentService from '../services/commitmentService';
import studentService from '../services/studentService';
import SkillhubSidebar, { DRAWER_WIDTH } from '../components/skillhub/SkillhubSidebar';
import SkillhubStudentTable from '../components/skillhub/SkillhubStudentTable';
import SkillhubStudentFormDialog from '../components/skillhub/SkillhubStudentFormDialog';
import SkillhubCommitmentDialog from '../components/skillhub/SkillhubCommitmentDialog';
import AISummaryCard from '../components/AISummaryCard';
import DateRangeSelector from '../components/DateRangeSelector';
import {
    LeadStageChart,
    AchievementChart,
    MeetingsChart,
    ConsultantPerformanceChart,
} from '../components/Charts';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const KpiCard = ({ label, value, color, sub }) => (
    <Card elevation={2} sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent>
            <Typography variant="body2" sx={{ color: '#34495E', opacity: 0.85, mb: 1 }}>
                {label}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, color: color || '#2C3E50' }}>
                {value}
            </Typography>
            {sub && (
                <Typography variant="caption" sx={{ color: '#34495E', opacity: 0.7 }}>
                    {sub}
                </Typography>
            )}
        </CardContent>
    </Card>
);

const SkillhubDashboard = () => {
    const { user, logout } = useAuth();
    const weekInfo = getWeekInfo();
    const branchLabel = ORGANIZATION_LABELS[user?.organization] || 'Skillhub';

    const [view, setView] = useState('dashboard'); // dashboard | students | commitments
    const [counselors, setCounselors] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [stats, setStats] = useState({
        newAdmissionsPeriod: 0,
        activeStudents: 0,
        commitmentsPeriod: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Date range filter — same semantics as LUC admin dashboard. Drives
    // commitments list + "this period" KPIs. Active Students stays cumulative.
    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    const [studentFormOpen, setStudentFormOpen] = useState(false);
    const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
    const [editingCommitment, setEditingCommitment] = useState(null);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [consultantsRes, commitmentsRes, newRes, activeRes] = await Promise.all([
                consultantService.getConsultants(),
                // Date-range scoped commitments (uses /commitments/date-range)
                commitmentService.getCommitmentsByDateRange(
                    dateRange.startDate,
                    dateRange.endDate
                ),
                // New Admissions in the selected period (backend uses createdAt
                // when curriculumSlug or skillhub org is in scope).
                studentService.getStudents({
                    studentStatus: 'new_admission',
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                }),
                // Active Students — cumulative, no date filter.
                studentService.getStudents({ studentStatus: 'active' }),
            ]);
            const commitList = commitmentsRes.data || [];
            setCounselors(consultantsRes.data || []);
            setCommitments(commitList);
            setStats({
                newAdmissionsPeriod: (newRes.data || []).length,
                activeStudents: (activeRes.data || []).length,
                commitmentsPeriod: commitList.length,
            });
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, [dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleSaveStudent = async (formData) => {
        await studentService.createStudent(formData);
        await loadAll();
    };

    const handleNewCommitment = () => {
        setEditingCommitment(null);
        setCommitmentDialogOpen(true);
    };
    const handleEditCommitment = (c) => {
        setEditingCommitment(c);
        setCommitmentDialogOpen(true);
    };
    const handleSaveCommitment = async (data) => {
        if (editingCommitment) {
            await commitmentService.updateCommitment(editingCommitment._id, data);
        } else {
            await commitmentService.createCommitment(data);
        }
        await loadAll();
    };

    const achieved = commitments.filter((c) => c.status === 'achieved' || c.admissionClosed).length;
    const pending = commitments.filter((c) => c.status === 'pending' || c.status === 'in_progress').length;

    const renderDashboard = () => (
        <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard label="New Admissions" value={stats.newAdmissionsPeriod} color="#FF9800" sub="In selected period" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard label="Active Students" value={stats.activeStudents} color="#4CAF50" sub="Total enrolled" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard label="Achieved" value={achieved} color="#2196F3" sub="Commitments in period" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <KpiCard label="Pending" value={pending} color="#9C27B0" sub="In progress / pending" />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#2C3E50' }}>
                                    Counselors ({counselors.length})
                                </Typography>
                            </Box>
                            {counselors.length === 0 ? (
                                <Typography color="text.secondary">No counselors seeded.</Typography>
                            ) : (
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {counselors
                                        // Hide Ameen & Zakeer from the chip strip only —
                                        // they remain fully active everywhere else (hourly
                                        // tracker, admission table, commitment dropdowns)
                                        // since they still need to log historical entries.
                                        .filter((c) => !['Ameen', 'Zakeer'].includes(c.name))
                                        .map((c) => (
                                            <Chip
                                                key={c._id}
                                                label={c.name}
                                                sx={{ bgcolor: '#A0D2EB', color: '#2C3E50', fontWeight: 600 }}
                                            />
                                        ))}
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card elevation={2} sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#2C3E50', mb: 2 }}>
                                Recent Commitments
                            </Typography>
                            {commitments.slice(0, 5).length === 0 ? (
                                <Typography color="text.secondary">No commitments yet.</Typography>
                            ) : (
                                commitments.slice(0, 5).map((c) => (
                                    <Box
                                        key={c._id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            py: 1,
                                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {c.consultantName} — {c.studentName || 'Lead'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap>
                                                {c.commitmentMade?.substring(0, 60)}…
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={c.leadStage}
                                            size="small"
                                            sx={{ bgcolor: getLeadStageColor(c.leadStage), color: 'white' }}
                                        />
                                    </Box>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </>
    );

    const renderCommitments = () => (
        <Card elevation={2} sx={{ borderRadius: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#2C3E50' }}>
                        Commitments
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleNewCommitment}>
                        New Commitment
                    </Button>
                </Box>
                {commitments.length === 0 ? (
                    <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                        No commitments yet.
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Week</TableCell>
                                    <TableCell>Counselor</TableCell>
                                    <TableCell>Student</TableCell>
                                    <TableCell>Commitment</TableCell>
                                    <TableCell>Stage</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="center">Demos</TableCell>
                                    <TableCell align="right">%</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {commitments.map((c) => {
                                    const demos = c.demos || [];
                                    const scheduled = demos.filter((d) => d.scheduledAt).length;
                                    const done = demos.filter((d) => d.done).length;
                                    return (
                                    <TableRow hover key={c._id}>
                                        <TableCell>W{c.weekNumber}/{c.year}</TableCell>
                                        <TableCell>{c.consultantName}</TableCell>
                                        <TableCell>{c.studentName || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 280 }}>
                                            <Typography variant="body2" noWrap>
                                                {c.commitmentMade}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={c.leadStage}
                                                size="small"
                                                sx={{ bgcolor: getLeadStageColor(c.leadStage), color: 'white' }}
                                            />
                                        </TableCell>
                                        <TableCell>{c.status}</TableCell>
                                        <TableCell align="center">
                                            <Tooltip
                                                arrow
                                                title={
                                                    demos.length === 0 ? (
                                                        'No demos'
                                                    ) : (
                                                        <Box sx={{ p: 0.5, minWidth: 220 }}>
                                                            {['Demo 1', 'Demo 2', 'Demo 3', 'Demo 4'].map((slot) => {
                                                                const d = demos.find((x) => x.slot === slot);
                                                                return (
                                                                    <Box key={slot} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, fontSize: 12, py: 0.2 }}>
                                                                        <span style={{ fontWeight: 700 }}>{slot}</span>
                                                                        <span>
                                                                            {d?.scheduledAt
                                                                                ? new Date(d.scheduledAt).toLocaleString([], {
                                                                                      month: 'short',
                                                                                      day: 'numeric',
                                                                                      hour: '2-digit',
                                                                                      minute: '2-digit',
                                                                                  })
                                                                                : '—'}
                                                                            {d?.done && ' ✓'}
                                                                        </span>
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                    )
                                                }
                                            >
                                                <Chip
                                                    label={`${scheduled}/4 · ${done} done`}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: done > 0 ? '#dcfce7' : scheduled > 0 ? '#dbeafe' : 'rgba(0,0,0,0.05)',
                                                        color: done > 0 ? '#14532d' : scheduled > 0 ? '#1e3a8a' : '#64748b',
                                                        fontWeight: 600,
                                                        cursor: 'help',
                                                    }}
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">{c.achievementPercentage || 0}%</TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => handleEditCommitment(c)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
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
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#A0D2EB' }}>
            <SkillhubSidebar
                activeView={view}
                onNavigate={setView}
                onNewAdmission={() => setStudentFormOpen(true)}
                onLogout={logout}
            />

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: `calc(100% - ${DRAWER_WIDTH}px)`,
                    backgroundColor: '#A0D2EB',
                    minHeight: '100vh',
                }}
            >
                <Container maxWidth="xl" sx={{ py: 2 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" gutterBottom sx={{ color: '#2C3E50', fontWeight: 700 }}>
                            {branchLabel} Dashboard
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#34495E', opacity: 0.9 }}>
                            {formatWeekDisplay(
                                weekInfo.weekNumber,
                                weekInfo.year,
                                weekInfo.weekStartDate,
                                weekInfo.weekEndDate
                            )}
                        </Typography>
                    </Box>

                    {/* Date range filter — drives commitments + "this period"
                        KPIs. Hidden on the Student Database view (which has
                        its own CBSE/IGCSE + status filters) and the AI views. */}
                    {(view === 'dashboard' || view === 'commitments' || view === 'analytics') && (
                        <Card elevation={2} sx={{ mb: 3, borderRadius: 3 }}>
                            <CardContent>
                                <DateRangeSelector
                                    value={dateRange}
                                    onChange={setDateRange}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                            <CircularProgress />
                        </Box>
                    ) : view === 'dashboard' ? (
                        renderDashboard()
                    ) : view === 'students' ? (
                        <SkillhubStudentTable counselors={counselors} onChange={loadAll} />
                    ) : view === 'commitments' ? (
                        renderCommitments()
                    ) : view === 'analytics' ? (
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <LeadStageChart commitments={commitments} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <AchievementChart commitments={commitments} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MeetingsChart commitments={commitments} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <ConsultantPerformanceChart
                                    consultantStats={counselors.map((c) => {
                                        const byName = commitments.filter(
                                            (cm) => cm.consultantName === c.name
                                        );
                                        const achieved = byName.filter(
                                            (cm) => cm.status === 'achieved' || cm.admissionClosed
                                        ).length;
                                        return {
                                            name: c.name,
                                            total: byName.length,
                                            achieved,
                                            achievementRate: byName.length
                                                ? Math.round((achieved / byName.length) * 100)
                                                : 0,
                                        };
                                    })}
                                />
                            </Grid>
                        </Grid>
                    ) : view === 'ai' ? (
                        <AISummaryCard />
                    ) : null}
                </Container>
            </Box>

            <SkillhubStudentFormDialog
                open={studentFormOpen}
                onClose={() => setStudentFormOpen(false)}
                onSave={handleSaveStudent}
                counselors={counselors}
            />

            <SkillhubCommitmentDialog
                open={commitmentDialogOpen}
                onClose={() => setCommitmentDialogOpen(false)}
                onSave={handleSaveCommitment}
                commitment={editingCommitment}
                teamConsultants={counselors}
                user={user}
            />
        </Box>
    );
};

export default SkillhubDashboard;
