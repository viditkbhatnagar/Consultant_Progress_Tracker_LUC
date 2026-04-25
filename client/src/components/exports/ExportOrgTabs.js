import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

// Export Center org tabs. Independent from the page-wide `adminOrgScope`
// (intentional — switching the tab on /exports must not flip the org tab on
// /student-database). Visible: admin always; manager when dataset === 'students';
// team_lead and skillhub never (locked to their natural scope).
const ExportOrgTabs = ({ value, onChange, includeAll = true, dataset, sx }) => {
    const { user } = useAuth();

    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';

    // Manager only sees these tabs on the students dataset.
    if (!isAdmin && !(isManager && dataset === 'students')) return null;

    const handleChange = (_, next) => onChange?.(next);

    return (
        <Box
            sx={{
                mb: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: 1,
                display: 'inline-block',
                ...sx,
            }}
        >
            <Tabs
                value={value || 'luc'}
                onChange={handleChange}
                sx={{ '& .MuiTab-root': { fontWeight: 600, px: 4 } }}
            >
                <Tab label="LUC" value="luc" />
                <Tab label="Skillhub Training" value="skillhub_training" />
                <Tab label="Skillhub Institute" value="skillhub_institute" />
                {includeAll && <Tab label="All" value="all" />}
            </Tabs>
        </Box>
    );
};

export default ExportOrgTabs;
