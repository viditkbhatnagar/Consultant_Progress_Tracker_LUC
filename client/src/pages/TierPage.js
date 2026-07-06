import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Tabs, Tab } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import Sidebar from '../components/Sidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import SectionCard from '../components/dashboard/SectionCard';
import TierBoard from '../components/tiers/TierBoard';
import PaymentPlanPanel from '../components/paymentPlans/PaymentPlanPanel';

export default function TierPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const themeState = useDashboardThemeState('dashboard-theme-mode');
    const isAdmin = user?.role === 'admin';
    const [tab, setTab] = useState(0);

    const handleLogout = () => { logout(); navigate('/login'); };
    const sidebar = isAdmin ? (
        <AdminSidebar onLogout={handleLogout} onDashboard={() => navigate('/admin/dashboard')} />
    ) : (
        <Sidebar onLogout={handleLogout} onDashboard={() => navigate('/team-lead/dashboard')} />
    );

    const subtitle = tab === 0
        ? `Tier standings — ${isAdmin ? 'generate & post a fresh image to everyone' : 'live tier leaderboard'}`
        : `Payment plans — ${isAdmin ? 'every team, grouped' : "your team's admissions"}`;

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: 'var(--d-text, #191918)', lineHeight: 1.1 }}>
                Tier Fight
            </Typography>
            <Typography sx={{ fontSize: 14, color: 'var(--d-text-3, #57564E)', mb: 1.5 }}>
                {subtitle}
            </Typography>

            <Tabs
                value={tab}
                onChange={(e, v) => setTab(v)}
                sx={{ mb: 2, borderBottom: '1px solid var(--d-border-soft, #ECE9E2)', '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}
            >
                <Tab label="Tier Standings" />
                <Tab label="Payment Plans" />
            </Tabs>

            {tab === 0 ? (
                <SectionCard title="Tier Standings" eyebrow="Live MTD by tier">
                    <TierBoard isAdmin={isAdmin} mode={themeState.mode} />
                </SectionCard>
            ) : (
                <PaymentPlanPanel isAdmin={isAdmin} />
            )}
        </DashboardShell>
    );
}
