// Smoke spec for the DataGrid wrapper: confirms the right column config
// reaches react-data-grid (frozen first non-synthetic column, money/date
// renderCell paths). Mocks rdg so we don't fight its DOM-measurement code
// in jsdom — the assertion target is the wrapper's mapping logic.

import React from 'react';
import { render, screen } from '@testing-library/react';

// Replace react-data-grid with a tiny stand-in that records the props it
// was handed AND invokes renderCell once per cell so the wrapper's render
// functions are exercised.
jest.mock('react-data-grid', () => {
    const React = require('react');
    return {
        DataGrid: ({ columns, rows }) =>
            React.createElement(
                'div',
                { 'data-testid': 'rdg-mock' },
                React.createElement(
                    'div',
                    { 'data-testid': 'rdg-headers' },
                    columns.map((c) =>
                        React.createElement(
                            'span',
                            {
                                key: c.key,
                                'data-key': c.key,
                                'data-frozen': String(!!c.frozen),
                                'data-cell-class': c.cellClass || '',
                            },
                            typeof c.name === 'string' ? c.name : c.key
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { 'data-testid': 'rdg-body' },
                    rows.map((row, rowIdx) =>
                        React.createElement(
                            'div',
                            { key: rowIdx, 'data-testid': 'rdg-row' },
                            columns.map((c) => {
                                const out = c.renderCell
                                    ? c.renderCell({ row, rowIdx, column: c })
                                    : '';
                                return React.createElement(
                                    'span',
                                    { key: c.key, 'data-cell': c.key },
                                    out
                                );
                            })
                        )
                    )
                )
            ),
    };
});

const DataGrid = require('../DataGrid').default;

describe('DataGrid wrapper', () => {
    test('renders header labels and one row per data row', () => {
        const columns = [
            { key: 'name', lbl: 'Name' },
            { key: 'fee',  lbl: 'Fee', money: true },
        ];
        const rows = [
            { name: 'Alice', fee: 1500 },
            { name: 'Bob',   fee: 2500 },
        ];
        render(<DataGrid rows={rows} columns={columns} />);

        const headers = screen.getByTestId('rdg-headers');
        expect(headers).toHaveTextContent('Name');
        expect(headers).toHaveTextContent('Fee');
        expect(screen.getAllByTestId('rdg-row')).toHaveLength(2);
    });

    test('first non-synthetic column gets frozen=true; synthetic __row column does not', () => {
        const columns = [
            { key: '__row',        lbl: '#',           format: (_r, i) => i + 1 },
            { key: 'studentName',  lbl: 'Student Name' },
            { key: 'fee',          lbl: 'Fee', money: true },
        ];
        render(<DataGrid rows={[{ studentName: 'A', fee: 1 }]} columns={columns} />);
        const headerSpans = screen.getByTestId('rdg-headers').querySelectorAll('span');
        const byKey = {};
        headerSpans.forEach((s) => { byKey[s.getAttribute('data-key')] = s; });
        expect(byKey.__row.getAttribute('data-frozen')).toBe('false');
        expect(byKey.studentName.getAttribute('data-frozen')).toBe('true');
        expect(byKey.fee.getAttribute('data-frozen')).toBe('false');
    });

    test('money cells render with " AED" suffix and right-align cellClass', () => {
        const columns = [
            { key: 'name', lbl: 'Name' },
            { key: 'fee',  lbl: 'Fee', money: true },
        ];
        render(<DataGrid rows={[{ name: 'Alice', fee: 12500 }]} columns={columns} />);
        const rowEl = screen.getByTestId('rdg-row');
        expect(rowEl).toHaveTextContent('12,500 AED');
        // cellClass attribute present on the money column header
        const header = screen.getByTestId('rdg-headers').querySelector('[data-key="fee"]');
        expect(header.getAttribute('data-cell-class')).toBe('tpt-rdg-money');
    });

    test('date cells render as yyyy-MM-dd', () => {
        const columns = [
            { key: 'name', lbl: 'Name' },
            { key: 'closingDate', lbl: 'Closing Date', date: true },
        ];
        render(
            <DataGrid
                rows={[{ name: 'Alice', closingDate: '2026-04-22T00:00:00.000Z' }]}
                columns={columns}
            />
        );
        const rowEl = screen.getByTestId('rdg-row');
        expect(rowEl).toHaveTextContent('2026-04-22');
    });
});
