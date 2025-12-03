import React, { useState } from 'react';
import {
    Box,
    TextField,
    InputAdornment,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Grid,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

const CommitmentFilters = ({ onFilterChange, leadStages, statuses, consultants, teamLeads }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedConsultant, setSelectedConsultant] = useState('');
    const [selectedTeamLead, setSelectedTeamLead] = useState('');

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        onFilterChange({ search: value, stage: selectedStage, status: selectedStatus, consultant: selectedConsultant, teamLead: selectedTeamLead });
    };

    const handleStageChange = (e) => {
        const value = e.target.value;
        setSelectedStage(value);
        onFilterChange({ search: searchTerm, stage: value, status: selectedStatus, consultant: selectedConsultant, teamLead: selectedTeamLead });
    };

    const handleStatusChange = (e) => {
        const value = e.target.value;
        setSelectedStatus(value);
        onFilterChange({ search: searchTerm, stage: selectedStage, status: value, consultant: selectedConsultant, teamLead: selectedTeamLead });
    };

    const handleConsultantChange = (e) => {
        const value = e.target.value;
        setSelectedConsultant(value);
        onFilterChange({ search: searchTerm, stage: selectedStage, status: selectedStatus, consultant: value, teamLead: selectedTeamLead });
    };

    const handleTeamLeadChange = (e) => {
        const value = e.target.value;
        setSelectedTeamLead(value);
        // Reset consultant when team lead changes
        setSelectedConsultant('');
        onFilterChange({ search: searchTerm, stage: selectedStage, status: selectedStatus, consultant: '', teamLead: value });
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedStage('');
        setSelectedStatus('');
        setSelectedConsultant('');
        setSelectedTeamLead('');
        onFilterChange({ search: '', stage: '', status: '', consultant: '', teamLead: '' });
    };

    const hasActiveFilters = searchTerm || selectedStage || selectedStatus || selectedConsultant || selectedTeamLead;

    return (
        <Box sx={{ mb: 3 }}>
            <Grid container spacing={3}>
                {/* Search - Full Width */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        size="medium"
                        placeholder="Search by student name, commitment, consultant, or team..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minHeight: '56px' }}
                    />
                </Grid>

                {/* Lead Stage */}
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <FormControl fullWidth size="medium">
                        <InputLabel sx={{ fontSize: '1rem' }}>Lead Stage</InputLabel>
                        <Select
                            value={selectedStage}
                            label="Lead Stage"
                            onChange={handleStageChange}
                            sx={{ minHeight: '56px' }}
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

                {/* Status */}
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <FormControl fullWidth size="medium">
                        <InputLabel sx={{ fontSize: '1rem' }}>Status</InputLabel>
                        <Select
                            value={selectedStatus}
                            label="Status"
                            onChange={handleStatusChange}
                            sx={{ minHeight: '56px' }}
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

                {/* Team Lead */}
                {teamLeads && teamLeads.length > 0 && (
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <FormControl fullWidth size="medium">
                            <InputLabel sx={{ fontSize: '1rem' }}>Team Lead</InputLabel>
                            <Select
                                value={selectedTeamLead}
                                label="Team Lead"
                                onChange={handleTeamLeadChange}
                                sx={{ minHeight: '56px' }}
                            >
                                <MenuItem value="">All Teams</MenuItem>
                                {teamLeads.map((tl) => (
                                    <MenuItem key={tl._id} value={tl._id}>
                                        {tl.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                )}

                {/* Consultant */}
                {consultants && consultants.length > 0 && (
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <FormControl fullWidth size="medium">
                            <InputLabel sx={{ fontSize: '1rem' }}>Consultant</InputLabel>
                            <Select
                                value={selectedConsultant}
                                label="Consultant"
                                onChange={handleConsultantChange}
                                sx={{ minHeight: '56px' }}
                            >
                                <MenuItem value="">All Consultants</MenuItem>
                                {consultants.map((consultant) => (
                                    <MenuItem key={consultant._id || consultant.name} value={consultant.name}>
                                        {consultant.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                )}

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Button
                            variant="outlined"
                            color="primary"
                            fullWidth
                            onClick={handleClearFilters}
                            size="large"
                            sx={{ height: '56px', fontSize: '1rem' }}
                        >
                            Clear All Filters
                        </Button>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

export default CommitmentFilters;
