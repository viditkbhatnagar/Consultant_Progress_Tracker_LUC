import React from 'react';
import { Box, Typography, Avatar, Chip, Grid } from '@mui/material';
import {
    AccountTree as HierarchyIcon,
    Person as PersonIcon,
    Groups as GroupsIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
    gridStagger,
    riseItemVariants,
    cardHover,
    useReducedMotionVariants,
} from '../utils/dashboardMotion';

// Flat hierarchy visual using the dashboard tokens. Replaces the old
// gradient-heavy layout so it reads consistently with the redesigned
// Admin dashboard (Notion-esque palette, light/dark). Falls back to
// sensible hex when rendered outside DashboardShell.
const TeamHierarchyView = ({ teams = [], onTeamClick, onConsultantClick, adminUser }) => {
    const stagger = useReducedMotionVariants(gridStagger);
    const item = useReducedMotionVariants(riseItemVariants);
    const totalConsultants = teams.reduce((sum, t) => sum + (t.consultants?.length || 0), 0);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <HierarchyIcon sx={{ color: 'var(--d-accent, #2383E2)' }} />
                <Typography
                    sx={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--d-text, #191918)',
                        letterSpacing: '-0.01em',
                    }}
                >
                    Organization
                </Typography>
            </Box>

            {/* Admin card — the org root */}
            <motion.div variants={item} initial="hidden" animate="show">
                <Box
                    sx={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: '20px 28px',
                        backgroundColor: 'var(--d-surface, #FFFFFF)',
                        border: '1px solid var(--d-border, #E6E3DC)',
                        borderRadius: '14px',
                        boxShadow: 'var(--d-shadow-card)',
                        minWidth: 260,
                        mb: 3,
                    }}
                >
                    <Avatar
                        sx={{
                            bgcolor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                            color: 'var(--d-accent-text, #1F6FBF)',
                            width: 52,
                            height: 52,
                            mb: 1,
                        }}
                    >
                        <GroupsIcon />
                    </Avatar>
                    <Typography
                        sx={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: 'var(--d-text, #191918)',
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {adminUser?.name || 'Administration'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)', mt: 0.25 }}>
                        {adminUser?.email || 'admin@learnerseducation.com'}
                    </Typography>
                    <Chip
                        label="Administrator"
                        size="small"
                        sx={{
                            mt: 1,
                            backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                            color: 'var(--d-accent-text, #1F6FBF)',
                            fontWeight: 600,
                            fontSize: 11,
                        }}
                    />
                    <Typography
                        sx={{
                            fontSize: 12,
                            color: 'var(--d-text-muted, #8A887E)',
                            mt: 1.25,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {teams.length} teams · {totalConsultants} consultants
                    </Typography>
                </Box>
            </motion.div>

            {/* Teams */}
            <motion.div variants={stagger} initial="hidden" animate="show">
                <Grid container spacing={2.5}>
                    {teams.map((team) => (
                        <Grid item xs={12} md={6} key={team.teamName}>
                            <motion.div variants={item} initial="rest" whileHover="hover" whileTap="press">
                                <motion.div
                                    variants={onTeamClick ? cardHover : undefined}
                                    onClick={onTeamClick ? () => onTeamClick(team) : undefined}
                                    role={onTeamClick ? 'button' : undefined}
                                    tabIndex={onTeamClick ? 0 : undefined}
                                    onKeyDown={
                                        onTeamClick
                                            ? (e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      onTeamClick(team);
                                                  }
                                              }
                                            : undefined
                                    }
                                    style={{
                                        cursor: onTeamClick ? 'pointer' : 'default',
                                        backgroundColor: 'var(--d-surface, #FFFFFF)',
                                        border: '1px solid var(--d-border, #E6E3DC)',
                                        borderRadius: '14px',
                                        boxShadow: 'var(--d-shadow-card)',
                                        padding: '16px 18px',
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                                                color: 'var(--d-accent-text, #1F6FBF)',
                                                width: 40,
                                                height: 40,
                                            }}
                                        >
                                            <GroupsIcon fontSize="small" />
                                        </Avatar>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography
                                                sx={{
                                                    fontSize: 15,
                                                    fontWeight: 700,
                                                    color: 'var(--d-text, #191918)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {team.teamLead.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: 'var(--d-text-muted, #8A887E)' }}>
                                                Team Lead
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={team.teamName}
                                            size="small"
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: 11,
                                                height: 22,
                                                backgroundColor: 'var(--d-surface-muted, #F1EFEA)',
                                                color: 'var(--d-text-2, #2A2927)',
                                                border: '1px solid var(--d-border-soft, #ECE9E2)',
                                            }}
                                        />
                                    </Box>

                                    {team.consultants?.length > 0 ? (
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                                gap: 0.75,
                                            }}
                                        >
                                            {team.consultants.map((consultant) => (
                                                <Box
                                                    key={consultant._id}
                                                    onClick={
                                                        onConsultantClick
                                                            ? (e) => {
                                                                  e.stopPropagation();
                                                                  onConsultantClick(consultant);
                                                              }
                                                            : undefined
                                                    }
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        padding: '6px 8px',
                                                        borderRadius: '8px',
                                                        cursor: onConsultantClick ? 'pointer' : 'default',
                                                        transition: 'background-color var(--d-dur-sm) var(--d-ease-enter)',
                                                        '@media (hover: hover) and (pointer: fine)': {
                                                            '&:hover': {
                                                                backgroundColor: 'var(--d-surface-hover, #EFEDE8)',
                                                            },
                                                        },
                                                    }}
                                                >
                                                    <Avatar
                                                        sx={{
                                                            width: 24,
                                                            height: 24,
                                                            bgcolor: 'var(--d-surface-muted, #F1EFEA)',
                                                            color: 'var(--d-text-3, #57564E)',
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        <PersonIcon sx={{ fontSize: 14 }} />
                                                    </Avatar>
                                                    <Typography
                                                        sx={{
                                                            fontSize: 12.5,
                                                            color: 'var(--d-text-2, #2A2927)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1,
                                                            minWidth: 0,
                                                        }}
                                                    >
                                                        {consultant.name}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: 12, color: 'var(--d-text-muted, #8A887E)', fontStyle: 'italic' }}>
                                            No consultants yet
                                        </Typography>
                                    )}
                                </motion.div>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>
            </motion.div>

            {teams.length === 0 && (
                <Typography sx={{ textAlign: 'center', py: 4, color: 'var(--d-text-muted, #8A887E)' }}>
                    No teams found.
                </Typography>
            )}
        </Box>
    );
};

export default TeamHierarchyView;
