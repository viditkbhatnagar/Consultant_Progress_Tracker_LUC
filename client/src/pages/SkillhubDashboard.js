import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    Collapse,
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
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { ORGANIZATION_LABELS, getLeadStageColor } from '../utils/constants';
import { getWeekInfo, formatWeekDisplay } from '../utils/weekUtils';
import consultantService from '../services/consultantService';
import commitmentService from '../services/commitmentService';
import studentService from '../services/studentService';
import SkillhubSidebar from '../components/skillhub/SkillhubSidebar';
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

import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import SectionCard from '../components/dashboard/SectionCard';
import KPIStrip from '../components/dashboard/KPIStrip';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import { riseVariants, useReducedMotionVariants } from '../utils/dashboardMotion';

const SkillhubDashboard = () => {
    const { user, logout } = useAuth();
    const weekInfo = getWeekInfo();
    const branchLabel = ORGANIZATION_LABELS[user?.organization] || 'Skillhub';
    const themeState = useDashboardThemeState('skillhub-theme-mode');
    const riseV = useReducedMotionVariants(riseVariants);

    const [view, setView] = useState('dashboard'); // dashboard | students | commitments | analytics | ai
    const [counselors, setCounselors] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [stats, setStats] = useState({
        newAdmissionsPeriod: 0,
        activeStudents: 0,
        commitmentsPeriod: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    const [studentFormOpen, setStudentFormOpen] = useState(false);
    const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
    const [editingCommitment, setEditingCommitment] = useState(null);

    // "This Week" block is independent of the date-range selector above — it
    // always shows the current Mon–Sun so counselors can see what they've
    // logged this week even while viewing Month / Last-3-months in the main
    // strip below. Per counselor feedback: they want week context to persist,
    // not get replaced when they toggle to month.
    const thisWeek = useMemo(() => {
        const now = new Date();
        return {
            start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
    }, []);
    const [weekCommitments, setWeekCommitments] = useState([]);
    const [weekNewAdmissions, setWeekNewAdmissions] = useState(0);
    const [weekListOpen, setWeekListOpen] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [
                consultantsRes,
                commitmentsRes,
                newRes,
                activeRes,
                weekCommitsRes,
                weekNewRes,
            ] = await Promise.all([
                consultantService.getConsultants(),
                commitmentService.getCommitmentsByDateRange(dateRange.startDate, dateRange.endDate),
                studentService.getStudents({
                    studentStatus: 'new_admission',
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                }),
                studentService.getStudents({ studentStatus: 'active' }),
                // Always-on current-week fetch so the "This Week" block stays
                // populated regardless of what the date-range selector shows.
                commitmentService.getCommitmentsByDateRange(thisWeek.start, thisWeek.end),
                studentService.getStudents({
                    studentStatus: 'new_admission',
                    startDate: thisWeek.start,
                    endDate: thisWeek.end,
                }),
            ]);
            const commitList = commitmentsRes.data || [];
            setCounselors(consultantsRes.data || []);
            setCommitments(commitList);
            setStats({
                newAdmissionsPeriod: (newRes.data || []).length,
                activeStudents: (activeRes.data || []).length,
                commitmentsPeriod: commitList.length,
            });
            setWeekCommitments(weekCommitsRes.data || []);
            setWeekNewAdmissions((weekNewRes.data || []).length);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, [dateRange.startDate, dateRange.endDate, thisWeek.start, thisWeek.end]);

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

    const weekAchieved = weekCommitments.filter((c) => c.status === 'achieved' || c.admissionClosed).length;
    const weekPending = weekCommitments.filter((c) => c.status === 'pending' || c.status === 'in_progress').length;

    const weekKpiItems = [
        { label: 'Commitments', value: weekCommitments.length, sub: 'Logged this week', accent: 'accent' },
        { label: 'Achieved', value: weekAchieved, sub: 'This week', accent: 'success' },
        { label: 'Pending', value: weekPending, sub: 'This week', accent: 'warm' },
        { label: 'New Admissions', value: weekNewAdmissions, sub: 'This week', accent: 'accent' },
    ];

    const weekRangeLabel = `${format(new Date(thisWeek.start + 'T00:00:00'), 'MMM d')} – ${format(new Date(thisWeek.end + 'T00:00:00'), 'MMM d')}`;

    const kpiItems = [
        {
            label: 'New Admissions',
            value: stats.newAdmissionsPeriod,
            sub: 'In selected period',
            accent: 'warm',
        },
        {
            label: 'Active Students',
            value: stats.activeStudents,
            sub: 'Total enrolled',
            accent: 'success',
        },
        {
            label: 'Achieved',
            value: achieved,
            sub: 'Commitments in period',
            accent: 'accent',
        },
        {
            label: 'Pending',
            value: pending,
            sub: 'In progress / pending',
            accent: 'accent',
        },
    ];

    const sidebar = (
        <SkillhubSidebar
            activeView={view}
            onNavigate={setView}
            onNewAdmission={() => setStudentFormOpen(true)}
            onLogout={logout}
        />
    );

    const renderDashboard = () => (
        <>
            {/* "This Week" block — always current Mon–Sun, independent of the
                date-range selector. Sits above the period-filtered strip so
                counselors can see what they logged this week even while the
                lower view is set to Month / Last-3-months / Custom. */}
            <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--d-text-muted)',
                            letterSpacing: '.1em',
                            textTransform: 'uppercase',
                        }}
                    >
                        📅 This Week
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted)' }}>
                        · {weekRangeLabel}
                    </Typography>
                </Box>
                <KPIStrip items={weekKpiItems} />
                {weekCommitments.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                        <Button
                            size="small"
                            onClick={() => setWeekListOpen((v) => !v)}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                color: 'var(--d-accent-text)',
                                px: 0,
                            }}
                        >
                            {weekListOpen
                                ? 'Hide this-week list'
                                : `View ${weekCommitments.length} commitment${weekCommitments.length === 1 ? '' : 's'} this week`}
                        </Button>
                        <Collapse in={weekListOpen} unmountOnExit>
                            <SectionCard sx={{ mt: 1, mb: 0 }} padding={0}>
                                <Box sx={{ px: 2 }}>
                                    {weekCommitments.map((c, idx, arr) => (
                                        <Box
                                            key={c._id}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                py: 1.25,
                                                borderBottom:
                                                    idx < arr.length - 1
                                                        ? '1px solid var(--d-border-soft)'
                                                        : 'none',
                                            }}
                                        >
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography
                                                    sx={{
                                                        fontWeight: 600,
                                                        fontSize: 13,
                                                        color: 'var(--d-text)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {c.consultantName} — {c.studentName || 'Lead'}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: 12,
                                                        color: 'var(--d-text-muted)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {c.commitmentMade?.substring(0, 90)}
                                                    {c.commitmentMade?.length > 90 ? '…' : ''}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={c.leadStage}
                                                size="small"
                                                sx={{
                                                    bgcolor: getLeadStageColor(c.leadStage),
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    height: 22,
                                                    flexShrink: 0,
                                                    alignSelf: 'center',
                                                }}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            </SectionCard>
                        </Collapse>
                    </Box>
                )}
            </Box>

            <KPIStrip items={kpiItems} />

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2.5,
                }}
            >
                <SectionCard
                    title={`Counselors (${counselors.length})`}
                    eyebrow="Team"
                    sx={{ mb: 0 }}
                >
                    {counselors.length === 0 ? (
                        <Typography sx={{ color: 'var(--d-text-muted)', fontSize: 13 }}>
                            No counselors seeded.
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            {counselors
                                .filter((c) => !['Ameen', 'Zakeer'].includes(c.name))
                                .map((c) => (
                                    <Chip
                                        key={c._id}
                                        label={c.name}
                                        sx={{
                                            backgroundColor: 'var(--d-accent-bg)',
                                            color: 'var(--d-accent-text)',
                                            fontWeight: 600,
                                            fontSize: 12,
                                            height: 26,
                                            border: '1px solid var(--d-border-soft)',
                                        }}
                                    />
                                ))}
                        </Box>
                    )}
                </SectionCard>

                <SectionCard
                    title="Recent Commitments"
                    eyebrow="Last 5"
                    sx={{ mb: 0 }}
                >
                    {commitments.slice(0, 5).length === 0 ? (
                        <Typography sx={{ color: 'var(--d-text-muted)', fontSize: 13 }}>
                            No commitments yet.
                        </Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            {commitments.slice(0, 5).map((c, idx, arr) => (
                                <Box
                                    key={c._id}
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        py: 1.25,
                                        borderBottom:
                                            idx < arr.length - 1
                                                ? '1px solid var(--d-border-soft)'
                                                : 'none',
                                    }}
                                >
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: 13,
                                                color: 'var(--d-text)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {c.consultantName} — {c.studentName || 'Lead'}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: 12,
                                                color: 'var(--d-text-muted)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {c.commitmentMade?.substring(0, 70)}…
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={c.leadStage}
                                        size="small"
                                        sx={{
                                            bgcolor: getLeadStageColor(c.leadStage),
                                            color: 'white',
                                            fontWeight: 600,
                                            fontSize: 11,
                                            height: 22,
                                            flexShrink: 0,
                                        }}
                                    />
                                </Box>
                            ))}
                        </Box>
                    )}
                </SectionCard>
            </Box>
        </>
    );

    const renderCommitmentsTable = () => (
        <SectionCard
            title="Commitments"
            right={
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleNewCommitment}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        background: 'var(--d-accent)',
                        '&:hover': { background: 'var(--d-accent-text)' },
                        boxShadow: 'none',
                    }}
                >
                    New Commitment
                </Button>
            }
            padding={commitments.length === 0 ? 22 : 0}
        >
            {commitments.length === 0 ? (
                <Typography
                    sx={{
                        p: 4,
                        textAlign: 'center',
                        color: 'var(--d-text-muted)',
                        fontSize: 14,
                    }}
                >
                    No commitments yet.
                </Typography>
            ) : (
                <TableContainer>
                    <Table
                        size="small"
                        sx={{
                            '& .MuiTableCell-root': {
                                borderColor: 'var(--d-border-soft)',
                                color: 'var(--d-text-2)',
                            },
                            '& .MuiTableCell-head': {
                                color: 'var(--d-text-muted)',
                                fontWeight: 600,
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            },
                        }}
                    >
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
                                    <TableRow
                                        key={c._id}
                                        sx={{
                                            transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                            '&:hover': { backgroundColor: 'var(--d-surface-hover)' },
                                        }}
                                    >
                                        <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            W{c.weekNumber}/{c.year}
                                        </TableCell>
                                        <TableCell>{c.consultantName}</TableCell>
                                        <TableCell>{c.studentName || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 280 }}>
                                            <Typography variant="body2" noWrap sx={{ color: 'var(--d-text-2)' }}>
                                                {c.commitmentMade}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={c.leadStage}
                                                size="small"
                                                sx={{
                                                    bgcolor: getLeadStageColor(c.leadStage),
                                                    color: 'white',
                                                    fontWeight: 600,
                                                    fontSize: 11,
                                                    height: 22,
                                                }}
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
                                                                    <Box
                                                                        key={slot}
                                                                        sx={{
                                                                            display: 'flex',
                                                                            justifyContent: 'space-between',
                                                                            gap: 2,
                                                                            fontSize: 12,
                                                                            py: 0.2,
                                                                        }}
                                                                    >
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
                                                        bgcolor:
                                                            done > 0
                                                                ? 'var(--d-success-bg)'
                                                                : scheduled > 0
                                                                    ? 'var(--d-accent-bg)'
                                                                    : 'var(--d-surface-muted)',
                                                        color:
                                                            done > 0
                                                                ? 'var(--d-success-text)'
                                                                : scheduled > 0
                                                                    ? 'var(--d-accent-text)'
                                                                    : 'var(--d-text-muted)',
                                                        fontWeight: 600,
                                                        fontSize: 11,
                                                        height: 22,
                                                        cursor: 'help',
                                                    }}
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                            {c.achievementPercentage || 0}%
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditCommitment(c)}
                                                    sx={{ color: 'var(--d-accent)' }}
                                                >
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
        </SectionCard>
    );

    const renderAnalytics = () => (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <LeadStageChart commitments={commitments} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <AchievementChart commitments={commitments} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <MeetingsChart commitments={commitments} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <ConsultantPerformanceChart
                    consultantStats={counselors.map((c) => {
                        const byName = commitments.filter((cm) => cm.consultantName === c.name);
                        const achievedCount = byName.filter(
                            (cm) => cm.status === 'achieved' || cm.admissionClosed
                        ).length;
                        return {
                            name: c.name,
                            total: byName.length,
                            achieved: achievedCount,
                            achievementRate: byName.length
                                ? Math.round((achievedCount / byName.length) * 100)
                                : 0,
                        };
                    })}
                />
            </Box>
        </Box>
    );

    const showDateRange = view === 'dashboard' || view === 'commitments' || view === 'analytics';

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow={user?.organization === 'skillhub_training' ? 'Skillhub Training' : 'Skillhub Institute'}
                title={`${branchLabel} Dashboard`}
                subtitle={formatWeekDisplay(
                    weekInfo.weekNumber,
                    weekInfo.year,
                    weekInfo.weekStartDate,
                    weekInfo.weekEndDate
                )}
            />

            {showDateRange && (
                <SectionCard eyebrow="Date range" padding={18}>
                    <DateRangeSelector value={dateRange} onChange={setDateRange} />
                </SectionCard>
            )}

            {error && (
                <motion.div variants={riseV} style={{ marginBottom: 24 }}>
                    <Alert severity="error" onClose={() => setError('')}>
                        {error}
                    </Alert>
                </motion.div>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                    <CircularProgress sx={{ color: 'var(--d-accent)' }} />
                </Box>
            ) : view === 'dashboard' ? (
                renderDashboard()
            ) : view === 'students' ? (
                <SectionCard padding={16}>
                    <SkillhubStudentTable counselors={counselors} onChange={loadAll} />
                </SectionCard>
            ) : view === 'commitments' ? (
                renderCommitmentsTable()
            ) : view === 'analytics' ? (
                renderAnalytics()
            ) : view === 'ai' ? (
                <AISummaryCard />
            ) : null}

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
        </DashboardShell>
    );
};

export default SkillhubDashboard;
