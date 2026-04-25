// Plan §4 — verify PreviewTab's mode flip:
//   - Initial mount → mode='raw', DataGrid receives the raw-row payload.
//   - User picks a Rows dim from the pivot Accordion → mode='pivot',
//     DataGrid receives the flattened pivot rows ending in a Totals row.

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';

// Mock exportsApi BEFORE importing PreviewTab.
const mockGetDimensions = jest.fn();
const mockPostRaw       = jest.fn();
const mockPostPivot     = jest.fn();
jest.mock('../../../services/exportsApi', () => ({
    __esModule: true,
    default: {
        getDimensions: (...args) => mockGetDimensions(...args),
        postRaw:       (...args) => mockPostRaw(...args),
        postPivot:     (...args) => mockPostPivot(...args),
    },
}));

// FilterClusters renders SearchableMultiSelect (MUI Autocomplete) and
// brings the cluster-grouping UI into PreviewTab. The PreviewTab specs
// don't assert on filter UI, so stub it out.
jest.mock('../FilterClusters', () => ({
    __esModule: true,
    default: () => null,
}));

// Replace the heavy DataGrid wrapper with a stub that surfaces what props
// it received. We don't want react-data-grid in jsdom for this spec.
jest.mock('../DataGrid', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ rows, columns }) => React.createElement(
            'div',
            {
                'data-testid': 'datagrid-stub',
                'data-row-count': rows.length,
                'data-col-count': columns.length,
            },
            // Last row's _row label, useful for asserting pivot Totals row.
            rows.length ? String(rows[rows.length - 1]._row || rows[rows.length - 1].name || rows.length) : ''
        ),
    };
});

const PreviewTab = require('../PreviewTab').default;

beforeEach(() => {
    mockGetDimensions.mockReset();
    mockPostRaw.mockReset();
    mockPostPivot.mockReset();
});

describe('PreviewTab', () => {
    const FAKE_COLUMNS = [
        { key: 'studentName', lbl: 'Student Name', defaultExport: true },
    ];
    const FAKE_DIMS = [{ key: 'source', lbl: 'Source', kind: 'distinct', values: ['Google Ads'] }];
    const FAKE_MEASURES = [{ key: 'count', lbl: 'Count', default: true }];

    test('initial mount: mode="raw" and DataGrid gets the raw-row payload', async () => {
        mockGetDimensions.mockResolvedValue({ dimensions: FAKE_DIMS, measures: FAKE_MEASURES });
        mockPostRaw.mockResolvedValue({
            success: true,
            rows: [{ _id: '1', studentName: 'Student 001' }, { _id: '2', studentName: 'Student 002' }],
            nextCursor: null,
            totalEstimate: 2,
        });

        const onPreviewChange = jest.fn();
        await act(async () => {
            render(
                <PreviewTab
                    dataset="students"
                    organization="luc"
                    dateRange={{}}
                    onPreviewChange={onPreviewChange}
                    dimensions={FAKE_DIMS}
                    measures={FAKE_MEASURES}
                    allColumns={FAKE_COLUMNS}
                    selectedKeys={['studentName']}
                    pivotConfig={{}}
                />
            );
        });

        // Wait for the debounced mockPostRaw to fire.
        await waitFor(() => expect(mockPostRaw).toHaveBeenCalled(), { timeout: 2000 });
        await waitFor(() => {
            const grid = screen.queryByTestId('datagrid-stub');
            expect(grid).not.toBeNull();
            expect(grid.getAttribute('data-row-count')).toBe('2');
        });

        const last = onPreviewChange.mock.calls.at(-1)[0];
        expect(last.mode).toBe('raw');
        expect(last.rows).toHaveLength(2);
        expect(last.totalEstimate).toBe(2);
    });

    test('setting rowDim flips mode to "pivot" and bubbles flattened rows ending in Totals', async () => {
        mockGetDimensions.mockResolvedValue({ dimensions: FAKE_DIMS, measures: FAKE_MEASURES });
        mockPostRaw.mockResolvedValue({ success: true, rows: [{ _id: '1' }], nextCursor: null, totalEstimate: 1 });
        mockPostPivot.mockResolvedValue({
            success: true,
            cells: [
                { row: 'Google Ads', value: 12 },
                { row: 'Facebook',   value: 8  },
            ],
            rowOrder: ['Google Ads', 'Facebook'],
            colOrder: [],
            rowTotals: [
                { row: 'Google Ads', value: 12 },
                { row: 'Facebook',   value: 8  },
            ],
            colTotals: [],
            grandTotal: 20,
        });

        const onPreviewChange = jest.fn();
        // Render with empty pivotConfig (raw mode).
        let view;
        await act(async () => {
            view = render(
                <PreviewTab
                    dataset="students"
                    organization="luc"
                    dateRange={{}}
                    onPreviewChange={onPreviewChange}
                    dimensions={FAKE_DIMS}
                    measures={FAKE_MEASURES}
                    allColumns={FAKE_COLUMNS}
                    selectedKeys={['studentName']}
                    pivotConfig={{}}
                />
            );
        });

        // Wait for raw mode to settle.
        await waitFor(() =>
            expect(onPreviewChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'raw' }))
        );

        // Re-render with a pivot config — page-level state lift means the
        // pivot Select lives on ExportCenterPage; PreviewTab just receives
        // the resulting prop change.
        await act(async () => {
            view.rerender(
                <PreviewTab
                    dataset="students"
                    organization="luc"
                    dateRange={{}}
                    onPreviewChange={onPreviewChange}
                    dimensions={FAKE_DIMS}
                    measures={FAKE_MEASURES}
                    allColumns={FAKE_COLUMNS}
                    selectedKeys={['studentName']}
                    pivotConfig={{ rowDim: 'source', agg: 'count' }}
                />
            );
        });

        // Wait for pivot mode to bubble.
        await waitFor(() => expect(mockPostPivot).toHaveBeenCalled(), { timeout: 2000 });
        await waitFor(() =>
            expect(onPreviewChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'pivot' }))
        );

        const pivotCall = onPreviewChange.mock.calls.map((c) => c[0]).find((s) => s.mode === 'pivot');
        expect(pivotCall.rows.length).toBeGreaterThan(0);
        // Flattened pivot rows end with the Totals row (label='Total').
        expect(pivotCall.rows[pivotCall.rows.length - 1]._row).toBe('Total');
    });
});
