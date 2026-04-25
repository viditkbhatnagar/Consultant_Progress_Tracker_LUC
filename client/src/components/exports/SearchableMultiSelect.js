import React from 'react';
import { Autocomplete, TextField, Chip, Box, Typography } from '@mui/material';

// 200-row display cap — when the unfiltered option list exceeds this,
// MUI's filterOptions truncates and we surface a "type to filter N more"
// hint. Per plan §7.
const DISPLAY_CAP = 200;

const SearchableMultiSelect = ({
    label,
    options = [],
    value = [],
    onChange,
    placeholder = 'Type to search...',
    multiple = true,
    disabled = false,
    helperText,
    sx,
}) => {
    const [inputValue, setInputValue] = React.useState('');

    const safeOptions = Array.isArray(options) ? options : [];
    const totalCount = safeOptions.length;

    const filterOptions = (opts, state) => {
        const q = (state.inputValue || '').trim().toLowerCase();
        const matched = q
            ? opts.filter((o) => String(o).toLowerCase().includes(q))
            : opts;
        return matched.slice(0, DISPLAY_CAP);
    };

    const trimmed = (inputValue || '').trim().toLowerCase();
    const matchedCount = trimmed
        ? safeOptions.filter((o) => String(o).toLowerCase().includes(trimmed)).length
        : totalCount;
    const truncated = matchedCount > DISPLAY_CAP;

    return (
        <Box sx={sx}>
            <Autocomplete
                multiple={multiple}
                disablePortal={false}
                disabled={disabled}
                options={safeOptions}
                value={value}
                onChange={(_, newValue) => onChange?.(newValue)}
                inputValue={inputValue}
                onInputChange={(_, v) => setInputValue(v)}
                filterOptions={filterOptions}
                renderTags={(tags, getTagProps) =>
                    tags.map((option, index) => (
                        <Chip
                            label={String(option)}
                            size="small"
                            {...getTagProps({ index })}
                            key={`${label}-${option}-${index}`}
                        />
                    ))
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder={value?.length ? '' : placeholder}
                        size="small"
                        helperText={helperText}
                    />
                )}
                noOptionsText={
                    totalCount === 0
                        ? 'No options available'
                        : 'No matches — adjust your search'
                }
                sx={{ minWidth: 200 }}
            />
            {truncated && (
                <Typography
                    variant="caption"
                    sx={{ mt: 0.5, color: 'text.secondary', display: 'block' }}
                >
                    Showing {DISPLAY_CAP} of {matchedCount} — type to filter
                </Typography>
            )}
        </Box>
    );
};

export default SearchableMultiSelect;
