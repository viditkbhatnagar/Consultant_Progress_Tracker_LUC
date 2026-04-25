import React from 'react';
import { Stack, Chip } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

// Role-filtered dataset chips. Mirrors the permission matrix in plan §6.
const ALL_DATASETS = [
    { key: 'students',    label: 'Students' },
    { key: 'commitments', label: 'Commitments' },
    { key: 'meetings',    label: 'Meetings' },
    { key: 'hourly',      label: 'Hourly' },
];

const ROLE_DATASETS = {
    admin:     ['students', 'commitments', 'meetings', 'hourly'],
    team_lead: ['students', 'commitments', 'meetings', 'hourly'],
    manager:   ['students'],
    skillhub:  ['students', 'commitments', 'hourly'],
};

const DatasetSelector = ({ value, onChange }) => {
    const { user } = useAuth();
    const allowed = ROLE_DATASETS[user?.role] || [];
    const datasets = ALL_DATASETS.filter((d) => allowed.includes(d.key));

    return (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {datasets.map((d) => (
                <Chip
                    key={d.key}
                    label={d.label}
                    color={value === d.key ? 'primary' : 'default'}
                    variant={value === d.key ? 'filled' : 'outlined'}
                    onClick={() => onChange?.(d.key)}
                    sx={{ fontWeight: 600, px: 1 }}
                />
            ))}
        </Stack>
    );
};

export default DatasetSelector;
