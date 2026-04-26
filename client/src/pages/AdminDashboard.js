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
    Button,
    Alert,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Groups as GroupsIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    AutoAwesome as AutoAwesomeIcon,
    VideoCall as VideoCallIcon,
    AccessTime as AccessTimeIcon,
    FactCheck as CommitmentsIcon,
    AccountTree as HierarchyIcon,
    ManageAccounts as UsersIcon,
    AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import commitmentService from '../services/commitmentService';
import { getUsers } from '../services/authService';
import consultantService from '../services/consultantService';
import { API_BASE_URL } from '../utils/constants';
import { setAdminOrgScope, getAdminOrgScope } from '../utils/adminOrgScope';
import DateRangeSelector from '../components/DateRangeSelector';
import TeamDetailDialog from '../components/TeamDetailDialog';
import ConsultantDetailDialog from '../components/ConsultantDetailDialog';
import TeamHierarchyView from '../components/TeamHierarchyView';
import AdminCommitmentDialog from '../components/AdminCommitmentDialog';
import AdminAddCommitmentDialog from '../components/AdminAddCommitmentDialog';
import UserManagementDialog from '../components/UserManagementDialog';
import ConsultantManagementDialog from '../components/ConsultantManagementDialog';
import AdminSidebar from '../components/AdminSidebar';
import AISummaryCard from '../components/AISummaryCard';
import AIUsageTabs from '../components/admin/AIUsageTabs';
import AdminSkillhubView from '../components/skillhub/AdminSkillhubView';
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

