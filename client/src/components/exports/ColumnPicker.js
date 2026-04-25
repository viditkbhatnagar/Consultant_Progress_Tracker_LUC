import React from 'react';
import { Box, FormGroup, FormControlLabel, Checkbox, Typography, Button, Stack } from '@mui/material';

// Dense column picker. For Phase 1 we render a checkbox list (LUC has 29 cols,
// Skillhub 17). Plan §7 calls for SearchableMultiSelect when the column count
// grows; future datasets can swap implementations behind this same prop API.
const ColumnPicker = ({ columns, value, onChange }) => {
    const handleToggle = (key) => () => {
        const next = new Set(value);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onChange?.(Array.from(next));
    };

    const checkAll = () => onChange?.(columns.map((c) => c.key));
    const checkDefaults = () =>
        onChange?.(columns.filter((c) => c.defaultExport).map((c) => c.key));
    const clearAll = () => onChange?.([]);

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button size="small" onClick={checkAll}>Select all</Button>
                <Button size="small" onClick={checkDefaults}>Reset to defaults</Button>
                <Button size="small" onClick={clearAll}>Clear</Button>
                <Typography variant="caption" sx={{ alignSelf: 'center', color: 'text.secondary' }}>
                    {value.length} of {columns.length} selected
                </Typography>
            </Stack>
            <FormGroup
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 0,
                    maxHeight: 280,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                }}
            >
                {columns.map((c) => (
                    <FormControlLabel
                        key={c.key}
                        control={
                            <Checkbox
                                size="small"
                                checked={value.includes(c.key)}
                                onChange={handleToggle(c.key)}
                            />
                        }
                        label={c.exportLbl || c.lbl || c.key}
                        sx={{ '.MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                    />
                ))}
            </FormGroup>
        </Box>
    );
};

export default ColumnPicker;
