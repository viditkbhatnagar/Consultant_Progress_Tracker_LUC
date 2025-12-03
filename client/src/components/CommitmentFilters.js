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
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3} lg={2.5}>
                    <TextField
                        fullWidth
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

                <Grid item xs={12} sm={6} md={2.5} lg={2}>
                    <FormControl fullWidth>
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

                <Grid item xs={12} sm={6} md={2.5} lg={2}>
                    <FormControl fullWidth>
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

                {teamLeads && teamLeads.length > 0 && (
                    <Grid item xs={12} sm={6} md={2.5} lg={2}>
                        <FormControl fullWidth>
                            <InputLabel>Team Lead</InputLabel>
                            <Select
                                value={selectedTeamLead}
                                label="Team Lead"
                                onChange={handleTeamLeadChange}
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

                {consultants && consultants.length > 0 && (
                    <Grid item xs={12} sm={6} md={2.5} lg={2}>
                        <FormControl fullWidth>
                            <InputLabel>Consultant</InputLabel>
                            <Select
                                value={selectedConsultant}
                                label="Consultant"
                                onChange={handleConsultantChange}
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

                <Grid item xs={12} sm={6} md={1.5} lg={1.5}>
                    {hasActiveFilters && (
                        <Chip
                            label="Clear"
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
