import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
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
import DateRangeSelector from '../DateRangeSelector';
import SectionCard from '../dashboard/SectionCard';
import KPIStrip from '../dashboard/KPIStrip';
import DashboardTabs, { AnimatedTabPanel } from '../dashboard/DashboardTabs';
import { startOfWeek, endOfWeek, format } from 'date-fns';

const BRANCHES = [
    { key: ORGANIZATIONS.SKILLHUB_TRAINING, label: 'Training' },
    { key: ORGANIZATIONS.SKILLHUB_INSTITUTE, label: 'Institute' },
];

// Pill switcher identical in feel to the LUC/Skillhub switch in the hero.
const BranchSwitcher = ({ value, onChange, branchTotals }) => (
    <Box
        role="tablist"
        sx={{
            display: 'inline-flex',
            backgroundColor: 'var(--d-surface-muted)',
            border: '1px solid var(--d-border)',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px',
        }}
    >
        {BRANCHES.map((b, idx) => {
            const active = value === idx;
            const t = branchTotals[b.key];
            return (
                <Box
                    key={b.key}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChange(idx)}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        border: 0,
                        background: active ? 'var(--d-surface)' : 'transparent',
                        color: active ? 'var(--d-text)' : 'var(--d-text-muted)',
                        fontWeight: 600,
                        fontSize: 13,
                        px: 2,
                        py: '6px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: active ? 'var(--d-shadow-card-sm)' : 'none',
                        transition:
                            'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter)',
                        '&:focus-visible': {
                            outline: '2px solid var(--d-accent)',
                            outlineOffset: 2,
                        },
                    }}
                >
                    {ORGANIZATION_LABELS[b.key]}
                    {t && (
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                fontSize: 11,
                                color: 'var(--d-text-muted)',
                                fontWeight: 500,
                            }}
                        >
                            · {t.commitments || 0}C · {t.students || 0}S
                        </Box>
                    )}
                </Box>
            );
        })}
    </Box>
);

const AdminSkillhubView = () => {
    const [branchTab, setBranchTab] = useState(0);
    const [subTab, setSubTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [counselors, setCounselors] = useState([]);
    const [commitments, setCommitments] = useState([]);
    const [stats, setStats] = useState({ newAdmissionsPeriod: 0, activeStudents: 0, commitmentsPeriod: 0 });
    const [branchTotals, setBranchTotals] = useState({});
    const [autoPickDone, setAutoPickDone] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    const activeBranch = BRANCHES[branchTab].key;

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

            if (!autoPickDone) {
                setAutoPickDone(true);
                const firstWithData = BRANCHES.findIndex(
                    (b) => (totals[b.key]?.commitments || 0) + (totals[b.key]?.students || 0) > 0
                );
                if (firstWithData > 0) setBranchTab(firstWithData);
            }
        } catch {
            /* non-fatal */
        }
    }, [autoPickDone]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [consultantsRes, commitmentsRes, newRes, activeRes] = await Promise.all([
                consultantService.getConsultants({ organization: activeBranch }),
                commitmentService.getCommitmentsByDateRange(
                    dateRange.startDate,
                    dateRange.endDate,
                    null,
                    activeBranch
                ),
                studentService.getStudents({
                    organization: activeBranch,
                    studentStatus: 'new_admission',
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                }),
                studentService.getStudents({ organization: activeBranch, studentStatus: 'active' }),
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
            setError(e.response?.data?.message || 'Failed to load Skillhub data');
        } finally {
            setLoading(false);
        }
    }, [activeBranch, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        loadBranchTotals();
    }, [loadBranchTotals]);

    useEffect(() => {
        load();
    }, [load]);

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
            sub: 'Lifetime total',
            accent: 'success',
        },
        {
            label: 'Counselors',
            value: counselors.length,
            sub: 'On this branch',
            accent: 'accent',
        },
        {
            label: 'Commitments',
            value: stats.commitmentsPeriod,
            sub: 'In selected period',
            accent: 'accent',
        },
    ];

    return (
        <Box>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 2,
                    mb: 2.5,
                    flexDirection: { xs: 'column', md: 'row' },
                }}
            >
                <Box>
                    <Typography
                        sx={{
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: 'var(--d-text-muted)',
                            fontWeight: 600,
                            mb: 0.5,
                        }}
                    >
                        Skillhub Branch
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--d-text)',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {ORGANIZATION_LABELS[activeBranch]}
                    </Typography>
                </Box>
                <BranchSwitcher
                    value={branchTab}
                    onChange={setBranchTab}
                    branchTotals={branchTotals}
                />
            </Box>

            <SectionCard eyebrow="Date range" padding={18}>
                <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </SectionCard>

            {error && (
                <Alert
                    severity="error"
                    onClose={() => setError('')}
                    sx={{ mb: 3 }}
                >
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                    <CircularProgress sx={{ color: 'var(--d-accent)' }} />
                </Box>
            ) : (
                <>
                    <KPIStrip items={kpiItems} />

                    <DashboardTabs
                        value={subTab}
                        onChange={setSubTab}
                        tabs={[
                            { value: 0, label: 'Student Database' },
                            { value: 1, label: 'Commitments' },
                        ]}
                    />

                    <AnimatedTabPanel panelKey={`${activeBranch}-${subTab}`}>
                        {subTab === 0 ? (
                            <SectionCard padding={16}>
                                <SkillhubStudentTable
                                    key={activeBranch}
                                    counselors={counselors}
                                    organization={activeBranch}
                                    onChange={load}
                                />
                            </SectionCard>
                        ) : (
                            <SectionCard padding={0}>
                                {commitments.length === 0 ? (
                                    <Typography
                                        sx={{
                                            p: 5,
                                            textAlign: 'center',
                                            color: 'var(--d-text-muted)',
                                            fontSize: 14,
                                        }}
                                    >
                                        No commitments for this branch.
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
                                            }}
                                        >
                                            <TableHead>
                                                <TableRow>
                                                    {['Week', 'Counselor', 'Student', 'Commitment', 'Stage', 'Status', 'Demos', '%'].map((h, i) => (
                                                        <TableCell
                                                            key={h}
                                                            align={h === 'Demos' ? 'center' : h === '%' ? 'right' : 'left'}
                                                            sx={{
                                                                color: 'var(--d-text-muted)',
                                                                fontWeight: 600,
                                                                fontSize: 12,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}
                                                        >
                                                            {h}
                                                        </TableCell>
                                                    ))}
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
                                                                <Typography
                                                                    variant="body2"
                                                                    noWrap
                                                                    sx={{ color: 'var(--d-text-2)' }}
                                                                >
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
                                                                            bgcolor: done > 0
                                                                                ? 'var(--d-success-bg)'
                                                                                : scheduled > 0
                                                                                    ? 'var(--d-accent-bg)'
                                                                                    : 'var(--d-surface-muted)',
                                                                            color: done > 0
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
                                                            <TableCell
                                                                align="right"
                                                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                                                            >
                                                                {c.achievementPercentage || 0}%
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </SectionCard>
                        )}
                    </AnimatedTabPanel>
                </>
            )}
        </Box>
    );
};

export default AdminSkillhubView;
