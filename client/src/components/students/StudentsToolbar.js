import React, { useState } from 'react';
import {
    Box,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Menu,
    MenuItem,
    Divider,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    TableChart as TableIcon,
    GridView as CardsIcon,
    Add as AddIcon,
    ExpandMore as ChevronIcon,
    Close as CloseIcon,
    FileDownload as DownloadIcon,
    AutoAwesome as SparkleIcon,
    LightMode as LightModeIcon,
    DarkMode as DarkModeIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Single filter chip — opens a Menu of values. Matches the meetings /
// commitments toolbar chip visually.
const FilterChip = ({ label, value, options, onChange, renderOption, width = 200 }) => {
    const [anchor, setAnchor] = useState(null);
    const active = Boolean(value);
    return (
        <>
            <Box
                component="button"
                type="button"
                onClick={(e) => setAnchor(e.currentTarget)}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    padding: '5px 10px',
                    borderRadius: '999px',
                    border: active
                        ? '1px solid var(--t-accent-border)'
                        : '1px dashed var(--t-border)',
                    backgroundColor: active ? 'var(--t-accent-bg)' : 'transparent',
                    color: active ? 'var(--t-accent-text)' : 'var(--t-text-3)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'border-color 120ms ease, background-color 120ms ease',
                    '&:hover': {
                        borderStyle: 'solid',
                        borderColor: active ? 'var(--t-accent-border)' : 'var(--t-text-muted)',
                        color: active ? 'var(--t-accent-text)' : 'var(--t-text)',
                    },
                }}
            >
                <Box component="span">{label}</Box>
                {active && (
                    <Box component="span" sx={{ fontWeight: 600 }}>
                        {renderOption
                            ? renderOption(options.find((o) => (o.value || o) === value) || value)
                            : options.find((o) => (o.value || o) === value)?.label || value}
                    </Box>
                )}
                {active ? (
                    <Box
                        component="span"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
                        sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.25 }}
                    >
                        <CloseIcon sx={{ fontSize: 13 }} />
                    </Box>
                ) : (
                    <ChevronIcon sx={{ fontSize: 14 }} />
                )}
            </Box>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                PaperProps={{
                    sx: {
                        minWidth: width,
                        maxHeight: 360,
                        borderRadius: '10px',
                        boxShadow: 'var(--t-shadow-elev)',
                        backgroundColor: 'var(--t-surface)',
                        color: 'var(--t-text)',
                        border: '1px solid var(--t-border)',
                    },
                }}
            >
                <MenuItem
                    onClick={() => {
                        onChange('');
                        setAnchor(null);
                    }}
                    sx={{ fontSize: 12.5, color: 'var(--t-text-3)' }}
                >
                    All {label.toLowerCase()}
                </MenuItem>
                <Divider sx={{ my: 0.5, borderColor: 'var(--t-border)' }} />
                {options.map((opt) => (
                    <MenuItem
                        key={opt.value || opt}
                        onClick={() => {
                            onChange(opt.value || opt);
                            setAnchor(null);
                        }}
                        selected={(opt.value || opt) === value}
                        sx={{ fontSize: 12.5, color: 'var(--t-text)' }}
                    >
                        {renderOption ? renderOption(opt) : opt.label || opt}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

// StudentsToolbar — renders in both LUC + Skillhub pages.
// `customFiltersLeft` / `customFiltersRight` let each page slot in its own
// chips (e.g. Skillhub curriculum tabs + status chips vs LUC month/program).
const StudentsToolbar = ({
    view,
    onViewChange,
    filters,
    onFilterChange,
    onClearFilters,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    searchValue,
    onSearchChange,
    onAdd,
    addLabel = 'New Student',
    onAddExtra = null,
    onExportXlsx,
    onExportCsv,
    onAIAnalysis,
    mode = 'light',
    onToggleMode,
    showAdd = true,
    chipRow = null,
    filterOptions = {},
    renderViewExtra = null,
}) => {
    const [exportAnchor, setExportAnchor] = useState(null);

    return (
        <Box
            sx={{
                backgroundColor: 'var(--t-surface)',
                border: '1px solid var(--t-border)',
                borderRadius: '14px',
                padding: '10px 12px',
                mb: 1.5,
            }}
        >
            {/* Row 1: View switcher + search + theme + AI + export + new */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                    pb: 1,
                    borderBottom: '1px dashed var(--t-border)',
                    mb: 1,
                }}
            >
                <ToggleButtonGroup
                    value={view}
                    exclusive
                    onChange={(_e, next) => next && onViewChange(next)}
                    sx={{
                        backgroundColor: 'var(--t-surface-muted)',
                        border: '1px solid var(--t-border)',
                        borderRadius: '10px',
                        padding: '3px',
                        '& .MuiToggleButton-root': {
                            border: 0,
                            borderRadius: '8px !important',
                            color: 'var(--t-text-3)',
                            textTransform: 'none',
                            fontSize: 14,
                            fontWeight: 600,
                            gap: 1,
                            px: 2.25,
                            py: 0.875,
                            lineHeight: 1.2,
                        },
                        '& .MuiToggleButton-root.Mui-selected': {
                            backgroundColor: 'var(--t-surface)',
                            color: 'var(--t-text)',
                            boxShadow: 'var(--t-shadow-card-sm)',
                        },
                    }}
                >
                    <ToggleButton value="table">
                        <TableIcon sx={{ fontSize: 18 }} /> Table
                    </ToggleButton>
                    <ToggleButton value="cards">
                        <CardsIcon sx={{ fontSize: 18 }} /> Cards
                    </ToggleButton>
                </ToggleButtonGroup>

                {renderViewExtra}

                <TextField
                    size="small"
                    placeholder="Search…"
                    value={searchValue || ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    sx={{ fontSize: 16, color: 'var(--t-text-muted)' }}
                                />
                            </InputAdornment>
                        ),
                        sx: {
                            fontSize: 12.5,
                            color: 'var(--t-text)',
                            backgroundColor: 'var(--t-surface-muted)',
                        },
                    }}
                    sx={{
                        width: 220,
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'var(--t-border)',
                        },
                    }}
                />

                <Box sx={{ flex: 1 }} />

                {onToggleMode && (
                    <Button
                        size="small"
                        variant="text"
                        onClick={onToggleMode}
                        sx={{
                            color: 'var(--t-text-3)',
                            textTransform: 'none',
                            fontSize: 12,
                            gap: 0.5,
                            px: 1.25,
                        }}
                        startIcon={
                            mode === 'dark' ? (
                                <LightModeIcon sx={{ fontSize: 14 }} />
                            ) : (
                                <DarkModeIcon sx={{ fontSize: 14 }} />
                            )
                        }
                    >
                        {mode === 'dark' ? 'Light' : 'Dark'}
                    </Button>
                )}

                {onAIAnalysis && (
                    <Button
                        size="small"
                        variant="text"
                        onClick={onAIAnalysis}
                        startIcon={
                            <SparkleIcon sx={{ fontSize: 14, color: '#8B5CF6' }} />
                        }
                        sx={{
                            color: 'var(--t-accent-text)',
                            textTransform: 'none',
                            fontSize: 12,
                            fontWeight: 550,
                            px: 1.25,
                        }}
                    >
                        AI analysis
                    </Button>
                )}

                {(onExportXlsx || onExportCsv) && (
                    <>
                        <Button
                            size="small"
                            variant="text"
                            onClick={(e) => setExportAnchor(e.currentTarget)}
                            startIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                            sx={{
                                color: 'var(--t-text-3)',
                                textTransform: 'none',
                                fontSize: 12,
                                px: 1.25,
                            }}
                        >
                            Export
                        </Button>
                        <Menu
                            anchorEl={exportAnchor}
                            open={Boolean(exportAnchor)}
                            onClose={() => setExportAnchor(null)}
                            PaperProps={{
                                sx: {
                                    backgroundColor: 'var(--t-surface)',
                                    color: 'var(--t-text)',
                                    border: '1px solid var(--t-border)',
                                    boxShadow: 'var(--t-shadow-elev)',
                                },
                            }}
                        >
                            {onExportXlsx && (
                                <MenuItem
                                    onClick={() => {
                                        setExportAnchor(null);
                                        onExportXlsx();
                                    }}
                                    sx={{ fontSize: 12.5 }}
                                >
                                    Export to Excel (.xlsx)
                                </MenuItem>
                            )}
                            {onExportCsv && (
                                <MenuItem
                                    onClick={() => {
                                        setExportAnchor(null);
                                        onExportCsv();
                                    }}
                                    sx={{ fontSize: 12.5 }}
                                >
                                    Export to CSV
                                </MenuItem>
                            )}
                        </Menu>
                    </>
                )}

                {onAddExtra}

                {showAdd && onAdd && (
                    <Button
                        size="small"
                        variant="contained"
                        onClick={onAdd}
                        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                        sx={{
                            textTransform: 'none',
                            fontSize: 12.5,
                            fontWeight: 600,
                            px: 1.75,
                            borderRadius: '8px',
                            boxShadow: 'none',
                        }}
                    >
                        {addLabel}
                    </Button>
                )}
            </Box>

            {/* Row 2: Filter chips */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    flexWrap: 'wrap',
                }}
            >
                {onStartDateChange && (
                    <DatePicker
                        label="Start"
                        value={startDate}
                        onChange={onStartDateChange}
                        format="dd/MM/yyyy"
                        slotProps={{
                            textField: {
                                size: 'small',
                                sx: {
                                    width: 150,
                                    '& .MuiInputBase-input': { fontSize: 12, color: 'var(--t-text)' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--t-border)' },
                                    '& .MuiInputLabel-root': { fontSize: 12, color: 'var(--t-text-muted)' },
                                },
                            },
                        }}
                    />
                )}
                {onEndDateChange && (
                    <DatePicker
                        label="End"
                        value={endDate}
                        onChange={onEndDateChange}
                        format="dd/MM/yyyy"
                        slotProps={{
                            textField: {
                                size: 'small',
                                sx: {
                                    width: 150,
                                    '& .MuiInputBase-input': { fontSize: 12, color: 'var(--t-text)' },
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--t-border)' },
                                    '& .MuiInputLabel-root': { fontSize: 12, color: 'var(--t-text-muted)' },
                                },
                            },
                        }}
                    />
                )}

                {/* Dynamic filter chips chosen by the page (LUC has university /
                    program / source / etc., Skillhub has counselor / status). */}
                {chipRow}

                {onClearFilters && (
                    <Button
                        size="small"
                        variant="text"
                        onClick={onClearFilters}
                        startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            color: 'var(--t-text-muted)',
                            textTransform: 'none',
                            fontSize: 12,
                            px: 1.25,
                        }}
                    >
                        Clear
                    </Button>
                )}
            </Box>
        </Box>
    );
};

export { FilterChip };
export default StudentsToolbar;
