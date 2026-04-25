import React from 'react';
import { DataGrid as RDG } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { format as fmtDate } from 'date-fns';
import { Box } from '@mui/material';

// Plan §4 — DataGrid wrapper. Maps the existing Export Center column-config
// shape ({ key, lbl, exportLbl?, money?, date?, format? }) into react-data-
// grid's `Column<TRow>` shape. The first non-synthetic column is frozen so
// it pins on horizontal scroll. Sticky header is rdg's default.

function resolveValue(row, col, rowIdx) {
    if (typeof col.format === 'function') return col.format(row, rowIdx);
    const path = col.key;
    return path.includes('.')
        ? path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row)
        : row[path];
}

function renderText(value) {
    if (value == null || value === '') return '';
    return String(value);
}

function renderDate(raw) {
    if (raw == null || raw === '') return '';
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return fmtDate(d, 'yyyy-MM-dd');
}

function renderMoney(raw) {
    if (raw == null || raw === '') return '';
    const n = Number(raw);
    if (!Number.isFinite(n)) return '';
    return `${n.toLocaleString()} AED`;
}

function deriveRdgColumns(columns) {
    // Find the first column that isn't a format-only synthetic counter
    // (e.g. Skillhub's '__row' index column). That's the one to freeze.
    const firstNonSyntheticIdx = columns.findIndex(
        (c) => !c.key.startsWith('__') && c.key !== 'rowIndex'
    );
    const freezeIdx = firstNonSyntheticIdx >= 0 ? firstNonSyntheticIdx : 0;

    return columns.map((col, i) => {
        const renderCell = ({ row, rowIdx }) => {
            const raw = resolveValue(row, col, rowIdx);
            if (col.date) return renderDate(raw);
            if (col.money) return renderMoney(raw);
            return renderText(raw);
        };
        // Synthetic counter columns (e.g. '__row', 'rowIndex') aren't
        // meaningful to sort — keep sortable false. Everything else gets
        // click-to-sort with rdg's native asc/desc cycle.
        const isSynthetic = col.key.startsWith('__') || col.key === 'rowIndex';
        return {
            key: col.key,
            name: col.exportLbl || col.lbl || col.key,
            frozen: i === freezeIdx,
            resizable: true,
            sortable: !isSynthetic,
            minWidth: 80,
            // Money + date fit in narrower fixed widths; let rdg auto-size text.
            width: col.money ? 140 : col.date ? 120 : undefined,
            cellClass: col.money
                ? 'tpt-rdg-money'
                : col.date
                ? 'tpt-rdg-date'
                : undefined,
            renderCell,
        };
    });
}

const DataGrid = ({
    rows,
    columns,
    height = 520,
    rowKeyGetter,
    className,
    sortColumns,
    onSortColumnsChange,
}) => {
    const rdgColumns = React.useMemo(() => deriveRdgColumns(columns), [columns]);
    const keyer =
        rowKeyGetter ||
        ((row) => {
            // Prefer Mongo _id when present; fall back to a stable composite
            // for pivot wide-table rows ({_row, _value} or {_row, c__*}).
            if (row && row._id) return String(row._id);
            if (row && row._row != null) return `__row::${row._row}`;
            return JSON.stringify(row);
        });

    return (
        <Box
            sx={{
                height,
                width: '100%',
                maxWidth: '100%',
                // `minWidth: 0` lets this Box shrink below its content's
                // intrinsic min-content width when it sits inside a flex /
                // grid track — without it, rdg's column widths would force
                // the whole page wider than the viewport.
                minWidth: 0,
                overflow: 'hidden',
                // Money cells right-align; the rdg cellClass hooks both the
                // header and body cells.
                '& .tpt-rdg-money': { textAlign: 'right', justifyContent: 'flex-end' },
                '& .tpt-rdg-date':  { fontVariantNumeric: 'tabular-nums' },
                // rdg ships its colors via the CSS `light-dark()` function,
                // which keys off the OS color scheme — so a user with OS dark
                // mode + our app in light mode gets light-grey header text on
                // a light header background (header text invisible). Pin
                // rdg's vars to literal values + force a light color-scheme
                // so the header always renders dark-on-light.
                '& .rdg': {
                    blockSize: '100%',
                    inlineSize: '100%',
                    colorScheme: 'light',
                    '--rdg-color': '#0f172a',
                    '--rdg-background-color': '#ffffff',
                    '--rdg-header-background-color': '#f8fafc',
                    '--rdg-header-draggable-background-color': '#e2e8f0',
                    '--rdg-row-hover-background-color': '#f1f5f9',
                    '--rdg-border-color': '#e2e8f0',
                    '--rdg-summary-border-color': '#cbd5e1',
                },
                '& .rdg-header-row': {
                    color: '#0f172a',
                    fontWeight: 600,
                    backgroundColor: '#f8fafc',
                },
                '& .rdg-header-row .rdg-cell': {
                    color: '#0f172a',
                },
            }}
        >
            <RDG
                columns={rdgColumns}
                rows={rows}
                rowKeyGetter={keyer}
                className={className || 'rdg-light'}
                style={{ height: '100%' }}
                sortColumns={sortColumns}
                onSortColumnsChange={onSortColumnsChange}
            />
        </Box>
    );
};

export default DataGrid;
