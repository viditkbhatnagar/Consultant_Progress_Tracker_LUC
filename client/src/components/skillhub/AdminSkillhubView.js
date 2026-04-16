import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Tabs,
    Tab,
    Typography,
    Grid,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    TableContainer,
    Chip,
    Tooltip,
} from '@mui/material';
import {
    ORGANIZATIONS,
    ORGANIZATION_LABELS,
    getLeadStageColor,
} from '../../utils/constants';
import studentService from '../../services/studentService';
import consultantService from '../../services/consultantService';
import commitmentService from '../../services/commitmentService';
import SkillhubStudentTable from './SkillhubStudentTable';

const BRANCHES = [
    { key: ORGANIZATIONS.SKILLHUB_TRAINING, label: 'Training' },
    { key: ORGANIZATIONS.SKILLHUB_INSTITUTE, label: 'Institute' },
];

const KpiMini = ({ label, value, color }) => (
    <Card sx={{ height: '100%' }}>
        <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color }}>
                {value}
            </Typography>
        </CardContent>
    </Card>
);

const AdminSkillhubView = () => {
    const [branchTab, setBranchTab] = useState(0);
    const [subTab, setSubTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [counselors, setCounselors] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [stats, setStats] = useState({ newAdmissions: 0, activeStudents: 0 });
    const [branchTotals, setBranchTotals] = useState({});
    const [autoPickDone, setAutoPickDone] = useState(false);

    const activeBranch = BRANCHES[branchTab].key;

    // Fetch per-branch commitment + student counts once so the tab labels and
    // KPIs make it obvious where the data is. Admin used to default to the
    // Training tab and wrongly conclude "no Skillhub data" when the
    // records were under Institute.
    const loadBranchTotals = useCallback(async () => {
        try {
            const results = await Promise.all(
                BRANCHES.flatMap((b) => [
                    commitmentService.getCommitments({ organization: b.key }),
                    studentService.getStudents({ organization: b.key }),
                ])
            );
            const totals = {};
            BRANCHES.forEach((b, i) => {
                const commits = results[i * 2]?.data || [];
                const students = results[i * 2 + 1]?.data || [];
                totals[b.key] = { commitments: commits.length, students: students.length };
            });
            setBranchTotals(totals);

            // Auto-pick the first branch with data on first render only, so
            // admin lands on the branch that actually has records.
            if (!autoPickDone) {
                setAutoPickDone(true);
                const firstWithData = BRANCHES.findIndex(
                    (b) => (totals[b.key]?.commitments || 0) + (totals[b.key]?.students || 0) > 0
                );
                if (firstWithData > 0) setBranchTab(firstWithData);
            }
        } catch {
            // non-fatal — branch data below still loads
        }
    }, [autoPickDone]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [consultantsRes, commitmentsRes, newRes, activeRes] = await Promise.all([
                consultantService.getConsultants({ organization: activeBranch }),
                commitmentService.getCommitments({ organization: activeBranch }),
                studentService.getStudents({ organization: activeBranch, studentStatus: 'new_admission' }),
                studentService.getStudents({ organization: activeBranch, studentStatus: 'active' }),
            ]);
            setCounselors(consultantsRes.data || []);
            setCommitments(commitmentsRes.data || []);
            setStats({
                newAdmissions: (newRes.data || []).length,
                activeStudents: (activeRes.data || []).length,
            });
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to load Skillhub data');
        } finally {
            setLoading(false);
        }
    }, [activeBranch]);

    useEffect(() => { loadBranchTotals(); }, [loadBranchTotals]);
    useEffect(() => { load(); }, [load]);

    return (
        <Box>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Skillhub
                </Typography>
                <Paper>
                    <Tabs value={branchTab} onChange={(_, v) => setBranchTab(v)}>
                        {BRANCHES.map((b) => {
                            const t = branchTotals[b.key];
                            const badge =
                                t
                                    ? ` · ${t.commitments || 0}C · ${t.students || 0}S`
                                    : '';
                            return (
                                <Tab
                                    key={b.key}
                                    label={`${ORGANIZATION_LABELS[b.key]}${badge}`}
                                />
                            );
                        })}
                    </Tabs>
                </Paper>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <KpiMini label="New Admissions" value={stats.newAdmissions} color="#FF9800" />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <KpiMini label="Active Students" value={stats.activeStudents} color="#4CAF50" />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <KpiMini label="Counselors" value={counselors.length} color="#2196F3" />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <KpiMini label="Commitments" value={commitments.length} color="#9C27B0" />
                        </Grid>
                    </Grid>

                    <Paper sx={{ mb: 2 }}>
                        <Tabs value={subTab} onChange={(_, v) => setSubTab(v)}>
                            <Tab label="Student Database" />
                            <Tab label="Commitments" />
                        </Tabs>
                    </Paper>

                    {subTab === 0 ? (
                        <SkillhubStudentTable
                            key={activeBranch}
                            counselors={counselors}
                            organization={activeBranch}
                            onChange={load}
                        />
                    ) : (
                        <Paper sx={{ p: 2 }}>
                            {commitments.length === 0 ? (
                                <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                    No commitments for this branch.
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
                                                                                            ? new Date(d.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
                                                </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Paper>
                    )}
                </>
            )}
        </Box>
    );
};

export default AdminSkillhubView;
