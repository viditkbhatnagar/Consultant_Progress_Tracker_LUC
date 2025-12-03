import React from 'react';
import {
    Box,
    ToggleButtonGroup,
    ToggleButton,
    TextField,
    Typography,
    Chip,
} from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, subMonths } from 'date-fns';

const DateRangeSelector = ({ value, onChange }) => {
    const [viewType, setViewType] = React.useState('current-week');
    const [customStart, setCustomStart] = React.useState('');
    const [customEnd, setCustomEnd] = React.useState('');

    const handleViewChange = (event, newView) => {
        if (newView !== null) {
            setViewType(newView);

            const today = new Date();
            let start, end;

            switch (newView) {
                case 'current-week':
                    start = startOfWeek(today, { weekStartsOn: 1 });
                    end = endOfWeek(today, { weekStartsOn: 1 });
                    break;
                case 'current-month':
                    start = startOfMonth(today);
                    end = endOfMonth(today);
                    break;
                case 'last-3-months':
                    start = subMonths(startOfMonth(today), 2);
                    end = endOfMonth(today);
                    break;
                case 'custom':
                    return;
                default:
                    start = startOfWeek(today, { weekStartsOn: 1 });
                    end = endOfWeek(today, { weekStartsOn: 1 });
            }

            onChange({
                startDate: format(start, 'yyyy-MM-dd'),
                endDate: format(end, 'yyyy-MM-dd'),
                viewType: newView,
            });
        }
    };

    const handleCustomDatesChange = () => {
        if (customStart && customEnd) {
            onChange({
                startDate: customStart,
                endDate: customEnd,
                viewType: 'custom',
            });
        }
    };

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return format(date, 'MMM d, yyyy');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    View Period:
                </Typography>
                <ToggleButtonGroup
                    value={viewType}
                    exclusive
                    onChange={handleViewChange}
                    size="small"
                    sx={{ 
                        flexWrap: 'wrap',
                        '& .MuiToggleButton-root': {
                            px: 2,
                            py: 1,
                            borderRadius: '8px !important',
                            border: '1px solid',
                            borderColor: 'divider',
                            textTransform: 'none',
                            fontWeight: 500,
                            '&.Mui-selected': {
                                backgroundColor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: 'primary.dark',
                                },
                            },
                        },
                    }}
                >
                    <ToggleButton value="current-week">Current Week</ToggleButton>
                    <ToggleButton value="current-month">Current Month</ToggleButton>
                    <ToggleButton value="last-3-months">Last 3 Months</ToggleButton>
                    <ToggleButton value="custom">Custom</ToggleButton>
                </ToggleButtonGroup>

                {value && (
                    <Chip
                        icon={<CalendarIcon sx={{ fontSize: 18 }} />}
                        label={`${formatDisplayDate(value.startDate)} — ${formatDisplayDate(value.endDate)}`}
                        variant="outlined"
                        color="primary"
                        sx={{ 
                            fontWeight: 500,
                            borderRadius: 2,
                            ml: { xs: 0, md: 'auto' },
                        }}
                    />
                )}
            </Box>

            {viewType === 'custom' && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        type="date"
                        label="Start Date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        onBlur={handleCustomDatesChange}
                        InputLabelProps={{ shrink: true }}
                        sx={{ 
                            minWidth: 180,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            },
                        }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label="End Date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        onBlur={handleCustomDatesChange}
                        InputLabelProps={{ shrink: true }}
                        sx={{ 
                            minWidth: 180,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                            },
                        }}
                    />
                </Box>
            )}
        </Box>
    );
};

export default DateRangeSelector;
