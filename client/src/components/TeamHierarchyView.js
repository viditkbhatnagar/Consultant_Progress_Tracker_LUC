import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Avatar,
    Chip,
    Grid,
    Paper,
} from '@mui/material';
import {
    AccountTree as HierarchyIcon,
    Person as PersonIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';

const TeamHierarchyView = ({ teams, onTeamClick, onConsultantClick }) => {
    return (
        <Card elevation={3}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <HierarchyIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Organization Hierarchy
                    </Typography>
                </Box>

                {/* Admin Level */}
                <Box sx={{ mb: 4, textAlign: 'center' }}>
                    <Paper
                        elevation={2}
                        sx={{
                            display: 'inline-block',
                            p: 2,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                        }}
                    >
                        <GroupsIcon sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Administration
                        </Typography>
                        <Typography variant="caption">Organization Level</Typography>
                    </Paper>
                </Box>

                {/* Teams Level */}
                <Grid container spacing={3} justifyContent="center">
                    {teams.map((team) => (
                        <Grid item xs={12} md={6} key={team.teamName}>
                            <Box>
                                {/* Connecting Line */}
                                <Box
                                    sx={{
                                        width: 2,
                                        height: 40,
                                        bgcolor: 'divider',
                                        mx: 'auto',
                                        mb: 2,
                                    }}
                                />

                                {/* Team Lead Card */}
                                <Paper
                                    elevation={3}
                                    sx={{
                                        p: 2,
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: 6,
                                        },
                                        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                                        color: 'white',
                                    }}
                                    onClick={() => onTeamClick && onTeamClick(team)}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2 }}>
                                            <GroupsIcon />
                                        </Avatar>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                                {team.teamLead.name}
                                            </Typography>
                                            <Typography variant="caption">Team Lead</Typography>
                                        </Box>
                                    </Box>
                                    <Chip
                                        label={team.teamName}
                                        size="small"
                                        sx={{
                                            bgcolor: 'rgba(255,255,255,0.2)',
                                            color: 'white',
                                            fontWeight: 600,
                                        }}
                                    />
                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="body2">
                                            {team.consultants.length} Consultants
                                        </Typography>
                                        <Typography variant="body2">
                                            {team.totalCommitments || 0} Commitments
                                        </Typography>
                                    </Box>
                                </Paper>

                                {/* Consultants */}
                                {team.consultants && team.consultants.length > 0 && (
                                    <Box sx={{ mt: 2, ml: 4 }}>
                                        <Grid container spacing={2}>
                                            {team.consultants.map((consultant) => (
                                                <Grid item xs={12} key={consultant._id}>
                                                    {/* Connecting Line */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <Box
                                                            sx={{
                                                                width: 30,
                                                                height: 2,
                                                                bgcolor: 'divider',
                                                            }}
                                                        />
                                                        <Paper
                                                            elevation={1}
                                                            sx={{
                                                                p: 1.5,
                                                                flex: 1,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                '&:hover': {
                                                                    bgcolor: 'action.hover',
                                                                    transform: 'translateX(8px)',
                                                                },
                                                            }}
                                                            onClick={() => onConsultantClick && onConsultantClick(consultant)}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Avatar
                                                                    sx={{
                                                                        bgcolor: 'primary.light',
                                                                        width: 32,
                                                                        height: 32,
                                                                        mr: 1.5,
                                                                    }}
                                                                >
                                                                    <PersonIcon fontSize="small" />
                                                                </Avatar>
                                                                <Box sx={{ flex: 1 }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                        {consultant.name}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Consultant
                                                                    </Typography>
                                                                </Box>
                                                                <Chip
                                                                    label={`${consultant.commitmentCount || 0} commits`}
                                                                    size="small"
                                                                    color="primary"
                                                                    variant="outlined"
                                                                />
                                                            </Box>
                                                        </Paper>
                                                    </Box>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>
                                )}
                            </Box>
                        </Grid>
                    ))}
                </Grid>

                {teams.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography color="text.secondary">No teams found</Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

export default TeamHierarchyView;