// Pill-style switcher for LUC / Skillhub. Uses the dashboard tokens so it
// adapts to light/dark and reads clean next to the hero.
const OrgSwitcher = ({ value, onChange }) => (
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
        {['luc', 'skillhub'].map((v) => {
            const active = value === v;
            return (
                <Box
                    key={v}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onChange(v)}
                    sx={{
                        border: 0,
                        background: active ? 'var(--d-surface)' : 'transparent',
                        color: active ? 'var(--d-text)' : 'var(--d-text-muted)',
                        fontWeight: 600,
                        fontSize: 13,
                        letterSpacing: '0.01em',
                        px: 2,
                        py: '6px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: active ? 'var(--d-shadow-card-sm)' : 'none',
                        transition: 'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter)',
                        '&:focus-visible': {
                            outline: '2px solid var(--d-accent)',
                            outlineOffset: 2,
                        },
                    }}
                >
                    {v === 'luc' ? 'LUC' : 'Skillhub'}
                </Box>
            );
        })}
    </Box>
);

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const weekInfo = getWeekInfo();
    const themeState = useDashboardThemeState('dashboard-theme-mode');
    const riseV = useReducedMotionVariants(riseVariants);

    const [commitments, setCommitments] = useState([]);
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');
    const [tabValue, setTabValue] = useState(0);
    const location = useLocation();

    // Phase 5 Commit 7 — the legacy /admin/docs-rag and /admin/api-costs
    // routes redirect here with ?section=ai-usage so the sidebar's
    // "AI Usage" tab (index 5) activates on arrival. The DocsRagPanel
    // sub-tab is picked up by AIUsageTabs from ?tab=docs-rag.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('section') === 'ai-usage' && tabValue !== 5) {
            setTabValue(5);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);
    // Seed orgSection from the persisted admin org scope so a refresh while
    // viewing Skillhub preserves the user's context.
    const [orgSection, setOrgSection] = useState(() => (
        getAdminOrgScope() === 'luc' ? 'luc' : 'skillhub'
    ));

    // Keep the global admin-org-scope in lockstep with orgSection. Without
    // this, a previous session's scope (e.g. 'skillhub_training') stays in
    // localStorage and the axios interceptor silently filters every admin
    // GET to that org — including /api/users, which then returns only the
    // single Skillhub branch user instead of all team leads.
    useEffect(() => {
        if (orgSection === 'luc') {
            setAdminOrgScope('luc');
        } else if (getAdminOrgScope() === 'luc') {
            // Switching into Skillhub: if the persisted scope is still 'luc',
            // default to the Training branch. AdminSkillhubView's branch
            // switcher then owns further changes.
            setAdminOrgScope('skillhub_training');
        }
    }, [orgSection]);
    const [addCommitmentOpen, setAddCommitmentOpen] = useState(false);
    const [filteredCommitments, setFilteredCommitments] = useState([]);
    const [filters] = useState({ search: '', stage: '', status: '', teamLead: '', consultant: '' });

    const [dateRange, setDateRange] = useState({
        startDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        viewType: 'current-week',
    });

    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamDetailOpen, setTeamDetailOpen] = useState(false);
    const [teamCommitments, setTeamCommitments] = useState([]);

    const [selectedConsultant, setSelectedConsultant] = useState(null);
    const [consultantDetailOpen, setConsultantDetailOpen] = useState(false);
    const [consultantPerformance, setConsultantPerformance] = useState(null);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    const [selectedCommitment, setSelectedCommitment] = useState(null);
    const [adminCommentDialogOpen, setAdminCommentDialogOpen] = useState(false);

    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    const [consultants, setConsultants] = useState([]);
    const [consultantDialogOpen, setConsultantDialogOpen] = useState(false);

    const loadCommitments = useCallback(async () => {
        try {
            const data = await commitmentService.getCommitmentsByDateRange(
                dateRange.startDate,
                dateRange.endDate,
                null,
                'luc'
            );
            setCommitments(data.data || []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load commitments');
        }
    }, [dateRange.startDate, dateRange.endDate]);

    const loadUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data.data || data || []);
        } catch (err) {
            setError('Failed to load users');
        }
    };

    const loadConsultants = useCallback(async () => {
        try {
            const response = await consultantService.getConsultants({ organization: 'luc' });
            setConsultants(response.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, []);

    const handleCreateConsultant = async (consultantData) => {
        await consultantService.createConsultant(consultantData);
        await loadConsultants();
        setConsultantDialogOpen(false);
        setSelectedConsultant(null);
    };

    const handleUpdateConsultant = async (consultantData) => {
        await consultantService.updateConsultant(selectedConsultant._id, consultantData);
        await loadConsultants();
        setConsultantDialogOpen(false);
        setSelectedConsultant(null);
    };

    const handleSaveConsultant = async (consultantData) => {
        if (selectedConsultant) await handleUpdateConsultant(consultantData);
        else await handleCreateConsultant(consultantData);
    };

    const handleDeactivateConsultant = async (consultantId) => {
        if (window.confirm('Are you sure you want to deactivate this consultant?')) {
            try {
                await consultantService.deleteConsultant(consultantId);
                await loadConsultants();
            } catch (err) {
                setError('Failed to deactivate consultant');
            }
        }
    };

    useEffect(() => {
        loadUsers();
        loadConsultants();
    }, [loadConsultants]);

    useEffect(() => {
        if (dateRange.startDate && dateRange.endDate) loadCommitments();
    }, [dateRange, loadCommitments]);

    useEffect(() => {
        let filtered = [...commitments];
        if (filters.search) {
            const s = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.studentName?.toLowerCase().includes(s) ||
                c.commitmentMade?.toLowerCase().includes(s) ||
                c.consultantName?.toLowerCase().includes(s) ||
                c.teamName?.toLowerCase().includes(s)
            );
        }
        if (filters.stage) filtered = filtered.filter(c => c.leadStage === filters.stage);
        if (filters.status) filtered = filtered.filter(c => c.status === filters.status);
        if (filters.teamLead) filtered = filtered.filter(c => c.teamLead?._id === filters.teamLead || c.teamLead === filters.teamLead);
        if (filters.consultant) filtered = filtered.filter(c => (c.consultantName || '').trim() === filters.consultant.trim());
        setFilteredCommitments(filtered);
    }, [commitments, filters]);

    const handleDateRangeChange = (newRange) => setDateRange(newRange);

    const displayCommitments =
        filteredCommitments.length > 0 || filters.search || filters.stage || filters.status || filters.consultant || filters.teamLead
            ? filteredCommitments
            : commitments;

    const handleTeamClick = (team) => {
        setSelectedTeam(team);
        const teamComms = displayCommitments.filter(c => c.teamName === team.teamName);
        setTeamCommitments(teamComms);
        setTeamDetailOpen(true);
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

    // Commitment exports now flow through Export Center (/exports) — sidebar
    // and in-context dashboard menus removed in Phase 4 (plan §4 cleanup).

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenAdminComment = (commitment) => {
        setSelectedCommitment(commitment);
        setAdminCommentDialogOpen(true);
    };

    const handleSaveAdminComment = async (commitmentId, data) => {
        try {
            await commitmentService.updateCommitment(commitmentId, data);
            await loadCommitments();
        } catch (err) {
            setError('Failed to save admin comment');
        }
    };

    const handleCreateUser = async (userData) => {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ ...userData, role: 'team_lead' }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to create user');
        }
        await loadUsers();
        setUserDialogOpen(false);
        setSelectedUser(null);
    };

    const handleUpdateUser = async (userData) => {
        const updateData = {
            name: userData.name,
            teamName: userData.teamName,
            isActive: userData.isActive,
        };
        if (userData.password) updateData.password = userData.password;
        await fetch(`${API_BASE_URL}/users/${selectedUser._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(updateData),
        });
        await loadUsers();
        setUserDialogOpen(false);
        setSelectedUser(null);
    };

    const handleSaveUser = async (userData) => {
        if (selectedUser) await handleUpdateUser(userData);
        else await handleCreateUser(userData);
    };

    const handleDeactivateUser = async (userId) => {
        if (window.confirm('Are you sure you want to deactivate this user?')) {
            try {
                await fetch(`${API_BASE_URL}/users/${userId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                await loadUsers();
            } catch (err) {
                setError('Failed to deactivate user');
            }
        }
    };

    const handlePermanentDeleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.')) {
            try {
                const response = await fetch(`${API_BASE_URL}/users/${userId}/permanent`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const data = await response.json();
                if (!response.ok) {
                    window.alert(data.message || 'Failed to delete user');
                    return;
                }
                await loadUsers();
            } catch (err) {
                window.alert('Failed to delete user');
            }
        }
    };

    const handlePermanentDeleteConsultant = async (consultantId) => {
        if (window.confirm('Are you sure you want to PERMANENTLY DELETE this consultant? This action cannot be undone.')) {
            try {
                const response = await fetch(`${API_BASE_URL}/consultants/${consultantId}/permanent`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const data = await response.json();
                if (!response.ok) {
                    window.alert(data.message || 'Failed to delete consultant');
                    return;
                }
                await loadConsultants();
            } catch (err) {
                window.alert('Failed to delete consultant');
            }
        }
    };

    // Derived: teams
    const teamLeads = users.filter(u => u.role === 'team_lead');
    const teams = teamLeads.map(tl => {
        const teamComms = displayCommitments.filter(c => c.teamName === tl.teamName);
        const consultantNames = [...new Set(teamComms.map(c => c.consultantName))];
        const consultantsStats = consultantNames.map(consultantName => {
            const consultantComms = teamComms.filter(c => c.consultantName === consultantName);
            return {
                name: consultantName,
                commitmentCount: consultantComms.length,
                achievedCount: consultantComms.filter(c => c.admissionClosed || c.status === 'achieved').length,
                meetingsTotal: consultantComms.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
            };
        });
        return {
            teamName: tl.teamName,
            teamLead: tl,
            consultants: consultantsStats,
            totalCommitments: teamComms.length,
            achievedCommitments: teamComms.filter(c => c.admissionClosed || c.status === 'achieved').length,
            totalMeetings: teamComms.reduce((sum, c) => sum + (c.meetingsDone || 0), 0),
            closedAdmissions: teamComms.filter(c => c.admissionClosed).length,
        };
    });

    // Top team highlight
    const teamsByRate = teams.map(t => ({
        ...t,
        rate: t.totalCommitments > 0 ? Math.round((t.achievedCommitments / t.totalCommitments) * 100) : 0,
    }));
    const topTeam = [...teamsByRate].sort((a, b) => b.rate - a.rate)[0];
    const topTeamName = topTeam && topTeam.rate >= 70 ? topTeam.teamName : null;

    const totalCommitments = displayCommitments.length;
    const totalAchieved = displayCommitments.filter(c => c.status === 'achieved' || c.admissionClosed).length;
    const totalMeetings = displayCommitments.reduce((sum, c) => sum + (c.meetingsDone || 0), 0);
    const totalClosed = displayCommitments.filter(c => c.admissionClosed).length;
    const orgAchievementRate = totalCommitments > 0 ? Math.round((totalAchieved / totalCommitments) * 100) : 0;
    const totalConsultants = teams.reduce((sum, team) => sum + team.consultants.length, 0);

    const hierarchyTeams = teamLeads.map(tl => {
        const teamConsultants = consultants
            .filter(c => c.teamLead?._id === tl._id || c.teamName === tl.teamName)
            .filter(c => c.isActive !== false)
            .map(c => ({ _id: c._id, name: c.name }));
        return {
            teamName: tl.teamName,
            teamLead: tl,
            consultants: teamConsultants,
            totalCommitments: 0,
        };
    });

    const sidebar = (
        <AdminSidebar
            onLogout={handleLogout}
            onAIAnalysis={() => setTabValue(4)}
            onAPICosts={() => setTabValue(5)}
            onDashboard={() => setTabValue(0)}
            aiAnalysisActive={tabValue === 4}
            apiCostsActive={tabValue === 5}
        />
    );

    const kpiItems = [
        {
            label: 'Total Commitments',
            value: totalCommitments,
            sub: `${teams.length} teams`,
            accent: 'accent',
        },
        {
            label: 'Org Achievement',
            value: orgAchievementRate,
            format: (v) => `${v}%`,
            sub: `${totalAchieved} of ${totalCommitments} achieved`,
            accent: orgAchievementRate >= 70 ? 'success' : orgAchievementRate >= 40 ? 'warm' : 'danger',
        },
        {
            label: 'Total Meetings',
            value: totalMeetings,
            sub: `${totalConsultants} consultants`,
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
        { value: 0, label: 'Teams Overview' },
        { value: 'commitments', label: 'Commitments', icon: <CommitmentsIcon sx={{ fontSize: 18 }} /> },
        { value: 'meetings', label: 'Meetings', icon: <VideoCallIcon sx={{ fontSize: 18 }} /> },
        { value: 'hourly', label: 'Hourly Tracker', icon: <AccessTimeIcon sx={{ fontSize: 18 }} /> },
        { value: 2, label: 'Hierarchy', icon: <HierarchyIcon sx={{ fontSize: 18 }} /> },
        { value: 3, label: 'User Management', icon: <UsersIcon sx={{ fontSize: 18 }} /> },
        { value: 4, label: 'AI Analysis', icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} /> },
        { value: 5, label: 'API Costs', icon: <MoneyIcon sx={{ fontSize: 18 }} /> },
    ];

    const handleTabChange = (v) => {
        if (v === 'commitments') {
            navigate('/commitments');
            return;
        }
        if (v === 'meetings') {
            navigate('/meetings');
            return;
        }
        if (v === 'hourly') {
            setAdminOrgScope('luc');
            navigate('/hourly-tracker');
            return;
        }
        setTabValue(v);
    };

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero
                eyebrow="Administrator"
                title="Organization Dashboard"
                subtitle={formatWeekDisplay(weekInfo.weekNumber, weekInfo.year, weekInfo.weekStartDate, weekInfo.weekEndDate)}
                right={<OrgSwitcher value={orgSection} onChange={setOrgSection} />}
            />

            {orgSection === 'skillhub' ? (
                <motion.div variants={riseV}>
                    <AdminSkillhubView />
                </motion.div>
            ) : (
                <>
                    {tabValue <= 3 && (
                        <SectionCard eyebrow="Date range" padding={18}>
                            <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                        </SectionCard>
                    )}

                    {error && (
                        <motion.div variants={riseV} style={{ marginBottom: 24 }}>
                            <Alert severity="error" onClose={() => setError('')}>
                                {error}
                            </Alert>
                        </motion.div>
                    )}

                    {tabValue <= 3 && <KPIStrip items={kpiItems} />}

                    {tabValue <= 3 && commitments.length > 0 && (
                        <SectionCard title="Organization Analytics" eyebrow="This period">
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
                                        Team performance
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                                        {teamsByRate.map(team => (
                                            <Box key={team.teamName}>
                                                <ProgressBar
                                                    label={team.teamName}
                                                    value={team.rate}
                                                />
                                                <Typography
                                                    sx={{
                                                        mt: 0.5,
                                                        fontSize: 11.5,
                                                        color: 'var(--d-text-muted)',
                                                    }}
                                                >
                                                    {team.totalCommitments} commitments · {team.consultants.length} consultants
                                                </Typography>
                                            </Box>
                                        ))}
                                        {teamsByRate.length === 0 && (
                                            <Typography sx={{ fontSize: 13, color: 'var(--d-text-muted)' }}>
                                                No team activity yet in this period.
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        </SectionCard>
                    )}

                    <DashboardTabs value={tabValue} onChange={handleTabChange} tabs={tabs} />

                    <AnimatedTabPanel panelKey={tabValue}>
                        {tabValue === 0 && (
                            <SectionCard title="Teams" eyebrow="Click a team card to drill in">
                                <PerformerGrid>
                                    {teamsByRate.map(team => (
                                        <PerformerCard
                                            key={team.teamName}
                                            name={team.teamName}
                                            subtitle={`${team.teamLead.name} · ${team.consultants.length} member${team.consultants.length === 1 ? '' : 's'}`}
                                            avatarLabel={<GroupsIcon fontSize="small" />}
                                            metricLabel="Achievement"
                                            metricValue={team.rate}
                                            stats={[
                                                { label: 'Commitments', value: team.totalCommitments },
                                                { label: 'Meetings', value: team.totalMeetings },
                                                { label: 'Closed', value: team.closedAdmissions },
                                            ]}
                                            onClick={() => handleTeamClick(team)}
                                            highlight={team.teamName === topTeamName}
                                        />
                                    ))}
                                    {teamsByRate.length === 0 && (
                                        <Typography sx={{ color: 'var(--d-text-muted)', fontSize: 14 }}>
                                            No teams match this date range / filter.
                                        </Typography>
                                    )}
                                </PerformerGrid>
                            </SectionCard>
                        )}

                        {tabValue === 2 && (
                            <SectionCard title="Organization Hierarchy">
                                <TeamHierarchyView
                                    teams={hierarchyTeams}
                                    adminUser={user}
                                    onTeamClick={handleTeamClick}
                                    onConsultantClick={handleConsultantClick}
                                />
                            </SectionCard>
                        )}

                        {tabValue === 3 && (
                            <>
                                <SectionCard
                                    title="User Management"
                                    right={
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => {
                                                setSelectedUser(null);
                                                setUserDialogOpen(true);
                                            }}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                background: 'var(--d-accent)',
                                                '&:hover': { background: 'var(--d-accent-text)' },
                                                boxShadow: 'none',
                                            }}
                                        >
                                            Add Team Lead
                                        </Button>
                                    }
                                >
                                    <TableContainer>
                                        <Table sx={{ '& .MuiTableCell-root': { borderColor: 'var(--d-border-soft)', color: 'var(--d-text-2)' } }}>
                                            <TableHead>
                                                <TableRow>
                                                    {['Name', 'Email', 'Team', 'Role', 'Status', 'Actions'].map((h) => (
                                                        <TableCell
                                                            key={h}
                                                            align={h === 'Actions' ? 'center' : 'left'}
                                                            sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                                        >
                                                            {h}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {users.filter(u => u.role !== 'consultant').map((u) => (
                                                    <TableRow
                                                        key={u._id}
                                                        sx={{
                                                            transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                                            '&:hover': { backgroundColor: 'var(--d-surface-hover)' },
                                                        }}
                                                    >
                                                        <TableCell>{u.name}</TableCell>
                                                        <TableCell>{u.email}</TableCell>
                                                        <TableCell>{u.teamName || '--'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.role === 'admin' ? 'Admin' : 'Team Lead'}
                                                                size="small"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    fontSize: 11,
                                                                    height: 22,
                                                                    backgroundColor: u.role === 'admin' ? 'var(--d-warm-bg)' : 'var(--d-accent-bg)',
                                                                    color: u.role === 'admin' ? 'var(--d-warm-text)' : 'var(--d-accent-text)',
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={u.isActive !== false ? 'Active' : 'Inactive'}
                                                                size="small"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    fontSize: 11,
                                                                    height: 22,
                                                                    backgroundColor: u.isActive !== false ? 'var(--d-success-bg)' : 'var(--d-surface-muted)',
                                                                    color: u.isActive !== false ? 'var(--d-success-text)' : 'var(--d-text-muted)',
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <IconButton
                                                                size="small"
                                                                sx={{ color: 'var(--d-accent)' }}
                                                                onClick={() => {
                                                                    setSelectedUser(u);
                                                                    setUserDialogOpen(true);
                                                                }}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            {u.role !== 'admin' && (
                                                                <>
                                                                    <IconButton
                                                                        size="small"
                                                                        sx={{ color: 'var(--d-warning)' }}
                                                                        onClick={() => handleDeactivateUser(u._id)}
                                                                        disabled={u.isActive === false}
                                                                    >
                                                                        <CheckCircleIcon fontSize="small" />
                                                                    </IconButton>
                                                                    <IconButton
                                                                        size="small"
                                                                        sx={{ color: 'var(--d-danger)' }}
                                                                        onClick={() => handlePermanentDeleteUser(u._id)}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </SectionCard>

                                <SectionCard
                                    title="Consultant Management"
                                    right={
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => {
                                                setSelectedConsultant(null);
                                                setConsultantDialogOpen(true);
                                            }}
                                            sx={{
                                                textTransform: 'none',
                                                fontWeight: 600,
                                                background: 'var(--d-warm)',
                                                '&:hover': { background: 'var(--d-warm-text)' },
                                                boxShadow: 'none',
                                            }}
                                        >
                                            Add Consultant
                                        </Button>
                                    }
                                >
                                    <TableContainer>
                                        <Table sx={{ '& .MuiTableCell-root': { borderColor: 'var(--d-border-soft)', color: 'var(--d-text-2)' } }}>
                                            <TableHead>
                                                <TableRow>
                                                    {['Name', 'Email', 'Phone', 'Team', 'Team Lead', 'Status', 'Actions'].map((h) => (
                                                        <TableCell
                                                            key={h}
                                                            align={h === 'Actions' ? 'center' : 'left'}
                                                            sx={{ color: 'var(--d-text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                                        >
                                                            {h}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {consultants.map((c) => (
                                                    <TableRow
                                                        key={c._id}
                                                        sx={{
                                                            transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                                            '&:hover': { backgroundColor: 'var(--d-surface-hover)' },
                                                        }}
                                                    >
                                                        <TableCell>{c.name}</TableCell>
                                                        <TableCell>{c.email || '--'}</TableCell>
                                                        <TableCell>{c.phone || '--'}</TableCell>
                                                        <TableCell>{c.teamName}</TableCell>
                                                        <TableCell>{c.teamLead?.name || '--'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={c.isActive !== false ? 'Active' : 'Inactive'}
                                                                size="small"
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    fontSize: 11,
                                                                    height: 22,
                                                                    backgroundColor: c.isActive !== false ? 'var(--d-success-bg)' : 'var(--d-surface-muted)',
                                                                    color: c.isActive !== false ? 'var(--d-success-text)' : 'var(--d-text-muted)',
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <IconButton
                                                                size="small"
                                                                sx={{ color: 'var(--d-accent)' }}
                                                                onClick={() => {
                                                                    setSelectedConsultant(c);
                                                                    setConsultantDialogOpen(true);
                                                                }}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                sx={{ color: 'var(--d-warning)' }}
                                                                onClick={() => handleDeactivateConsultant(c._id)}
                                                                disabled={c.isActive === false}
                                                            >
                                                                <CheckCircleIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                sx={{ color: 'var(--d-danger)' }}
                                                                onClick={() => handlePermanentDeleteConsultant(c._id)}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </SectionCard>
                            </>
                        )}

                        {tabValue === 4 && <AISummaryCard />}
                        {tabValue === 5 && <AIUsageTabs />}
                    </AnimatedTabPanel>
                </>
            )}

            {/* Dialogs */}
            <TeamDetailDialog
                open={teamDetailOpen}
                onClose={() => {
                    setTeamDetailOpen(false);
                    setSelectedTeam(null);
                    setTeamCommitments([]);
                }}
                team={selectedTeam}
                commitments={teamCommitments}
                onConsultantClick={handleConsultantClick}
                onEditCommitment={handleOpenAdminComment}
                onOpenAdminComment={handleOpenAdminComment}
            />

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
                onEditCommitment={handleOpenAdminComment}
                onOpenTLComment={(commitment) => handleOpenAdminComment(commitment)}
                userRole="admin"
            />

            <AdminCommitmentDialog
                open={adminCommentDialogOpen}
                onClose={() => {
                    setAdminCommentDialogOpen(false);
                    setSelectedCommitment(null);
                }}
                commitment={selectedCommitment}
                onSave={handleSaveAdminComment}
            />

            <AdminAddCommitmentDialog
                open={addCommitmentOpen}
                onClose={() => setAddCommitmentOpen(false)}
                onSaved={() => {
                    setAddCommitmentOpen(false);
                    loadCommitments();
                }}
                users={users}
                consultants={consultants}
            />

            <UserManagementDialog
                open={userDialogOpen}
                onClose={() => {
                    setUserDialogOpen(false);
                    setSelectedUser(null);
                }}
                onSave={handleSaveUser}
                user={selectedUser}
            />

            <ConsultantManagementDialog
                open={consultantDialogOpen}
                onClose={() => {
                    setConsultantDialogOpen(false);
                    setSelectedConsultant(null);
                }}
                onSave={handleSaveConsultant}
                consultant={selectedConsultant}
                teamLeads={users.filter(u => u.role === 'team_lead')}
                currentUserRole={user?.role}
                currentUserTeamName={user?.teamName}
            />
        </DashboardShell>
    );
};

export default AdminDashboard;
