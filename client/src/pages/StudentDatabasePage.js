import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useAdminOrgScope } from '../utils/adminOrgScope';
import { isSkillhubOrg } from '../utils/hourlyConfig';
import LucStudentDatabasePage from './LucStudentDatabasePage';
import SkillhubStudentDatabasePage from './SkillhubStudentDatabasePage';

// Thin dispatcher: admin's currently selected org (LUC vs Skillhub) or the
// logged-in user's own organization decides which page renders. Keeping hook
// order stable inside each target component — same pattern as the Hourly
// Tracker dispatcher.
const StudentDatabasePage = () => {
    const { user } = useAuth();
    const [adminOrg] = useAdminOrgScope();
    const viewOrg =
        user?.role === 'admin' ? adminOrg || 'luc' : user?.organization || 'luc';
    if (isSkillhubOrg(viewOrg)) {
        return <SkillhubStudentDatabasePage />;
    }
    return <LucStudentDatabasePage />;
};

export default StudentDatabasePage;
