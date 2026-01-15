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

const StudentDatabasePage = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    
    const [consultants, setConsultants] = useState([]);
    const [teamLeads, setTeamLeads] = useState([]);

    // Load consultants
    const loadConsultants = useCallback(async () => {
        try {
            const response = await consultantService.getConsultants();
            setConsultants(response.data || []);
        } catch (err) {
            console.error('Failed to load consultants:', err);
        }
    }, []);

    // Load team leads (only for admin)
    const loadTeamLeads = useCallback(async () => {
        if (user?.role === 'admin') {
            try {
                const data = await getUsers();
                const users = data.data || data || [];
                setTeamLeads(users.filter(u => u.role === 'team_lead'));
            } catch (err) {
                console.error('Failed to load team leads:', err);
            }
        }
    }, [user?.role]);

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
        } else {
            navigate('/team-lead/dashboard');
        }
    };

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
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={handleBack}
                        sx={{ color: 'white' }}
                    >
                        Back to Dashboard
                    </Button>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        Student Database
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1">
                        {user?.name} ({user?.role === 'admin' ? 'Admin' : user?.teamName})
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
                <StudentTable
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
