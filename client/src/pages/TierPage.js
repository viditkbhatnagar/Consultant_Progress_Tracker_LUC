import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import SectionCard from '../components/dashboard/SectionCard';
import TierBoard from '../components/tiers/TierBoard';

export default function TierPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const themeState = useDashboardThemeState('dashboard-theme-mode');
    const isAdmin = user?.role === 'admin';

    const handleLogout = () => { logout(); navigate('/login'); };
    const sidebar = isAdmin ? (
        <AdminSidebar onLogout={handleLogout} onDashboard={() => navigate('/admin/dashboard')} />
    ) : (
        <Sidebar onLogout={handleLogout} onDashboard={() => navigate('/team-lead/dashboard')} />
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'var(--d-text, #191918)', lineHeight: 1.1 }}>
                Month-End Race
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'var(--d-text-3, #57564E)', mb: 2 }}>
                Tier standings — {isAdmin ? 'generate & post a fresh image to everyone' : 'live tier leaderboard'}
            </Typography>
            <SectionCard title="Tier Standings" eyebrow="Live MTD by tier">
                <TierBoard isAdmin={isAdmin} />
            </SectionCard>
        </DashboardShell>
    );
}
