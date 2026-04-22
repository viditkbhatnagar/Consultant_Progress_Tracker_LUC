import React from 'react';
import { Box, Typography, Button, ButtonGroup } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { motion } from 'framer-motion';
import { riseVariants, useReducedMotionVariants } from '../../utils/dashboardMotion';

const datePickerSx = {
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'var(--d-surface)',
        borderRadius: '10px',
        fontSize: 14,
        color: 'var(--d-text)',
        transition: 'border-color var(--d-dur-sm) var(--d-ease-enter)',
        '& fieldset': { borderColor: 'var(--d-border)' },
        '&:hover fieldset': { borderColor: 'var(--d-accent)' },
        '&.Mui-focused fieldset': { borderColor: 'var(--d-accent)', borderWidth: '1px' },
    },
    '& .MuiInputLabel-root': { color: 'var(--d-text-muted)' },
    '& .MuiInputLabel-root.Mui-focused': { color: 'var(--d-accent)' },
    '& .MuiSvgIcon-root': { color: 'var(--d-text-muted)' },
};

// Self-contained date-range picker card. Preset buttons (This week, Last
// week, This month, Custom) keep the most common actions one click away.
const DateRangeCard = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    presets = [],
    activePreset,
    onPresetChange,
    right,
}) => {
    const variants = useReducedMotionVariants(riseVariants);

    return (
        <motion.div variants={variants} style={{ marginBottom: 24 }}>
            <Box
                sx={{
                    backgroundColor: 'var(--d-surface)',
                    border: '1px solid var(--d-border)',
                    borderRadius: '14px',
                    padding: { xs: '14px 16px', md: '18px 20px' },
                    boxShadow: 'var(--d-shadow-card-sm)',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', lg: 'row' },
                        alignItems: { lg: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: 'var(--d-text-muted)',
                                fontWeight: 600,
                                mb: 0.75,
                            }}
                        >
                            Date range
                        </Typography>
                        {presets.length > 0 && (
                            <ButtonGroup
                                variant="outlined"
                                size="small"
                                sx={{
                                    '& .MuiButton-root': {
                                        borderColor: 'var(--d-border)',
                                        color: 'var(--d-text-3)',
                                        textTransform: 'none',
                                        fontWeight: 500,
                                        fontSize: 13,
                                        px: 1.5,
                                        py: 0.5,
                                        transition: 'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                                        '@media (hover: hover) and (pointer: fine)': {
                                            '&:hover': {
                                                backgroundColor: 'var(--d-surface-hover)',
                                                borderColor: 'var(--d-accent)',
                                            },
                                        },
                                    },
                                    '& .MuiButton-root.active': {
                                        backgroundColor: 'var(--d-accent-bg)',
                                        color: 'var(--d-accent-text)',
                                        borderColor: 'var(--d-accent)',
                                    },
                                }}
                            >
                                {presets.map((p) => (
                                    <Button
                                        key={p.value}
                                        className={activePreset === p.value ? 'active' : ''}
                                        onClick={() => onPresetChange?.(p.value)}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </ButtonGroup>
                        )}
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 1.5,
                        }}
                    >
                        <DatePicker
                            label="Start"
                            value={startDate}
                            onChange={onStartDateChange}
                            slotProps={{
                                textField: { size: 'small', sx: datePickerSx },
                            }}
                        />
                        <Box sx={{ color: 'var(--d-text-muted)', fontSize: 13 }}>→</Box>
                        <DatePicker
                            label="End"
                            value={endDate}
                            onChange={onEndDateChange}
                            slotProps={{
                                textField: { size: 'small', sx: datePickerSx },
                            }}
                        />
                        {right}
                    </Box>
                </Box>
            </Box>
        </motion.div>
    );
};

export default DateRangeCard;
