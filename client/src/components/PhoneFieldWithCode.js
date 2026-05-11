import React from 'react';
import { Box, TextField, Autocomplete } from '@mui/material';
import { COUNTRY_CODES, findCountryCode, DEFAULT_COUNTRY_CODE } from '../utils/countryCodes';

// Reusable "country code + phone number" input. The committed value follows
// the model convention: "<+code> <number>" with a single space separator.
//
// Selected display shows just the bare code (e.g. "+971") so the picker
// stays compact in narrow grid cells (Skillhub's 3-up phone row at sm:4).
// The dropdown rows show the full country label so users can scan + filter.
const PhoneFieldWithCode = ({
    value = '',
    onChange,
    label = 'Phone Number',
    required = false,
    placeholder = '50 123 4567',
    codeWidth = 110,
    sx,
}) => {
    const selected = findCountryCode(value);
    const numberOnly = (value || '').replace(/^\+\d+\s*/, '');

    const handleCodeChange = (_event, newValue) => {
        const codeToUse = newValue ? newValue.code : DEFAULT_COUNTRY_CODE;
        onChange(numberOnly ? `${codeToUse} ${numberOnly}` : codeToUse);
    };

    const handleNumberChange = (event) => {
        const currentCode = selected?.code || DEFAULT_COUNTRY_CODE;
        const nextNumber = event.target.value;
        onChange(nextNumber ? `${currentCode} ${nextNumber}` : '');
    };

    return (
        <Box sx={{ display: 'flex', gap: 1, width: '100%', ...sx }}>
            <Autocomplete
                sx={{ width: codeWidth, flexShrink: 0 }}
                options={COUNTRY_CODES}
                value={selected}
                onChange={handleCodeChange}
                getOptionLabel={(option) => option.code || ''}
                renderOption={(props, option) => (
                    <li {...props} key={`${option.code}-${option.country}`}>
                        {option.label}
                    </li>
                )}
                isOptionEqualToValue={(option, val) =>
                    option.code === val?.code && option.country === val?.country
                }
                autoHighlight
                openOnFocus
                disableClearable
                filterOptions={(options, { inputValue }) => {
                    const q = inputValue.toLowerCase();
                    return options.filter(
                        (o) => o.code.includes(q) || o.country.toLowerCase().includes(q)
                    );
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Code"
                        required={required}
                        placeholder="Search…"
                    />
                )}
            />
            <TextField
                sx={{ flex: 1 }}
                label={label}
                value={numberOnly}
                onChange={handleNumberChange}
                required={required}
                placeholder={placeholder}
            />
        </Box>
    );
};

export default PhoneFieldWithCode;
