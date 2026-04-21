import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StudentDatabasePage from './pages/StudentDatabasePage';
import HourlyTrackerPage from './pages/HourlyTrackerPage';
import MeetingTrackerPage from './pages/MeetingTrackerPage';
import SkillhubDashboard from './pages/SkillhubDashboard';
import theme from './theme';

// Home redirect component
const HomeRedirect = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect based on role
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user.role === 'team_lead') {
    return <Navigate to="/team-lead/dashboard" replace />;
  } else if (user.role === 'manager') {
    return <Navigate to="/student-database" replace />;
  } else if (user.role === 'skillhub') {
    return <Navigate to="/skillhub/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<HomeRedirect />} />

            {/* Team Lead Routes */}
            <Route
              path="/team-lead/dashboard"
              element={
                <PrivateRoute allowedRoles={['team_lead']}>
                  <TeamLeadDashboard />
                </PrivateRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />

            {/* Student Database - accessible by both admin and team_lead */}
            <Route
              path="/student-database"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead', 'manager']}>
                  <StudentDatabasePage />
                </PrivateRoute>
              }
            />

            {/* Hourly Tracker - accessible by admin, team_lead, and skillhub */}
            <Route
              path="/hourly-tracker"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead', 'skillhub']}>
                  <HourlyTrackerPage />
                </PrivateRoute>
              }
            />

            {/* Meeting Tracker - LUC admin + team_lead */}
            <Route
              path="/meetings"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <MeetingTrackerPage />
                </PrivateRoute>
              }
            />

            {/* Skillhub Dashboard */}
            <Route
              path="/skillhub/dashboard"
              element={
                <PrivateRoute allowedRoles={['skillhub']}>
                  <SkillhubDashboard />
                </PrivateRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
