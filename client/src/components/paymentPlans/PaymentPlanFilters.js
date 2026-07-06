import React from 'react';
import {
    Box,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    InputAdornment,
    Button,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { PAYMENT_PLAN_STATUSES } from '../../utils/paymentPlanDesign';

const Dropdown = ({ label, value, onChange, options, minWidth = 150 }) => (
    <FormControl size="small" sx={{ minWidth }}>
        <InputLabel>{label}</InputLabel>
        <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            {options.map((o) => (
                <MenuItem key={o} value={o}>{o}</MenuItem>
            ))}
        </Select>
    </FormControl>
);

// Client-side filter toolbar for the Payment Plan tracker. Team leads don't
// get the Team dropdown (their data is already scoped to their own team);
// admin does, to slice across teams. Dropdown options are the distinct values
// present in the current dataset (passed in via `options`).
const PaymentPlanFilters = ({ filters, setFilters, options, isAdmin, resultCount, totalCount }) => {
    const set = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }));
    const anyActive =
        filters.search || filters.status || filters.team || filters.consultant || filters.month;
    const clearAll = () =>
        setFilters({ search: '', status: '', team: '', consultant: '', month: '' });

    return (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder="Search student, consultant, remarks…"
                    value={filters.search}
                    onChange={(e) => set('search')(e.target.value)}
                    sx={{ minWidth: 240, flex: '1 1 240px' }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                        ),
                    }}
                />
                <Dropdown label="Status" value={filters.status} onChange={set('status')} options={PAYMENT_PLAN_STATUSES} minWidth={170} />
                {isAdmin && (
                    <Dropdown label="Team" value={filters.team} onChange={set('team')} options={options.teams} />
                )}
                <Dropdown label="Consultant" value={filters.consultant} onChange={set('consultant')} options={options.consultants} />
                <Dropdown label="Month" value={filters.month} onChange={set('month')} options={options.months} minWidth={120} />
                {anyActive && (
                    <Button size="small" startIcon={<ClearIcon />} onClick={clearAll} color="inherit">
                        Clear
                    </Button>
                )}
            </Box>
            <Typography sx={{ mt: 1, fontSize: 12, color: 'var(--d-text-muted, #8A887E)' }}>
                Showing {resultCount} of {totalCount}
            </Typography>
        </Box>
    );
};

export default PaymentPlanFilters;
