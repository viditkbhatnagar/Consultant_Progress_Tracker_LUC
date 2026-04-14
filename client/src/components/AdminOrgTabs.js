import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useAdminOrgScope } from '../utils/adminOrgScope';

// Compact [LUC] [Skillhub] toggle. Visible only for admin users.
// Emits `onChange(newOrg)` after the scope has been updated so the parent
// page can force a data reload (e.g. by bumping a `key` on its data panel).
const AdminOrgTabs = ({ onChange, sx }) => {
    const { user } = useAuth();
    const [org, setOrg] = useAdminOrgScope();

    if (user?.role !== 'admin') return null;

    const handleChange = (_, value) => {
        setOrg(value);
        onChange?.(value);
    };

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
                value={org}
                onChange={handleChange}
                sx={{ '& .MuiTab-root': { fontWeight: 600, px: 4 } }}
            >
                <Tab label="LUC" value="luc" />
                <Tab label="Skillhub Training" value="skillhub_training" />
                <Tab label="Skillhub Institute" value="skillhub_institute" />
            </Tabs>
        </Box>
    );
};

export default AdminOrgTabs;
