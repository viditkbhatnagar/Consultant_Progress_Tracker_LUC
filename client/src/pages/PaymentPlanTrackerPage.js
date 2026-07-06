import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import PaymentPlanPanel from '../components/paymentPlans/PaymentPlanPanel';

export default function PaymentPlanTrackerPage() {
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
                Payment Plans
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'var(--d-text-3, #57564E)', mb: 2 }}>
                Payment Plan Tracker — {isAdmin ? 'every team, grouped by team' : "your team's admissions"}
            </Typography>
            <PaymentPlanPanel isAdmin={isAdmin} />
        </DashboardShell>
    );
}
