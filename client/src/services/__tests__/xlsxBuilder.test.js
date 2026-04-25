// Pure-function spec for xlsxBuilder.pivotResultToSheet — single source of
// truth for flattening pivot envelopes into wide-table rows + column config
// for both the Templates tab and the Preview tab. Plan §4.

import xlsxBuilder, { pivotResultToSheet } from '../xlsxBuilder';

describe('xlsxBuilder.pivotResultToSheet', () => {
    test('two-dim pivot (colDim set) builds [rowLabel, ...cols, Total] columns + Totals row', () => {
        const env = {
            name: 'Source × Month',
            cells: [
                { row: 'Google Ads', col: 'April', value: 12 },
                { row: 'Google Ads', col: 'May',   value: 7  },
                { row: 'Facebook',   col: 'April', value: 8  },
                { row: 'Facebook',   col: 'May',   value: 11 },
            ],
            rowOrder: ['Google Ads', 'Facebook'],
            colOrder: ['April', 'May'],
            rowTotals: [
                { row: 'Google Ads', value: 19 },
                { row: 'Facebook',   value: 19 },
            ],
            colTotals: [
                { col: 'April', value: 20 },
                { col: 'May',   value: 18 },
            ],
            grandTotal: 38,
            agg: 'count',
            colDim: 'month',
            headerLabel: 'Source',
        };

        const sheet = pivotResultToSheet(env);
        expect(sheet.name).toBe('Source × Month');
        // Columns: _row + 2 cols + _total = 4
        expect(sheet.columns.map((c) => c.key)).toEqual(['_row', 'c__April', 'c__May', '_total']);
        expect(sheet.columns[0].lbl).toBe('Source');
        // Data rows + Totals row = 3
        expect(sheet.rows).toHaveLength(3);
        const [r1, r2, totals] = sheet.rows;
        expect(r1).toMatchObject({ _row: 'Google Ads', c__April: 12, c__May: 7, _total: 19 });
        expect(r2).toMatchObject({ _row: 'Facebook',   c__April: 8,  c__May: 11, _total: 19 });
        expect(totals).toMatchObject({ _row: 'Total', c__April: 20, c__May: 18, _total: 38 });
    });

    test('one-dim pivot (no colDim) builds [rowLabel, value] columns + Totals row', () => {
        const env = {
            cells: [
                { row: 'Alumni',     value: 4 },
                { row: 'Google Ads', value: 27 },
            ],
            rowOrder: ['Alumni', 'Google Ads'],
            rowTotals: [
                { row: 'Alumni',     value: 4 },
                { row: 'Google Ads', value: 27 },
            ],
            grandTotal: 31,
            agg: 'count',
            headerLabel: 'Source',
            measureLabel: 'Count of admissions',
        };
        const sheet = pivotResultToSheet(env);
        expect(sheet.columns.map((c) => c.key)).toEqual(['_row', '_value']);
        expect(sheet.columns[1].lbl).toBe('Count of admissions');
        expect(sheet.rows).toHaveLength(3);
        expect(sheet.rows[0]).toEqual({ _row: 'Alumni', _value: 4 });
        expect(sheet.rows[2]).toEqual({ _row: 'Total',  _value: 31 });
    });

    test('agg=sum + measure=admissionFeePaid auto-flags money columns', () => {
        const sheet = pivotResultToSheet({
            cells:     [{ row: 'Google Ads', col: 'April', value: 12500 }],
            rowOrder:  ['Google Ads'],
            colOrder:  ['April'],
            rowTotals: [{ row: 'Google Ads', value: 12500 }],
            colTotals: [{ col: 'April',      value: 12500 }],
            grandTotal: 12500,
            agg: 'sum',
            measure: 'admissionFeePaid',
            colDim: 'month',
        });
        // The April col + the Total col should be money-flagged.
        const colByKey = Object.fromEntries(sheet.columns.map((c) => [c.key, c]));
        expect(colByKey['c__April'].money).toBe(true);
        expect(colByKey['_total'].money).toBe(true);
        expect(colByKey['_row'].money).toBeUndefined();
    });

    test('default export exposes pivotResultToSheet too', () => {
        expect(typeof xlsxBuilder.pivotResultToSheet).toBe('function');
    });
});
