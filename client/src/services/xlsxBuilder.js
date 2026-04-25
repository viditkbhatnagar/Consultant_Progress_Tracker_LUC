import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format as fmtDate } from 'date-fns';

const AED_FORMAT = '#,##0\\ "AED"';
const DATE_FORMAT = 'yyyy-mm-dd';

function getCellValue(row, column, index, { asString = false } = {}) {
    if (typeof column.format === 'function') {
        return column.format(row, index);
    }
    const path = column.key;
    const raw = path.includes('.')
        ? path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row)
        : row[path];
    if (raw === undefined || raw === null || raw === '') return '';
    if (column.date) {
        const d = raw instanceof Date ? raw : new Date(raw);
        if (Number.isNaN(d.getTime())) return '';
        return asString ? fmtDate(d, 'yyyy-MM-dd') : d;
    }
    if (column.money) {
        const n = Number(raw);
        return Number.isFinite(n) ? n : '';
    }
    return raw;
}

function columnHeader(column) {
    return column.exportLbl || column.lbl || column.key;
}

function buildSheet({ rows, columns, disclaimerRows = [] }) {
    const headerLabels = columns.map(columnHeader);
    const aoa = [];
    for (const text of disclaimerRows) aoa.push([text]);
    aoa.push(headerLabels);
    for (let i = 0; i < rows.length; i++) {
        aoa.push(columns.map((col) => getCellValue(rows[i], col, i)));
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    const headerRowIdx = disclaimerRows.length;

    for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        if (!col.money && !col.date) continue;
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
            const addr = XLSX.utils.encode_cell({ c, r });
            const cell = ws[addr];
            if (!cell) continue;
            if (col.money && typeof cell.v === 'number') {
                cell.t = 'n';
                cell.z = AED_FORMAT;
            } else if (col.date) {
                // Force any usable value (Date object, ISO string, or Excel
                // serial number) to a typed Date cell with yyyy-mm-dd
                // format. Belt-and-braces — aoa_to_sheet's `cellDates`
                // option was observed to skip some string-shaped values
                // when the column had mixed populated/empty rows.
                let dateObj = null;
                if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
                    dateObj = cell.v;
                } else if (typeof cell.v === 'string' && cell.v.trim() !== '') {
                    const parsed = new Date(cell.v);
                    if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
                } else if (typeof cell.v === 'number' && Number.isFinite(cell.v)) {
                    const parsed = new Date(Math.round((cell.v - 25569) * 86400 * 1000));
                    if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
                }
                if (dateObj) {
                    cell.t = 'd';
                    cell.v = dateObj;
                    cell.z = DATE_FORMAT;
                }
            }
        }
    }

    ws['!cols'] = columns.map((col, c) => {
        let maxLen = String(headerLabels[c] || '').length;
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
            const v = aoa[r][c];
            if (v == null) continue;
            const s = v instanceof Date ? fmtDate(v, 'yyyy-MM-dd') : String(v);
            if (s.length > maxLen) maxLen = s.length;
        }
        return { wch: Math.min(Math.max(maxLen + 2, 8), 60) };
    });

    return ws;
}

export function buildWorkbook({ sheets }) {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        const ws = buildSheet(sheet);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true });
    return new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}

export function buildRawWorkbook(rows, columns, sheetName = 'Data', disclaimerRows = []) {
    return buildWorkbook({ sheets: [{ name: sheetName, rows, columns, disclaimerRows }] });
}

