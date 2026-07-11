import React, { useState } from 'react';
import { Tabs, Tab } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDashboardThemeState } from '../utils/dashboardTheme';
import AdminSidebar from '../components/AdminSidebar';
import SkillhubSidebar from '../components/skillhub/SkillhubSidebar';
import DashboardShell from '../components/dashboard/DashboardShell';
import DashboardHero from '../components/dashboard/DashboardHero';
import TeachersTab from '../components/institute/TeachersTab';
import TimetableTab from '../components/institute/TimetableTab';
import AttendanceTab from '../components/institute/AttendanceTab';

// Skillhub Institute — Teachers, Timetable, Attendance. Rendered inside the
// standard dashboard shell (persistent sidebar + light/dark tokens + hero),
// matching the rest of the app. Admin gets the admin sidebar; the Institute
// branch login gets the Skillhub sidebar. Backend scopes to skillhub_institute.
const InstitutePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const themeState = useDashboardThemeState('skillhub-theme-mode');
    const isAdmin = user?.role === 'admin';
    const [tab, setTab] = useState(0);

    const handleLogout = () => { logout(); navigate('/login'); };
    const sidebar = isAdmin ? (
        <AdminSidebar onLogout={handleLogout} onDashboard={() => navigate('/admin/dashboard')} />
    ) : (
        <SkillhubSidebar
            activeView="institute"
            onNavigate={() => navigate('/skillhub/dashboard')}
            onNewAdmission={() => navigate('/skillhub/dashboard')}
            onLogout={handleLogout}
        />
    );

    return (
        <DashboardShell sidebar={sidebar} themeState={themeState}>
            <DashboardHero eyebrow="Skillhub Institute" title="Institute" subtitle="Teachers · Timetable · Attendance" />

            <Tabs
                value={tab}
                onChange={(e, v) => setTab(v)}
                sx={{ mb: 2, borderBottom: '1px solid var(--d-border-soft, #ECE9E2)', '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}
            >
                <Tab label="Timetable" />
                <Tab label="Attendance" />
                <Tab label="Teachers" />
            </Tabs>

            {tab === 0 && <TimetableTab />}
            {tab === 1 && <AttendanceTab />}
            {tab === 2 && <TeachersTab />}
        </DashboardShell>
    );
};

export default InstitutePage;
