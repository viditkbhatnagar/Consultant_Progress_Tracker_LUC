import React from 'react';
import {
    Box,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Typography,
    Alert,
} from '@mui/material';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';

import axios from 'axios';
import { API_BASE_URL } from '../../utils/constants';

const SAVED_TEMPLATES_URL = `${API_BASE_URL}/exports/saved-templates`;

const AGGS = [
    { value: 'count',    lbl: 'Count' },
    { value: 'sum',      lbl: 'Sum' },
    { value: 'avg',      lbl: 'Average' },
    { value: 'min',      lbl: 'Min' },
    { value: 'max',      lbl: 'Max' },
    { value: 'distinct', lbl: 'Distinct count' },
];

// Plan §4 — pivot controls. Always-visible labeled panel (no Accordion).
// Mode flip (raw vs pivot) is driven by `rowDim`: empty rowDim → raw rows
// in the grid, non-empty → pivot wide-table.
const PivotControlsPanel = ({
    dataset,
    organization,
    dimensions = [],
    measures = [],
    pivotConfig,
    onChange,
    onToast,
}) => {
    const { rowDim = '', colDim = '', measure = 'count', agg = 'count' } = pivotConfig || {};

    const setField = (field) => (e) => {
        const next = { ...pivotConfig, [field]: e.target.value };
        if (field === 'agg' && (e.target.value === 'count' || e.target.value === 'distinct')) {
            next.measure = 'count';
        }
        onChange(next);
    };

    const handleSave = async () => {
        const name = window.prompt('Save this pivot as…  (name)');
        if (!name) return;
        try {
            await axios.post(SAVED_TEMPLATES_URL, {
                name: name.trim(),
                dataset,
                organization,
                config: {
                    rowDim,
                    colDim: colDim || undefined,
                    measure: agg === 'count' || agg === 'distinct' ? undefined : measure,
                    agg,
                },
            });
            onToast?.({ severity: 'success', message: `Saved as "${name}"` });
        } catch (err) {
            onToast?.({
                severity: 'error',
                message: err?.response?.data?.message || err.message,
            });
        }
    };

    return (
        <Box>
            <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Pivot mode
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {rowDim ? 'Active' : 'Off (raw rows)'}
                </Typography>
            </Stack>

            <Stack spacing={1.5}>
                <FormControl size="small" fullWidth>
                    <InputLabel>Rows</InputLabel>
                    <Select value={rowDim} onChange={setField('rowDim')} label="Rows">
                        <MenuItem value=""><em>None (raw mode)</em></MenuItem>
                        {dimensions.map((d) => (
                            <MenuItem key={d.key} value={d.key}>{d.lbl}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                    <InputLabel>Columns (optional)</InputLabel>
                    <Select
                        value={colDim}
                        onChange={setField('colDim')}
                        label="Columns (optional)"
                        disabled={!rowDim}
                    >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {dimensions
                            .filter((d) => d.key !== rowDim)
                            .map((d) => (
                                <MenuItem key={d.key} value={d.key}>{d.lbl}</MenuItem>
                            ))}
                    </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                    <InputLabel>Aggregation</InputLabel>
                    <Select
                        value={agg}
                        onChange={setField('agg')}
                        label="Aggregation"
                        disabled={!rowDim}
                    >
                        {AGGS.map((a) => (
                            <MenuItem key={a.value} value={a.value}>{a.lbl}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {(agg !== 'count' && agg !== 'distinct') && (
                    <FormControl size="small" fullWidth>
                        <InputLabel>Measure</InputLabel>
                        <Select value={measure} onChange={setField('measure')} label="Measure">
                            {measures.map((m) => (
                                <MenuItem key={m.key} value={m.key}>{m.lbl}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BookmarkAddIcon />}
                    onClick={handleSave}
                    disabled={!rowDim}
                    fullWidth
                >
                    Save as template
                </Button>
            </Stack>

            {dataset === 'students'
                && agg !== 'distinct'
                && (rowDim === 'subjects' || colDim === 'subjects') && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                    Counts each enrolled subject once. Switch aggregation to <strong>Distinct count</strong> for true student counts.
                </Alert>
            )}
        </Box>
    );
};

export default PivotControlsPanel;
