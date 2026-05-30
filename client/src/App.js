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
import CommitmentsPage from './pages/CommitmentsPage';
import SkillhubDashboard from './pages/SkillhubDashboard';
import ExportCenterPage from './pages/ExportCenterPage';
import AdminReconciliationPage from './pages/AdminReconciliationPage';
import PdfViewer from './pages/PdfViewer';
import ExecutiveOverviewPage from './pages/ExecutiveOverviewPage';
import ConsultantPerformancePage from './pages/ConsultantPerformancePage';
import TeamDetailPage from './pages/TeamDetailPage';
import TierPage from './pages/TierPage';
import MonthlyTargetsPage from './pages/MonthlyTargetsPage';
import FloatingChatLauncher from './components/chat/FloatingChatLauncher';
import AnnouncementBanner from './components/AnnouncementBanner';
import TierAnnounceModal from './components/tiers/TierAnnounceModal';
import FloatingFullscreenButton from './components/FloatingFullscreenButton';
import { FullscreenProvider } from './context/FullscreenContext';
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
        <FullscreenProvider>
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

            {/* Student Database - admin, team_lead, manager, and skillhub.
                The dispatcher inside StudentDatabasePage picks the LUC or
                Skillhub variant based on the caller's org. */}
            <Route
              path="/student-database"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead', 'manager', 'skillhub']}>
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

            {/* Commitment Tracker - admin, team_lead, and skillhub.
                The page reads the caller's org (user.organization or admin's
                current adminOrgScope) and swaps in the Skillhub form dialog
                when appropriate. */}
            <Route
              path="/commitments"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead', 'skillhub']}>
                  <CommitmentsPage />
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

            {/* Export Center — admin, team_lead, manager, skillhub. The page
                hides datasets the role can't access and gates org tabs per
                the permission matrix in the plan §6. */}
            <Route
              path="/exports"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead', 'manager', 'skillhub']}>
                  <ExportCenterPage />
                </PrivateRoute>
              }
            />

            {/* Reconciliation page — admin-only. Pairs LUC closed
                commitments with their student records to keep the two
                sources aligned (per the FK spine added in fix/admission-tracker-consistency). */}
            <Route
              path="/admin/reconciliation"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminReconciliationPage />
                </PrivateRoute>
              }
            />

            {/* Authenticated PDF viewer for program docs (LUC only).
                PrivateRoute keeps manager + skillhub out; the PDF-fetch
                call itself also re-enforces LUC via the server's
                orgGate('luc') middleware. */}
            <Route
              path="/pdf-viewer"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <PdfViewer />
                </PrivateRoute>
              }
            />

            {/* Leadership Dashboard — LUC org-wide rollup of sales
                performance (renamed from Executive Overview). Both admin and
                team_lead are routed here; the page shows the full view to
                admin and a Coming Soon lock to team leads. */}
            <Route
              path="/leadership-dashboard"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <ExecutiveOverviewPage />
                </PrivateRoute>
              }
            />
            {/* Back-compat: the old route redirects to the renamed one. */}
            <Route path="/executive-overview" element={<Navigate to="/leadership-dashboard" replace />} />

            {/* All Teams — per-team dashboard mirroring the Excel team sheet.
                Admin can view any team via the dropdown; team_lead is locked
                to own team via the controller-level role guard. */}
            <Route
              path="/team-dashboard/:teamLeadId"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <TeamDetailPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/team-dashboard"
              element={
                <PrivateRoute allowedRoles={['team_lead']}>
                  <TeamDetailPage />
                </PrivateRoute>
              }
            />

            {/* Consultant Performance — Category A/B rankings + top-5
                leaderboard. Admin sees all; team_lead gets Coming Soon. */}
            <Route
              path="/consultant-performance"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <ConsultantPerformancePage />
                </PrivateRoute>
              }
            />

            <Route
              path="/tiers"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <TierPage />
                </PrivateRoute>
              }
            />

            {/* Monthly Targets editor — admin sets per-consultant monthly
                targets. Kept reachable but no longer in the sidebar (target
                editing also happens inline in the All Teams sheet). */}
            <Route
              path="/monthly-targets"
              element={
                <PrivateRoute allowedRoles={['admin', 'team_lead']}>
                  <MonthlyTargetsPage />
                </PrivateRoute>
              }
            />

            {/* Legacy admin-docs-rag URL — kept as a redirect so existing
                bookmarks / deep-links land on the new "AI Usage → Docs RAG"
                tab. Same deal for /admin/api-costs. Both go through the
                main admin dashboard with ?section=ai-usage so the existing
                sidebar-driven tab activation fires. */}
            <Route
              path="/admin/docs-rag"
              element={
                <Navigate
                  to="/admin/dashboard?section=ai-usage&tab=docs-rag"
                  replace
                />
              }
            />
            <Route
              path="/admin/api-costs"
              element={
                <Navigate
                  to="/admin/dashboard?section=ai-usage"
                  replace
                />
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {/* App-wide announcement banner + live toast — shows on every
              authenticated page; self-hides when there's nothing active. */}
          <AnnouncementBanner />
          {/* Tier-standings modal — pops for team leads when admin generates. */}
          <TierAnnounceModal />
          {/* Chat copilot — visible on every authenticated page,
              hidden on /login via the component itself. */}
          <FloatingChatLauncher />
          {/* Full-screen focus toggle — hides the sidebar, expands main. */}
          <FloatingFullscreenButton />
        </Router>
        </FullscreenProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
