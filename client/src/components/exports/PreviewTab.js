import React from 'react';
import {
    Box,
    Stack,
    Typography,
    CircularProgress,
    Alert,
    Snackbar,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortIcon from '@mui/icons-material/Sort';
import ClearIcon from '@mui/icons-material/Clear';

import exportsApi from '../../services/exportsApi';
import xlsxBuilder from '../../services/xlsxBuilder';

import DataGrid from './DataGrid';
import FilterClusters from './FilterClusters';

const VAT_DISCLAIMER =
    'Note: Admission Fee Paid in LUC mixes net-of-VAT and gross-of-VAT entries (UAE VAT 5%). Treat sums as approximate.';

const GRID_ROW_CAP = 10000;

// Controlled component. Page (ExportCenterPage) owns:
//   - dimensions, measures (catalog from /api/exports/dimensions)
//   - allColumns, selectedKeys (column-picker state)
//   - pivotConfig (rowDim/colDim/measure/agg)
// PreviewTab still owns its own:
//   - filterState (filter chip selections — Preview-mode-only)
//   - rawRows, rawTotal, pivotEnvelope (server data)
//   - sortColumns (grid-specific UI state)
const PreviewTab = ({
    dataset,
    organization,
    dateRange,
    onPreviewChange,
    dimensions = [],
    measures = [],
    allColumns = [],
    selectedKeys = [],
    pivotConfig = {},
}) => {
    const [filterState, setFilterState] = React.useState({});
    const [sortColumns, setSortColumns] = React.useState([]);

    const [rawRows, setRawRows] = React.useState([]);
    const [rawTotal, setRawTotal] = React.useState(0);
    const [pivotEnvelope, setPivotEnvelope] = React.useState(null);

    const [loading, setLoading] = React.useState(false);
    const [toast, setToast] = React.useState(null);

    const mode = pivotConfig.rowDim ? 'pivot' : 'raw';

    // ── Reset filters + data + sort on dataset/org change ────────────
    React.useEffect(() => {
        setFilterState({});
        setRawRows([]);
        setRawTotal(0);
        setPivotEnvelope(null);
        setSortColumns([]);
    }, [dataset, organization]);

    // Reset sort when mode flips (raw <-> pivot) — column shapes differ so
    // a stale sort key would point at a non-existent column.
    React.useEffect(() => {
        setSortColumns([]);
    }, [pivotConfig.rowDim, pivotConfig.colDim]);

    const buildBaseFilters = React.useCallback(() => {
        const filters = { ...filterState };
        if (dateRange?.startDate) filters.startDate = dateRange.startDate;
        if (dateRange?.endDate) filters.endDate = dateRange.endDate;
        return filters;
    }, [filterState, dateRange]);

    // ── Fetch rows (raw mode) ────────────────────────────────────────
    React.useEffect(() => {
        if (mode !== 'raw') return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                const filters = buildBaseFilters();
                const all = [];
                let cursor = undefined;
                let totalEst = null;
                let safety = 0;
                while (all.length < GRID_ROW_CAP && safety < 25) {
                    const res = await exportsApi.postRaw({
                        dataset,
                        organization,
                        filters,
                        columns: selectedKeys.length ? selectedKeys : undefined,
                        cursor,
                        limit: 5000,
                    });
                    if (cancelled) return;
                    if (totalEst == null) totalEst = res.totalEstimate;
                    for (const r of res.rows) all.push(r);
                    cursor = res.nextCursor;
                    if (!cursor) break;
                    safety += 1;
                }
                if (cancelled) return;
                setRawRows(all);
                setRawTotal(typeof totalEst === 'number' ? totalEst : all.length);
            } catch (err) {
                if (cancelled) return;
                setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [mode, dataset, organization, filterState, dateRange, selectedKeys, buildBaseFilters]);

    // ── Fetch pivot (pivot mode) ─────────────────────────────────────
    React.useEffect(() => {
        if (mode !== 'pivot') return undefined;
        const { rowDim, colDim, measure, agg } = pivotConfig;
        if (!rowDim) return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                const filters = buildBaseFilters();
                const res = await exportsApi.postPivot({
                    dataset,
                    organization,
                    filters,
                    rowDim,
                    colDim: colDim || undefined,
                    measure: agg === 'count' || agg === 'distinct' ? undefined : measure,
                    agg,
                });
                if (cancelled) return;
                setPivotEnvelope({ ...res, rowDim, colDim, measure, agg });
            } catch (err) {
                if (cancelled) return;
                setPivotEnvelope(null);
                setToast({ severity: 'error', message: err?.response?.data?.message || err.message });
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [mode, pivotConfig, dataset, organization, filterState, dateRange, buildBaseFilters]);

    // ── Compute previewState (memoized) ──────────────────────────────
    const previewState = React.useMemo(() => {
        if (mode === 'pivot' && pivotEnvelope) {
            const headerLabel = dimensions.find((d) => d.key === pivotEnvelope.rowDim)?.lbl || pivotEnvelope.rowDim;
            const measureLabel = pivotEnvelope.agg === 'count' ? 'Count'
                : pivotEnvelope.agg === 'distinct' ? 'Distinct count'
                : (measures.find((m) => m.key === pivotEnvelope.measure)?.lbl || pivotEnvelope.measure);
            const sheet = xlsxBuilder.pivotResultToSheet({
                name: 'Pivot',
                cells: pivotEnvelope.cells,
                rowOrder: pivotEnvelope.rowOrder,
                colOrder: pivotEnvelope.colOrder,
                rowTotals: pivotEnvelope.rowTotals,
                colTotals: pivotEnvelope.colTotals,
                grandTotal: pivotEnvelope.grandTotal,
                agg: pivotEnvelope.agg,
                measure: pivotEnvelope.measure,
                colDim: pivotEnvelope.colDim,
                headerLabel,
                measureLabel,
            });
            const filename = pivotEnvelope.colDim
                ? `pivot_${dataset}_${pivotEnvelope.rowDim}_x_${pivotEnvelope.colDim}_${pivotEnvelope.agg}${pivotEnvelope.agg === 'count' || pivotEnvelope.agg === 'distinct' ? '' : `_${pivotEnvelope.measure}`}`
                : `pivot_${dataset}_${pivotEnvelope.rowDim}_${pivotEnvelope.agg}${pivotEnvelope.agg === 'count' || pivotEnvelope.agg === 'distinct' ? '' : `_${pivotEnvelope.measure}`}`;
            const showVat =
                organization === 'luc'
                && pivotEnvelope.agg === 'sum'
                && pivotEnvelope.measure === 'admissionFeePaid';
            return {
                mode: 'pivot',
                rows: sheet.rows,
                columns: sheet.columns,
                totalEstimate: sheet.rows.length,
                filename,
                disclaimerRows: showVat ? [VAT_DISCLAIMER] : [],
            };
        }

        // Raw mode.
        const orderedColumns = selectedKeys.length > 0
            ? selectedKeys.map((k) => allColumns.find((c) => c.key === k)).filter(Boolean)
            : allColumns.filter((c) => c.defaultExport);
        const includesAdmFee = orderedColumns.some((c) => c.key === 'admissionFeePaid');
        const showVat = organization === 'luc' && includesAdmFee;
        return {
            mode: 'raw',
            rows: rawRows,
            columns: orderedColumns,
            totalEstimate: rawTotal,
            filename: `${dataset}_${organization || 'all'}`,
            disclaimerRows: showVat ? [VAT_DISCLAIMER] : [],
        };
    }, [mode, pivotEnvelope, rawRows, rawTotal, selectedKeys, allColumns, dataset, organization, dimensions, measures]);

    React.useEffect(() => {
        onPreviewChange?.(previewState);
    }, [previewState, onPreviewChange]);

    const truncated = mode === 'raw' && rawRows.length >= GRID_ROW_CAP && rawTotal > GRID_ROW_CAP;
    const baseGridRows = mode === 'raw' ? rawRows.slice(0, GRID_ROW_CAP) : previewState.rows;
    const gridColumns = previewState.columns;

    // Apply client-side sort. Pivot mode pins the trailing Totals row at
    // the bottom regardless of direction.
    const gridRows = React.useMemo(() => {
        if (!sortColumns || sortColumns.length === 0) return baseGridRows;
        const { columnKey, direction } = sortColumns[0];
        const col = gridColumns.find((c) => c.key === columnKey);
        if (!col) return baseGridRows;

        const getSortableValue = (row) => {
            if (typeof col.format === 'function') return col.format(row, 0);
            const path = col.key;
            return path.includes('.')
                ? path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row)
                : row[path];
        };
        const compareCells = (a, b) => {
            if (a == null && b == null) return 0;
            if (a == null) return direction === 'ASC' ? -1 :  1;
            if (b == null) return direction === 'ASC' ?  1 : -1;
            if (typeof a === 'number' && typeof b === 'number') {
                return direction === 'ASC' ? a - b : b - a;
            }
            const sa = String(a);
            const sb = String(b);
            return direction === 'ASC'
                ? sa.localeCompare(sb, 'en', { numeric: true, sensitivity: 'base' })
                : sb.localeCompare(sa, 'en', { numeric: true, sensitivity: 'base' });
        };

        if (mode === 'pivot' && baseGridRows.length > 0) {
            const body = baseGridRows.slice(0, -1);
            const totals = baseGridRows[baseGridRows.length - 1];
            const sortedBody = [...body].sort((ra, rb) =>
                compareCells(getSortableValue(ra), getSortableValue(rb))
            );
            return [...sortedBody, totals];
        }
        return [...baseGridRows].sort((ra, rb) =>
            compareCells(getSortableValue(ra), getSortableValue(rb))
        );
    }, [sortColumns, baseGridRows, gridColumns, mode]);

    const sortableColumns = React.useMemo(
        () => gridColumns.filter((c) => !c.key.startsWith('__') && c.key !== 'rowIndex'),
        [gridColumns]
    );
    const currentSort = sortColumns[0] || null;
    const setSortColumn = (columnKey) => {
        if (!columnKey) return setSortColumns([]);
        setSortColumns([{ columnKey, direction: 'ASC' }]);
    };
    const toggleSortDirection = () => {
        if (!currentSort) return;
        const nextDir = currentSort.direction === 'ASC' ? 'DESC' : 'ASC';
        setSortColumns([{ columnKey: currentSort.columnKey, direction: nextDir }]);
    };
    const clearSort = () => setSortColumns([]);

    return (
        <Box>
            {dimensions.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    <FilterClusters
                        dataset={dataset}
                        organization={organization}
                        dimensions={dimensions}
                        value={filterState}
                        onChange={setFilterState}
                    />
                </Box>
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* Sort row + row count */}
            <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ mb: 1.5 }}
            >
                <SortIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Sort by</InputLabel>
                    <Select
                        value={currentSort?.columnKey || ''}
                        onChange={(e) => setSortColumn(e.target.value)}
                        label="Sort by"
                    >
                        <MenuItem value=""><em>None (default order)</em></MenuItem>
                        {sortableColumns.map((c) => (
                            <MenuItem key={c.key} value={c.key}>
                                {c.exportLbl || c.lbl || c.key}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Tooltip
                    title={
                        currentSort?.direction === 'ASC'
                            ? 'Ascending — click for Descending'
                            : currentSort?.direction === 'DESC'
                            ? 'Descending — click for Ascending'
                            : 'Pick a column to sort'
                    }
                >
                    <span>
                        <IconButton
                            size="small"
                            onClick={toggleSortDirection}
                            disabled={!currentSort}
                            sx={{ border: '1px solid var(--d-border, #ccc)' }}
                        >
                            {currentSort?.direction === 'DESC'
                                ? <ArrowDownwardIcon fontSize="small" />
                                : <ArrowUpwardIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>
                {currentSort && (
                    <Tooltip title="Clear sort">
                        <IconButton
                            size="small"
                            onClick={clearSort}
                            sx={{ border: '1px solid var(--d-border, #ccc)' }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {loading ? (
                        <><CircularProgress size={12} sx={{ mr: 1 }} />Loading…</>
                    ) : mode === 'pivot' ? (
                        <>Pivot: <strong>{previewState.rows.length}</strong> row{previewState.rows.length === 1 ? '' : 's'} (incl. totals)</>
                    ) : (
                        <>Showing <strong>{rawRows.length.toLocaleString()}</strong> of <strong>{rawTotal.toLocaleString()}</strong> row{rawTotal === 1 ? '' : 's'}</>
                    )}
                </Typography>
            </Stack>

            {truncated && (
                <Alert severity="info" sx={{ mb: 1 }}>
                    Showing first {GRID_ROW_CAP.toLocaleString()} of {rawTotal.toLocaleString()} rows. Download to see all.
                </Alert>
            )}

            <DataGrid
                rows={gridRows}
                columns={gridColumns}
                height={520}
                sortColumns={sortColumns}
                onSortColumnsChange={setSortColumns}
            />

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

export default PreviewTab;
