import React from 'react';
import { Stack, Chip, TextField, Box } from '@mui/material';
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfQuarter,
    endOfQuarter,
    startOfYear,
    endOfYear,
    subMonths,
    subYears,
    format,
} from 'date-fns';

const PRESETS = ['All time', 'This week', 'This month', 'Last month', 'This quarter', 'YTD', 'Last 12 months', 'Custom'];

function presetToRange(preset) {
    const now = new Date();
    if (preset === 'All time' || preset === 'Custom') return { startDate: null, endDate: null };
    if (preset === 'This week') return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
    if (preset === 'This month') return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    if (preset === 'Last month') {
        const lm = subMonths(now, 1);
        return { startDate: startOfMonth(lm), endDate: endOfMonth(lm) };
    }
    if (preset === 'This quarter') return { startDate: startOfQuarter(now), endDate: endOfQuarter(now) };
    if (preset === 'YTD') return { startDate: startOfYear(now), endDate: now };
    if (preset === 'Last 12 months') return { startDate: subYears(now, 1), endDate: now };
    return { startDate: null, endDate: null };
}

const DateRangeChips = ({ value, onChange }) => {
    const [preset, setPreset] = React.useState(value?.preset || 'All time');

    const handlePresetClick = (p) => {
        setPreset(p);
        if (p === 'Custom') {
            onChange?.({ preset: p, startDate: value?.startDate || null, endDate: value?.endDate || null });
        } else {
            const r = presetToRange(p);
            onChange?.({
                preset: p,
                startDate: r.startDate ? format(r.startDate, 'yyyy-MM-dd') : null,
                endDate: r.endDate ? format(r.endDate, 'yyyy-MM-dd') : null,
            });
        }
    };

    const handleCustomChange = (field) => (e) => {
        onChange?.({ ...value, preset: 'Custom', [field]: e.target.value || null });
    };

    return (
        <Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PRESETS.map((p) => (
                    <Chip
                        key={p}
                        label={p}
                        size="small"
                        color={preset === p ? 'primary' : 'default'}
                        variant={preset === p ? 'filled' : 'outlined'}
                        onClick={() => handlePresetClick(p)}
                    />
                ))}
            </Stack>
            {preset === 'Custom' && (
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Start date"
                        type="date"
                        size="small"
                        value={value?.startDate || ''}
                        onChange={handleCustomChange('startDate')}
                        InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                        label="End date"
                        type="date"
                        size="small"
                        value={value?.endDate || ''}
                        onChange={handleCustomChange('endDate')}
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>
            )}
        </Box>
    );
};

export default DateRangeChips;
