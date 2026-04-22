import React, { useState } from 'react';
import {
    Box,
    Button,
    ToggleButton,
    ToggleButtonGroup,
    Menu,
    MenuItem,
    Divider,
} from '@mui/material';
import {
    TableChart as TableIcon,
    ViewColumn as BoardIcon,
    GridView as CardsIcon,
    Add as AddIcon,
    ExpandMore as ChevronIcon,
    Close as CloseIcon,
    Sort as SortIcon,
    AutoAwesome as SparkleIcon,
    LightMode as LightModeIcon,
    DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ALL_LEAD_STAGES, STATUS_META } from '../../utils/commitmentDesign';

const FilterChip = ({
    label,
    value,
    options,
    onChange,
    width = 180,
}) => {
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
                {active && <Box component="span" sx={{ fontWeight: 600 }}>{value}</Box>}
                {active ? (
                    <Box
                        component="span"
                        sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.25 }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                        }}
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
                    onClick={() => { onChange(''); setAnchor(null); }}
                    sx={{ fontSize: 12.5, color: 'var(--t-text-3)' }}
                >
                    All {label.toLowerCase()}
                </MenuItem>
                <Divider sx={{ my: 0.5, borderColor: 'var(--t-border)' }} />
                {options.map((opt) => (
                    <MenuItem
                        key={opt.value || opt}
                        onClick={() => { onChange(opt.value || opt); setAnchor(null); }}
                        selected={(opt.value || opt) === value}
                        sx={{ fontSize: 12.5, color: 'var(--t-text)' }}
                    >
                        {opt.label || opt}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

const CommitmentsToolbar = ({
    view,
    onViewChange,
    density,
    onDensityChange,
    filters,
    onFilterChange,
    onClearFilters,
    teamLeads = [],
    consultants = [],
    isAdmin,
    onAdd,
    onAIAnalysis,
    mode = 'light',
    onToggleMode,
}) => {
    const hasFilters = Boolean(
        filters.leadStage ||
            filters.status ||
            filters.teamLead ||
            filters.consultantName ||
            filters.startDate ||
            filters.endDate
    );

    const stageOptions = ALL_LEAD_STAGES.map((s) => ({ value: s, label: s }));
    const statusOptions = Object.entries(STATUS_META).map(([v, m]) => ({
        value: v,
        label: m.label,
    }));
    const consultantOptions = consultants.map((c) => ({
        value: c.name,
        label: c.name,
    }));
    const tlOptions = teamLeads.map((u) => ({ value: u._id, label: u.name }));

    const selectedTlLabel =
        tlOptions.find((o) => o.value === filters.teamLead)?.label || '';

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
                        '& .MuiToggleButton-root.Mui-selected:hover': {
                            backgroundColor: 'var(--t-surface)',
                        },
                    }}
                >
                    <ToggleButton value="table"><TableIcon sx={{ fontSize: 18 }} /> Table</ToggleButton>
                    <ToggleButton value="board"><BoardIcon sx={{ fontSize: 18 }} /> Board</ToggleButton>
                    <ToggleButton value="cards"><CardsIcon sx={{ fontSize: 18 }} /> Cards</ToggleButton>
                </ToggleButtonGroup>

                <Box sx={{ flex: 1 }} />

                <Button
                    size="small"
                    variant="text"
                    onClick={() => onDensityChange(density === 'compact' ? 'comfy' : 'compact')}
                    sx={{
                        color: 'var(--t-text-3)',
                        textTransform: 'none',
                        fontSize: 12,
                        gap: 0.5,
                        px: 1.25,
                    }}
                    startIcon={<SortIcon sx={{ fontSize: 14 }} />}
                >
                    {density === 'compact' ? 'Compact' : 'Comfy'}
                </Button>

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
                        startIcon={<SparkleIcon sx={{ fontSize: 14, color: '#8B5CF6' }} />}
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
                    New commitment
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <FilterChip
                    label="Lead stage"
                    value={filters.leadStage || ''}
                    options={stageOptions}
                    onChange={(v) => onFilterChange('leadStage', v)}
                    width={220}
                />
                <FilterChip
                    label="Status"
                    value={filters.status ? STATUS_META[filters.status]?.label || filters.status : ''}
                    options={statusOptions}
                    onChange={(v) => onFilterChange('status', v)}
                />
                {isAdmin && (
                    <FilterChip
                        label="Team lead"
                        value={selectedTlLabel}
                        options={tlOptions}
                        onChange={(v) => onFilterChange('teamLead', v)}
                        width={220}
                    />
                )}
                <FilterChip
                    label="Consultant"
                    value={filters.consultantName || ''}
                    options={consultantOptions}
                    onChange={(v) => onFilterChange('consultantName', v)}
                    width={220}
                />
                <DatePicker
                    label="From"
                    value={filters.startDate}
                    onChange={(d) => onFilterChange('startDate', d)}
                    format="dd/MM/yyyy"
                    slotProps={{
                        textField: {
                            size: 'small',
                            sx: {
                                width: 150,
                                '& .MuiInputBase-root': { fontSize: 12, borderRadius: '999px' },
                                '& .MuiInputLabel-root': { fontSize: 12 },
                            },
                        },
                    }}
                />
                <DatePicker
                    label="To"
                    value={filters.endDate}
                    onChange={(d) => onFilterChange('endDate', d)}
                    format="dd/MM/yyyy"
                    slotProps={{
                        textField: {
                            size: 'small',
                            sx: {
                                width: 150,
                                '& .MuiInputBase-root': { fontSize: 12, borderRadius: '999px' },
                                '& .MuiInputLabel-root': { fontSize: 12 },
                            },
                        },
                    }}
                />

                {hasFilters && (
                    <Button
                        onClick={onClearFilters}
                        size="small"
                        sx={{
                            color: 'var(--t-accent)',
                            textTransform: 'none',
                            fontSize: 12,
                            fontWeight: 550,
                            ml: 0.5,
                        }}
                    >
                        Clear all
                    </Button>
                )}

                <Box sx={{ flex: 1 }} />
            </Box>
        </Box>
    );
};

export default CommitmentsToolbar;
