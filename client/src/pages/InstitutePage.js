import React, { useState } from 'react';
import { Box, Tabs, Tab, Typography, IconButton, Tooltip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TeachersTab from '../components/institute/TeachersTab';
import TimetableTab from '../components/institute/TimetableTab';
import AttendanceTab from '../components/institute/AttendanceTab';

// Skillhub Institute — Teachers, Timetable, Attendance. Standalone full-page
// route (like the Hourly Tracker). Reached from the Institute branch login's
// sidebar + the admin sidebar. Data is backend-scoped to skillhub_institute.
const InstitutePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState(0);

    const back = () => navigate(user?.role === 'admin' ? '/admin/dashboard' : '/skillhub/dashboard');

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f0f3f8' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 2, bgcolor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
                <Tooltip title="Back"><IconButton size="small" onClick={back}><ArrowBackIcon /></IconButton></Tooltip>
                <Box>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>Institute</Typography>
                    <Typography sx={{ fontSize: 13, color: '#57564E' }}>Teachers · Timetable · Attendance</Typography>
                </Box>
            </Box>

            <Box sx={{ px: 3, bgcolor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ '& .MuiTab-root': { fontWeight: 700, textTransform: 'none' } }}>
                    <Tab label="Timetable" />
                    <Tab label="Attendance" />
                    <Tab label="Teachers" />
                </Tabs>
            </Box>

            <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
                {tab === 0 && <TimetableTab />}
                {tab === 1 && <AttendanceTab />}
                {tab === 2 && <TeachersTab />}
            </Box>
        </Box>
    );
};

export default InstitutePage;
