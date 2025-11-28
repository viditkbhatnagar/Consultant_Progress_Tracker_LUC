import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import ConsultantDashboard from './pages/ConsultantDashboard';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976D2', // Blue
    },
    secondary: {
      main: '#4CAF50', // Green
    },
    error: {
      main: '#F44336', // Red
    },
    warning: {
      main: '#FF9800', // Orange
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

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
  } else if (user.role === 'consultant') {
    return <Navigate to="/consultant/dashboard" replace />;
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

            {/* Consultant Routes */}
            <Route
              path="/consultant/dashboard"
              element={
                <PrivateRoute allowedRoles={['consultant']}>
                  <ConsultantDashboard />
                </PrivateRoute>
              }
            />

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

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
