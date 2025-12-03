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
    Paper,
    Typography,
    Chip,
    IconButton,
    Collapse,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { 
    Search as SearchIcon, 
    FilterList as FilterListIcon,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

const CommitmentFilters = ({ onFilterChange, leadStages, statuses, consultants, teamLeads }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStage, setSelectedStage] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedConsultant, setSelectedConsultant] = useState('');
    const [selectedTeamLead, setSelectedTeamLead] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(true);

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
    const activeFilterCount = [searchTerm, selectedStage, selectedStatus, selectedConsultant, selectedTeamLead].filter(Boolean).length;

    return (
        <Paper 
            elevation={0} 
            sx={{ 
                mb: 3, 
                p: 3, 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: '#f8fafc',
            }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FilterListIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        Filters
                    </Typography>
                    {activeFilterCount > 0 && (
                        <Chip 
                            label={`${activeFilterCount} active`} 
                            size="small" 
                            color="primary" 
                            sx={{ fontWeight: 600, height: 24 }}
                        />
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {hasActiveFilters && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={handleClearFilters}
                            color="error"
                            sx={{ 
                                fontWeight: 600,
                                borderRadius: 2,
                                textTransform: 'none',
                            }}
                        >
                            Clear All
                        </Button>
                    )}
                    <IconButton 
                        size="small" 
                        onClick={() => setFiltersExpanded(!filtersExpanded)}
                        sx={{ 
                            color: 'text.secondary',
                            bgcolor: 'white',
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': { bgcolor: 'grey.100' },
                        }}
                    >
                        {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Box>
            </Box>

            {/* Search Bar */}
            <TextField
                fullWidth
                placeholder="Search by student name, commitment, consultant, or team..."
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                        <InputAdornment position="end">
                            <IconButton 
                                size="small" 
                                onClick={() => {
                                    setSearchTerm('');
                                    onFilterChange({ search: '', stage: selectedStage, status: selectedStatus, consultant: selectedConsultant, teamLead: selectedTeamLead });
                                }}
                            >
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
                sx={{
                    mb: 2.5,
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'white',
                        fontSize: '0.95rem',
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'primary.main',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: 2,
                        },
                    },
                }}
            />

            {/* Filter Dropdowns */}
            <Collapse in={filtersExpanded}>
                <Grid container spacing={2}>
                    {/* Lead Stage */}
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                            <InputLabel 
                                shrink 
                                sx={{ 
                                    backgroundColor: '#f8fafc', 
                                    px: 0.5,
                                    fontWeight: 600,
                                    color: 'text.primary',
                                }}
                            >
                                Lead Stage
                            </InputLabel>
                            <Select
                                value={selectedStage}
                                onChange={handleStageChange}
                                displayEmpty
                                notched
                                label="Lead Stage"
                                sx={{
                                    borderRadius: 2,
                                    backgroundColor: 'white',
                                    '& .MuiSelect-select': {
                                        py: 1.5,
                                    },
                                }}
                            >
                                <MenuItem value="">All Stages</MenuItem>
                                {leadStages.map((stage) => (
                                    <MenuItem key={stage} value={stage}>{stage}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Status */}
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                            <InputLabel 
                                shrink 
                                sx={{ 
                                    backgroundColor: '#f8fafc', 
                                    px: 0.5,
                                    fontWeight: 600,
                                    color: 'text.primary',
                                }}
                            >
                                Status
                            </InputLabel>
                            <Select
                                value={selectedStatus}
                                onChange={handleStatusChange}
                                displayEmpty
                                notched
                                label="Status"
                                sx={{
                                    borderRadius: 2,
                                    backgroundColor: 'white',
                                    '& .MuiSelect-select': {
                                        py: 1.5,
                                    },
                                }}
                            >
                                <MenuItem value="">All Statuses</MenuItem>
                                {statuses.map((status) => (
                                    <MenuItem key={status} value={status}>{status}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Team Lead */}
                    {teamLeads && teamLeads.length > 0 && (
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel 
                                    shrink 
                                    sx={{ 
                                        backgroundColor: '#f8fafc', 
                                        px: 0.5,
                                        fontWeight: 600,
                                        color: 'text.primary',
                                    }}
                                >
                                    Team Lead
                                </InputLabel>
                                <Select
                                    value={selectedTeamLead}
                                    onChange={handleTeamLeadChange}
                                    displayEmpty
                                    notched
                                    label="Team Lead"
                                    sx={{
                                        borderRadius: 2,
                                        backgroundColor: 'white',
                                        '& .MuiSelect-select': {
                                            py: 1.5,
                                        },
                                    }}
                                >
                                    <MenuItem value="">All Teams</MenuItem>
                                    {teamLeads.map((tl) => (
                                        <MenuItem key={tl._id} value={tl._id}>{tl.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    )}

                    {/* Consultant */}
                    {consultants && consultants.length > 0 && (
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl fullWidth>
                                <InputLabel 
                                    shrink 
                                    sx={{ 
                                        backgroundColor: '#f8fafc', 
                                        px: 0.5,
                                        fontWeight: 600,
                                        color: 'text.primary',
                                    }}
                                >
                                    Consultant
                                </InputLabel>
                                <Select
                                    value={selectedConsultant}
                                    onChange={handleConsultantChange}
                                    displayEmpty
                                    notched
                                    label="Consultant"
                                    sx={{
                                        borderRadius: 2,
                                        backgroundColor: 'white',
                                        '& .MuiSelect-select': {
                                            py: 1.5,
                                        },
                                    }}
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
                </Grid>
            </Collapse>

            {/* Active Filters Chips */}
            {hasActiveFilters && (
                <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                        Active Filters:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {searchTerm && (
                            <Chip
                                label={`Search: "${searchTerm}"`}
                                size="small"
                                onDelete={() => {
                                    setSearchTerm('');
                                    onFilterChange({ search: '', stage: selectedStage, status: selectedStatus, consultant: selectedConsultant, teamLead: selectedTeamLead });
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                        )}
                        {selectedStage && (
                            <Chip
                                label={`Stage: ${selectedStage}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onDelete={() => {
                                    setSelectedStage('');
                                    onFilterChange({ search: searchTerm, stage: '', status: selectedStatus, consultant: selectedConsultant, teamLead: selectedTeamLead });
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                        )}
                        {selectedStatus && (
                            <Chip
                                label={`Status: ${selectedStatus}`}
                                size="small"
                                color="secondary"
                                variant="outlined"
                                onDelete={() => {
                                    setSelectedStatus('');
                                    onFilterChange({ search: searchTerm, stage: selectedStage, status: '', consultant: selectedConsultant, teamLead: selectedTeamLead });
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                        )}
                        {selectedTeamLead && (
                            <Chip
                                label={`Team: ${teamLeads?.find(tl => tl._id === selectedTeamLead)?.name || selectedTeamLead}`}
                                size="small"
                                color="info"
                                variant="outlined"
                                onDelete={() => {
                                    setSelectedTeamLead('');
                                    onFilterChange({ search: searchTerm, stage: selectedStage, status: selectedStatus, consultant: selectedConsultant, teamLead: '' });
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                        )}
                        {selectedConsultant && (
                            <Chip
                                label={`Consultant: ${selectedConsultant}`}
                                size="small"
                                color="success"
                                variant="outlined"
                                onDelete={() => {
                                    setSelectedConsultant('');
                                    onFilterChange({ search: searchTerm, stage: selectedStage, status: selectedStatus, consultant: '', teamLead: selectedTeamLead });
                                }}
                                sx={{ borderRadius: 2 }}
                            />
                        )}
                    </Box>
                </Box>
            )}
        </Paper>
    );
};

export default CommitmentFilters;
