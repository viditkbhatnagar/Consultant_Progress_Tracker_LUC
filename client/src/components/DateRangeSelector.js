import React from 'react';
import {
    Box,
    ToggleButtonGroup,
    ToggleButton,
    TextField,
    MenuItem,
    Grid,
    Typography,
} from '@mui/material';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, subMonths } from 'date-fns';

const DateRangeSelector = ({ value, onChange }) => {
    const [viewType, setViewType] = React.useState('current-week'); // current-week, current-month, last-3-months, custom
    const [customStart, setCustomStart] = React.useState('');
    const [customEnd, setCustomEnd] = React.useState('');

    const handleViewChange = (event, newView) => {
        if (newView !== null) {
            setViewType(newView);

            const today = new Date();
            let start, end;

            switch (newView) {
                case 'current-week':
                    start = startOfWeek(today, { weekStartsOn: 1 }); // Monday
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
                    // Don't auto-set, let user pick
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

    return (
        <Box>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md="auto">
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        View Period:
                    </Typography>
                    <ToggleButtonGroup
                        value={viewType}
                        exclusive
                        onChange={handleViewChange}
                        size="small"
                        sx={{ flexWrap: 'wrap' }}
                    >
                        <ToggleButton value="current-week">Current Week</ToggleButton>
                        <ToggleButton value="current-month">Current Month</ToggleButton>
                        <ToggleButton value="last-3-months">Last 3 Months</ToggleButton>
                        <ToggleButton value="custom">Custom</ToggleButton>
                    </ToggleButtonGroup>
                </Grid>

                {viewType === 'custom' && (
                    <>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="Start Date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                onBlur={handleCustomDatesChange}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="End Date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                onBlur={handleCustomDatesChange}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </>
                )}

                {value && (
                    <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                            Showing data from {value.startDate} to {value.endDate}
                        </Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

export default DateRangeSelector;
