import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Button,
} from '@mui/material';
import {
    School as SchoolIcon,
    Assignment as AssignmentIcon,
    ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    ORGANIZATIONS,
    ORGANIZATION_LABELS,
} from '../../utils/constants';
import studentService from '../../services/studentService';
import consultantService from '../../services/consultantService';
import commitmentService from '../../services/commitmentService';
import DateRangeSelector from '../DateRangeSelector';
import SectionCard from '../dashboard/SectionCard';
import KPIStrip from '../dashboard/KPIStrip';
import { setAdminOrgScope } from '../../utils/adminOrgScope';
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
    const navigate = useNavigate();
    const [branchTab, setBranchTab] = useState(0);
    // subTab kept for backward compatibility but tab UI is replaced with
    // shortcut buttons — admins now open the full dedicated pages via
    // /student-database and /commitments (with the branch pinned below).
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

                    {/* Shortcuts to the dedicated pages. Clicking pins the
                        admin's current org scope to this branch so the
                        downstream page renders Skillhub data, not LUC. */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                            gap: 2.5,
                            mt: 2,
                        }}
                    >
                        <ShortcutCard
                            icon={<SchoolIcon sx={{ fontSize: 22 }} />}
                            eyebrow="Students"
                            title={`${stats.activeStudents + stats.newAdmissionsPeriod} in view`}
                            description="Open the full Student Database for this branch — CBSE / IGCSE tabs, status moves, activation, EMIs, export."
                            cta="Open Student Database"
                            onClick={() => {
                                setAdminOrgScope(activeBranch);
                                navigate('/student-database');
                            }}
                        />
                        <ShortcutCard
                            icon={<AssignmentIcon sx={{ fontSize: 22 }} />}
                            eyebrow="Commitments"
                            title={`${stats.commitmentsPeriod} in period`}
                            description="Open the Commitment Tracker — Table / Board / Cards views, demo-slot management, AI analysis."
                            cta="Open Commitment Tracker"
                            onClick={() => {
                                setAdminOrgScope(activeBranch);
                                navigate('/commitments');
                            }}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

const ShortcutCard = ({ icon, eyebrow, title, description, cta, onClick }) => (
    <SectionCard sx={{ mb: 0 }} padding={22}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    backgroundColor: 'var(--d-accent-bg)',
                    color: 'var(--d-accent-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    sx={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: 'var(--d-text-muted)',
                        letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        mb: 0.5,
                    }}
                >
                    {eyebrow}
                </Typography>
                <Typography
                    sx={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--d-text)',
                        mb: 0.5,
                    }}
                >
                    {title}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'var(--d-text-3)', mb: 1.5 }}>
                    {description}
                </Typography>
                <Button
                    variant="contained"
                    onClick={onClick}
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: 13,
                        borderRadius: '10px',
                        boxShadow: 'none',
                    }}
                >
                    {cta}
                </Button>
            </Box>
        </Box>
    </SectionCard>
);

export default AdminSkillhubView;
