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

    const activeBranch = BRANCHES[branchTab].key;

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

    useEffect(() => { load(); }, [load]);

    return (
        <Box>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Skillhub
                </Typography>
                <Paper>
                    <Tabs value={branchTab} onChange={(_, v) => setBranchTab(v)}>
                        {BRANCHES.map((b) => (
                            <Tab key={b.key} label={ORGANIZATION_LABELS[b.key]} />
                        ))}
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
                                                <TableCell align="right">%</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {commitments.map((c) => (
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
                                                    <TableCell align="right">{c.achievementPercentage || 0}%</TableCell>
                                                </TableRow>
                                            ))}
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
