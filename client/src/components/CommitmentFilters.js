import React, { useState } from 'react';
import {
    Box,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Grid,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterListIcon } from '@mui/icons-material';

const CommitmentFilters = ({ onFilterChange, leadStages, statuses }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        onFilterChange({ search: value, stage: selectedStage, status: selectedStatus });
    };

    const handleStageChange = (e) => {
        const value = e.target.value;
        setSelectedStage(value);
        onFilterChange({ search: searchTerm, stage: value, status: selectedStatus });
    };

    const handleStatusChange = (e) => {
        const value = e.target.value;
        setSelectedStatus(value);
        onFilterChange({ search: searchTerm, stage: selectedStage, status: value });
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedStage('');
        setSelectedStatus('');
        onFilterChange({ search: '', stage: '', status: '' });
    };

    const hasActiveFilters = searchTerm || selectedStage || selectedStatus;

    return (
        <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search commitments..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Lead Stage</InputLabel>
                        <Select
                            value={selectedStage}
                            label="Lead Stage"
                            onChange={handleStageChange}
                        >
                            <MenuItem value="">All Stages</MenuItem>
                            {leadStages.map((stage) => (
                                <MenuItem key={stage} value={stage}>
                                    {stage}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={selectedStatus}
                            label="Status"
                            onChange={handleStatusChange}
                        >
                            <MenuItem value="">All Statuses</MenuItem>
                            {statuses.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {status}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={2}>
                    {hasActiveFilters && (
                        <Chip
                            label="Clear Filters"
                            onClick={handleClearFilters}
                            onDelete={handleClearFilters}
                            color="primary"
                            variant="outlined"
                        />
                    )}
                </Grid>
            </Grid>
        </Box>
    );
};

export default CommitmentFilters;
