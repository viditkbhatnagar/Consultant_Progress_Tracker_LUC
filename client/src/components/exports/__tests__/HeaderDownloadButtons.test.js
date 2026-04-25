// Plan §4 — HeaderDownloadButtons reads previewState (raw OR pivot-flattened)
// and calls xlsxBuilder.exportRawSheet for both modes. We verify:
//   - Disabled state when no preview is ready.
//   - Click .xlsx in raw mode → exportRawSheet receives raw rows.
//   - Click .csv in pivot mode → exportRawSheet receives pivot-flattened rows.
//   - VAT disclaimer flows through.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Jest hoists jest.mock() ABOVE imports + declarations. Variables referenced
// inside the factory must be `mock`-prefixed so the hoist guard allows them.
const mockExportRawSheet = jest.fn();
jest.mock('../../../services/xlsxBuilder', () => {
    const fn = (...args) => mockExportRawSheet(...args);
    return {
        __esModule: true,
        default: { exportRawSheet: fn },
        exportRawSheet: fn,
    };
});

// We re-import only after the mock is established.
const HeaderDownloadButtons = require('../HeaderDownloadButtons').default;

beforeEach(() => {
    mockExportRawSheet.mockClear();
});

describe('HeaderDownloadButtons', () => {
    test('renders disabled buttons when previewState is null', () => {
        render(<HeaderDownloadButtons previewState={null} />);
        const xlsxBtn = screen.getByRole('button', { name: /\.xlsx/i });
        const csvBtn  = screen.getByRole('button', { name: /\.csv/i });
        expect(xlsxBtn).toBeDisabled();
        expect(csvBtn).toBeDisabled();
        fireEvent.click(xlsxBtn);
        expect(mockExportRawSheet).not.toHaveBeenCalled();
    });

    test('renders disabled buttons when rows are empty', () => {
        render(
            <HeaderDownloadButtons
                previewState={{
                    mode: 'raw',
                    rows: [],
                    columns: [{ key: 'a', lbl: 'A' }],
                    filename: 'students_luc',
                }}
            />
        );
        expect(screen.getByRole('button', { name: /\.xlsx/i })).toBeDisabled();
    });

    test('raw mode click → mockExportRawSheet receives raw rows + filename + xlsx kind', () => {
        const previewState = {
            mode: 'raw',
            rows: [{ name: 'Alice' }, { name: 'Bob' }],
            columns: [{ key: 'name', lbl: 'Name' }],
            filename: 'students_luc',
            disclaimerRows: [],
        };
        render(<HeaderDownloadButtons previewState={previewState} />);
        fireEvent.click(screen.getByRole('button', { name: /\.xlsx/i }));
        expect(mockExportRawSheet).toHaveBeenCalledTimes(1);
        const [rows, columns, filename, kind, opts] = mockExportRawSheet.mock.calls[0];
        expect(rows).toEqual(previewState.rows);
        expect(columns).toEqual(previewState.columns);
        expect(filename).toBe('students_luc');
        expect(kind).toBe('xlsx');
        expect(opts.disclaimerRows).toEqual([]);
    });

    test('pivot mode click → mockExportRawSheet receives pivot-flattened rows + VAT disclaimer when present', () => {
        const previewState = {
            mode: 'pivot',
            rows: [
                { _row: 'Google Ads', c__April: 12, _total: 12 },
                { _row: 'Total',      c__April: 12, _total: 12 },
            ],
            columns: [
                { key: '_row',      lbl: 'Source' },
                { key: 'c__April',  lbl: 'April',  money: true },
                { key: '_total',    lbl: 'Total',  money: true },
            ],
            filename: 'pivot_students_source_x_month_sum_admissionFeePaid',
            disclaimerRows: ['Note: Admission Fee Paid in LUC mixes net-of-VAT…'],
        };
        render(<HeaderDownloadButtons previewState={previewState} />);
        fireEvent.click(screen.getByRole('button', { name: /\.csv/i }));
        expect(mockExportRawSheet).toHaveBeenCalledTimes(1);
        const [rows, columns, filename, kind, opts] = mockExportRawSheet.mock.calls[0];
        // Rows are the pivot-flattened wide table — first column is _row,
        // value cells are pre-aggregated. Confirm the shape passes through.
        expect(rows[0]._row).toBe('Google Ads');
        expect(columns[1].money).toBe(true);
        expect(filename).toBe('pivot_students_source_x_month_sum_admissionFeePaid');
        expect(kind).toBe('csv');
        expect(opts.disclaimerRows).toHaveLength(1);
    });
});