export function buildCsvBlob(rows, columns) {
    const ws = XLSX.utils.aoa_to_sheet([
        columns.map(columnHeader),
        ...rows.map((row, i) =>
            columns.map((col) => getCellValue(row, col, i, { asString: true }))
        ),
    ]);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function downloadBlob(blob, filename) {
    saveAs(blob, filename);
}

export function exportRawSheet(
    rows,
    columns,
    filename,
    kind = 'xlsx',
    { sheetName = 'Data', disclaimerRows = [] } = {}
) {
    const stamp = fmtDate(new Date(), 'yyyy-MM-dd');
    const fullName = `${filename}_${stamp}.${kind}`;
    if (kind === 'csv') {
        downloadBlob(buildCsvBlob(rows, columns), fullName);
    } else {
        downloadBlob(buildRawWorkbook(rows, columns, sheetName, disclaimerRows), fullName);
    }
}

// Convert a pivot result envelope (server's /api/exports/pivot response shape)
// into { name, rows, columns } suitable for `exportRawSheet`. Single source
// of truth — used by PreviewTab, the legacy PivotBuilderTab download path,
// and TemplatesTab's multi-sheet workbook builder. Plan §4 refactor.
//
// Rules:
//   - When colDim is set: build a wide table with [rowLabel, ...colHeaders, Total]
//     and append a Totals row at the bottom.
//   - When colDim is empty: build a 2-col table [rowLabel, value] + Totals row.
//   - Money flag bubbles up from the caller (sum/avg of admissionFeePaid,
//     courseFee, closedAmount, etc.). VAT disclaimer attachment stays the
//     caller's responsibility.
const PIVOT_MONEY_MEASURES = new Set([
    'admissionFeePaid',
    'courseFee',
    'closedAmount',
    'registrationFee',
    'emiPaid',
    'outstandingPerStudent',
]);

export function pivotResultToSheet({
    name = 'Pivot',
    cells = [],
    rowOrder = [],
    colOrder = [],
    rowTotals = [],
    colTotals = [],
    grandTotal = 0,
    agg,
    measure,
    colDim,
    headerLabel = 'Row',
    measureLabel,
    valueIsMoney,
} = {}) {
    const isMoney =
        typeof valueIsMoney === 'boolean'
            ? valueIsMoney
            : agg === 'sum' && PIVOT_MONEY_MEASURES.has(measure);

    const cellMap = new Map();
    for (const cell of cells) {
        const key = colDim ? `${cell.row} ${cell.col}` : cell.row;
        cellMap.set(key, cell.value);
    }
    const rowTotalMap = new Map(rowTotals.map((t) => [t.row, t.value]));
    const colTotalMap = new Map(colTotals.map((t) => [t.col, t.value]));

    if (colDim) {
        const columns = [{ key: '_row', lbl: headerLabel, defaultExport: true }];
        for (const c of colOrder) {
            columns.push({
                key: `c__${c}`,
                lbl: c || '(blank)',
                money: isMoney,
                defaultExport: true,
            });
        }
        columns.push({
            key: '_total',
            lbl: 'Total',
            money: isMoney,
            defaultExport: true,
        });

        const rows = [];
        for (const r of rowOrder) {
            const row = { _row: r || '(blank)' };
            for (const c of colOrder) {
                row[`c__${c}`] = cellMap.get(`${r} ${c}`) ?? 0;
            }
            row._total = rowTotalMap.get(r) ?? 0;
            rows.push(row);
        }
        const totalsRow = { _row: 'Total' };
        for (const c of colOrder) totalsRow[`c__${c}`] = colTotalMap.get(c) ?? 0;
        totalsRow._total = grandTotal;
        rows.push(totalsRow);

        return { name, rows, columns };
    }

    const columns = [
        { key: '_row',   lbl: headerLabel,                              defaultExport: true },
        { key: '_value', lbl: measureLabel || 'Value', money: isMoney,  defaultExport: true },
    ];
    const rows = [];
    for (const r of rowOrder) {
        rows.push({ _row: r || '(blank)', _value: rowTotalMap.get(r) ?? 0 });
    }
    rows.push({ _row: 'Total', _value: grandTotal });
    return { name, rows, columns };
}

const xlsxBuilder = {
    buildWorkbook,
    buildRawWorkbook,
    buildCsvBlob,
    downloadBlob,
    exportRawSheet,
    pivotResultToSheet,
};

export default xlsxBuilder;
