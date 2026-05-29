import React from 'react';
import {
    Box,
    TextField,
    MenuItem,
    Typography,
    Chip,
} from '@mui/material';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, subMonths } from 'date-fns';

const VIEW_OPTIONS = [
    { value: 'current-week', label: 'Current Week' },
    { value: 'current-month', label: 'Current Month' },
    { value: 'last-3-months', label: 'Last 3 Months' },
    { value: 'custom', label: 'Custom' },
];

const DateRangeSelector = ({ value, onChange }) => {
    const [viewType, setViewType] = React.useState('last-3-months');
    const [customStart, setCustomStart] = React.useState('');
    const [customEnd, setCustomEnd] = React.useState('');

    // Resolve a preset view → date range and bubble it up. Math is unchanged
    // from the old pill version — only the trigger (a dropdown) differs.
    const applyView = (newView) => {
        setViewType(newView);
        if (newView === 'custom') return; // wait for the date fields below

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
            default:
                start = startOfWeek(today, { weekStartsOn: 1 });
                end = endOfWeek(today, { weekStartsOn: 1 });
        }

        onChange({
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
            viewType: newView,
        });
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

    const fieldRadius = '10px';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: 'var(--d-text-muted, rgba(0,0,0,0.6))' }}
                >
                    View Period:
                </Typography>

                <TextField
                    select
                    size="small"
                    value={viewType}
                    onChange={(e) => applyView(e.target.value)}
                    sx={{
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: fieldRadius,
                            backgroundColor: 'var(--d-surface, #fff)',
                            color: 'var(--d-text, inherit)',
                            fontWeight: 600,
                            '& fieldset': { borderColor: 'var(--d-border, rgba(0,0,0,0.23))' },
                            '&:hover fieldset': { borderColor: 'var(--d-accent, #2383E2)' },
                            '&.Mui-focused fieldset': { borderColor: 'var(--d-accent, #2383E2)' },
                        },
                        '& .MuiSelect-icon': { color: 'var(--d-text-muted, rgba(0,0,0,0.5))' },
                    }}
                    SelectProps={{
                        MenuProps: {
                            PaperProps: {
                                sx: {
                                    mt: 0.5,
                                    backgroundColor: 'var(--d-surface, #fff)',
                                    border: '1px solid var(--d-border, rgba(0,0,0,0.12))',
                                    boxShadow: 'var(--d-shadow-elev, 0 10px 30px rgba(0,0,0,0.12))',
                                    '& .MuiMenuItem-root': {
                                        color: 'var(--d-text, inherit)',
                                        fontSize: 14,
                                        fontWeight: 500,
                                        '&:hover': { backgroundColor: 'var(--d-surface-hover, rgba(0,0,0,0.04))' },
                                        '&.Mui-selected': {
                                            backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.08))',
                                            color: 'var(--d-accent-text, #1F6FBF)',
                                        },
                                        '&.Mui-selected:hover': {
                                            backgroundColor: 'var(--d-accent-bg, rgba(35,131,226,0.12))',
                                        },
                                    },
                                },
                            },
                        },
                    }}
                >
                    {VIEW_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </MenuItem>
                    ))}
                </TextField>

                <Box
                    component="button"
                    type="button"
                    onClick={() => applyView('current-week')}
                    sx={{
                        border: '1px solid',
                        borderColor:
                            viewType === 'current-week'
                                ? 'var(--d-accent, #2383E2)'
                                : 'var(--d-border, rgba(0,0,0,0.23))',
                        background:
                            viewType === 'current-week'
                                ? 'var(--d-accent-bg, rgba(35,131,226,0.08))'
                                : 'var(--d-surface, #fff)',
                        color:
                            viewType === 'current-week'
                                ? 'var(--d-accent-text, #1F6FBF)'
                                : 'var(--d-text-2, inherit)',
                        fontWeight: 600,
                        fontSize: 13,
                        px: 1.75,
                        py: '7px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition:
                            'background-color var(--d-dur-sm) var(--d-ease-enter), color var(--d-dur-sm) var(--d-ease-enter), border-color var(--d-dur-sm) var(--d-ease-enter)',
                        '&:hover': { borderColor: 'var(--d-accent, #2383E2)' },
                        '&:focus-visible': { outline: '2px solid var(--d-accent, #2383E2)', outlineOffset: 2 },
                    }}
                >
                    Current week
                </Box>

                {value && (
                    <Chip
                        icon={<CalendarIcon sx={{ fontSize: 18 }} />}
                        label={`${formatDisplayDate(value.startDate)} — ${formatDisplayDate(value.endDate)}`}
                        variant="outlined"
                        sx={{
                            fontWeight: 600,
                            borderRadius: 2,
                            ml: { xs: 0, md: 'auto' },
                            color: 'var(--d-text-2, inherit)',
                            borderColor: 'var(--d-border, rgba(0,0,0,0.23))',
                            backgroundColor: 'var(--d-surface, transparent)',
                            '& .MuiChip-icon': { color: 'var(--d-accent, #2383E2)' },
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
                            '& .MuiOutlinedInput-root': { borderRadius: fieldRadius },
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
                            '& .MuiOutlinedInput-root': { borderRadius: fieldRadius },
                        }}
                    />
                </Box>
            )}
        </Box>
    );
};

export default DateRangeSelector;
