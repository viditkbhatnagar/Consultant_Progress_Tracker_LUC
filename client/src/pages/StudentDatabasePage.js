import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Menu,
    MenuItem,
} from '@mui/material';
import {
    Logout as LogoutIcon,
    ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import consultantService from '../services/consultantService';
import { getUsers } from '../services/authService';
import StudentTable from '../components/StudentTable';
import AdminOrgTabs from '../components/AdminOrgTabs';
import { useAdminOrgScope } from '../utils/adminOrgScope';

const StudentDatabasePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [adminOrg] = useAdminOrgScope();

    const [consultants, setConsultants] = useState([]);
    const [teamLeads, setTeamLeads] = useState([]);

    // Load consultants scoped to the admin's current LUC/Skillhub selection
    // (explicit — not reliant on the axios interceptor). Non-admin roles
    // are auto-scoped server-side by their own organization.
    const loadConsultants = useCallback(async () => {
        try {
            const filters =
                user?.role === 'admin' ? { organization: adminOrg } : {};
            const response = await consultantService.getConsultants(filters);
            setConsultants(response.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, [adminOrg, user?.role]);

    // Load team leads / branch owners — scoped by admin's current org.
    // - LUC admin tab: shows team_lead users.
    // - Skillhub admin tabs: shows the skillhub branch login for that org
    //   (admin uses this to pick which branch a new student is assigned to).
    const loadTeamLeads = useCallback(async () => {
        if (user?.role === 'admin') {
            try {
                const data = await getUsers();
                const users = data.data || data || [];
                const filtered = users.filter((u) => {
                    if (adminOrg === 'luc') return u.role === 'team_lead';
                    return u.role === 'skillhub' && u.organization === adminOrg;
                });
                setTeamLeads(filtered);
            } catch (err) {
                console.error('Failed to load team leads:', err);
            }
        } else if (user?.role === 'team_lead' || user?.role === 'skillhub') {
            setTeamLeads([
                {
                    _id: user._id || user.id,
                    name: user.name,
                    teamName: user.teamName,
                    role: user.role,
                },
            ]);
        }
    }, [user, adminOrg]);

    useEffect(() => {
        loadConsultants();
        loadTeamLeads();
    }, [loadConsultants, loadTeamLeads]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleBack = () => {
        if (user?.role === 'admin') {
            navigate('/admin/dashboard');
        } else if (user?.role === 'team_lead') {
            navigate('/team-lead/dashboard');
        }
    };

    const isManager = user?.role === 'manager';

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#A0D2EB' }}>
            {/* Header */}
            <Box
                sx={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    py: 2,
                    px: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {!isManager && (
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={handleBack}
                            sx={{ color: 'white' }}
                        >
                            Back to Dashboard
                        </Button>
                    )}
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        Student Database
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1">
                        {user?.name} ({user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Manager' : user?.teamName})
                    </Typography>
                    <Button
                        startIcon={<LogoutIcon />}
                        onClick={handleLogout}
                        sx={{ color: 'white' }}
                    >
                        Logout
                    </Button>
                </Box>
            </Box>

            {/* Main Content */}
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <AdminOrgTabs />
                {/* `key` remounts StudentTable when admin switches orgs so its
                    internal state (filters, cached students) fully resets. */}
                <StudentTable
                    key={user?.role === 'admin' ? `org:${adminOrg}` : 'fixed'}
                    consultants={consultants}
                    teamLeads={teamLeads}
                    currentUserRole={user?.role}
                    currentUser={user}
                />
            </Container>
        </Box>
    );
};

export default StudentDatabasePage;
