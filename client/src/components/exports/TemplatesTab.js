import React from 'react';
import {
    Box,
    Stack,
    Button,
    Typography,
    CircularProgress,
    Alert,
    Snackbar,
    Card,
    CardContent,
    CardActions,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import axios from 'axios';
import { API_BASE_URL } from '../../utils/constants';
import xlsxBuilder from '../../services/xlsxBuilder';

const API_URL = `${API_BASE_URL}/exports`;

// Pivot envelope flattening lives in `xlsxBuilder.pivotResultToSheet` —
// single source of truth shared by PreviewTab and TemplatesTab. Plan §4.
const pivotEnvelopeToSheet = (envelope) => xlsxBuilder.pivotResultToSheet(envelope);

// Convert a raw sheet envelope into rows + heuristic columns. Server hands
// us full row docs; we infer columns from the first row's keys (excluding
// internal Mongo fields).
const HIDDEN_KEYS = new Set(['_id', '__v', 'organization']);
function rawEnvelopeToSheet(envelope) {
    const { name, rows = [] } = envelope;
    if (rows.length === 0) {
        return { name, rows: [], columns: [{ key: '_empty', lbl: '(no rows)', defaultExport: true }] };
    }
    const firstKeys = Object.keys(rows[0]).filter((k) => !HIDDEN_KEYS.has(k));
    const columns = firstKeys.map((k) => ({ key: k, lbl: k, defaultExport: true }));
    return { name, rows, columns };
}

function envelopeToSheet(envelope) {
    if (envelope.kind === 'pivot') return pivotEnvelopeToSheet(envelope);
    return rawEnvelopeToSheet(envelope);
}

const TemplatesTab = ({ dataset, organization, dateRange }) => {
    const [templates, setTemplates] = React.useState([]);
    const [savedTemplates, setSavedTemplates] = React.useState([]);
    // Saved-template list sort. Plan §(g). Server returns updatedAt:-1 by
    // default; this lets the user flip to oldest-first or alphabetize.
    const [savedSort, setSavedSort] = React.useState('newest');
    const [loading, setLoading] = React.useState(false);
    const [downloading, setDownloading] = React.useState(null);
    const [toast, setToast] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const [tplRes, savedRes] = await Promise.all([
                    axios.get(`${API_URL}/templates`),
                    axios.get(`${API_URL}/saved-templates`),
                ]);
                if (cancelled) return;
                setTemplates(tplRes.data.templates || []);
                setSavedTemplates(savedRes.data.templates || []);
            } catch (err) {
                if (cancelled) return;
                setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const buildOverrideBody = () => {
        const filters = {};
        if (dateRange?.startDate) filters.startDate = dateRange.startDate;
        if (dateRange?.endDate) filters.endDate = dateRange.endDate;
        return {
            filters,
            organization, // top-level org tab override
        };
    };

    const handleRun = async (templateId) => {
        try {
            setDownloading(templateId);
            const res = await axios.post(`${API_URL}/template/${templateId}`, buildOverrideBody());
            const env = res.data;
            const sheets = (env.sheets || []).map(envelopeToSheet);
            xlsxBuilder.buildWorkbook({ sheets });
            // buildWorkbook returns the Blob, but we want to download it.
            const blob = xlsxBuilder.buildWorkbook({ sheets });
            const stamp = new Date().toISOString().slice(0, 10);
            xlsxBuilder.downloadBlob(blob, `${env.templateId}_${stamp}.xlsx`);
            setToast({
                severity: 'success',
                message: `${env.name}: downloaded ${sheets.length} sheet${sheets.length === 1 ? '' : 's'}`,
            });
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        } finally {
            setDownloading(null);
        }
    };

    const handleDeleteSaved = async (id) => {
        try {
            await axios.delete(`${API_URL}/saved-templates/${id}`);
            setSavedTemplates((prev) => prev.filter((t) => t._id !== id));
            setToast({ severity: 'success', message: 'Saved template deleted' });
        } catch (err) {
            setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
        }
    };

    // Group pre-built templates by dataset/org for the cards layout.
    const grouped = React.useMemo(() => {
        const byKey = {};
        for (const t of templates) {
            const k = `${t.dataset}::${t.organization}`;
            (byKey[k] = byKey[k] || []).push(t);
        }
        // Plan §12: order LUC Students → Skillhub Students → Commitments → Meetings → Hourly → Cross-org.
        const ORDER = [
            'students::luc',
            'students::skillhub_training',
            'students::skillhub_institute',
            'commitments::luc',
            'meetings::luc',
            'hourly::luc',
            'students::all',
        ];
        return ORDER.map((k) => ({ key: k, list: byKey[k] || [] })).filter((g) => g.list.length > 0);
    }, [templates]);

    const groupLabel = (key) => {
        const map = {
            'students::luc':                 'LUC Students',
            'students::skillhub_training':   'Skillhub Students',
            'students::skillhub_institute':  'Skillhub Students (Institute)',
            'commitments::luc':              'Commitments',
            'meetings::luc':                 'Meetings',
            'hourly::luc':                   'Hourly',
            'students::all':                 'Cross-org',
        };
        return map[key] || key;
    };

    return (
        <Box>
            {loading && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <CircularProgress size={16} /> <Typography variant="body2">Loading templates…</Typography>
                </Stack>
            )}

            {!loading && templates.length === 0 && (
                <Alert severity="info">No pre-built templates available for your role.</Alert>
            )}

            {grouped.map((group) => (
                <Box key={group.key} sx={{ mb: 4 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1, fontWeight: 700 }}>
                        {groupLabel(group.key)}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {group.list.map((t) => (
                            <Card key={t.id} variant="outlined" sx={{ width: 320 }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {t.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        {t.description}
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                        <Chip label={`${t.sheets} sheet${t.sheets === 1 ? '' : 's'}`} size="small" sx={{ mr: 0.5 }} />
                                        <Chip label={t.organization === 'all' ? 'cross-org' : t.organization} size="small" />
                                    </Box>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        startIcon={downloading === t.id ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                                        onClick={() => handleRun(t.id)}
                                        disabled={!!downloading}
                                    >
                                        {downloading === t.id ? 'Running…' : 'Run'}
                                    </Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Stack>
                </Box>
            ))}

            <Divider sx={{ my: 3 }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Saved templates</Typography>
                {savedTemplates.length > 0 && (
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Sort by</InputLabel>
                        <Select
                            value={savedSort}
                            label="Sort by"
                            onChange={(e) => setSavedSort(e.target.value)}
                        >
                            <MenuItem value="newest">Newest first</MenuItem>
                            <MenuItem value="oldest">Oldest first</MenuItem>
                            <MenuItem value="name_asc">Name A→Z</MenuItem>
                            <MenuItem value="name_desc">Name Z→A</MenuItem>
                        </Select>
                    </FormControl>
                )}
            </Stack>
            {savedTemplates.length === 0 && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No saved templates yet. Use the <strong>Save as template</strong> button on the Pivot Builder tab.
                </Typography>
            )}
            {[...savedTemplates].sort((a, b) => {
                if (savedSort === 'newest')   return new Date(b.updatedAt) - new Date(a.updatedAt);
                if (savedSort === 'oldest')   return new Date(a.updatedAt) - new Date(b.updatedAt);
                if (savedSort === 'name_asc')  return (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' });
                if (savedSort === 'name_desc') return (b.name || '').localeCompare(a.name || '', 'en', { sensitivity: 'base' });
                return 0;
            }).map((t) => (
                <Card key={t._id} variant="outlined" sx={{ mb: 1 }}>
                    <CardContent sx={{ pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t.name}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {t.dataset} · {t.organization} · {t.config?.agg || 'count'}
                                {t.config?.rowDim ? ` · row=${t.config.rowDim}` : ''}
                                {t.config?.colDim ? ` · col=${t.config.colDim}` : ''}
                                {t.config?.measure ? ` · measure=${t.config.measure}` : ''}
                            </Typography>
                        </Box>
                        <Tooltip title="Delete saved template">
                            <IconButton size="small" onClick={() => handleDeleteSaved(t._id)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </CardContent>
                </Card>
            ))}

            <Snackbar
                open={!!toast}
                autoHideDuration={4500}
                onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {toast ? (
                    <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
                        {toast.message}
                    </Alert>
                ) : null}
            </Snackbar>
        </Box>
    );
};

export default TemplatesTab;
