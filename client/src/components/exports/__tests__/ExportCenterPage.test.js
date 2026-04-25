// Plan §4 — verify the page wires PreviewTab's `onPreviewChange` callback
// straight through to HeaderDownloadButtons, and that the Templates tab
// hides the header buttons.

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock the auth context — page reads user.role to default the org tab.
jest.mock('../../../context/AuthContext', () => ({
    __esModule: true,
    useAuth: () => ({ user: { role: 'admin', organization: 'luc' }, logout: () => {} }),
    AuthProvider: ({ children }) => children,
}));

// Page now calls exportsApi.getDimensions on mount to populate the rail.
jest.mock('../../../services/exportsApi', () => ({
    __esModule: true,
    default: {
        getDimensions: () => Promise.resolve({ dimensions: [], measures: [] }),
        postRaw: () => Promise.resolve({ rows: [], nextCursor: null, totalEstimate: 0 }),
        postPivot: () => Promise.resolve({ cells: [], rowOrder: [], colOrder: [], rowTotals: [], colTotals: [], grandTotal: 0 }),
    },
}));

// PivotControlsPanel + ColumnPicker now render at page level — stub them
// so the rail doesn't pull MUI Select / axios into jsdom for this spec.
jest.mock('../../../components/exports/PivotControlsPanel', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/exports/ColumnPicker', () => ({
    __esModule: true,
    default: () => null,
}));

// Mock react-router-dom hooks the page calls. Stub useNavigate so the
// resolveRoleChrome helper + back-button can call it without a Router.
// `virtual: true` sidesteps Jest's CJS resolver — react-router-dom v7 is
// ESM-only and trips it without this flag.
jest.mock(
    'react-router-dom',
    () => ({
        __esModule: true,
        useNavigate: () => () => {},
        useLocation: () => ({ pathname: '/exports' }),
    }),
    { virtual: true }
);

// Stub the dashboard chrome so the page renders cleanly in jsdom without
// pulling framer-motion / nested ThemeProvider / token vars. Each stub
// just renders children (or `right` slot for the hero).
jest.mock('../../../components/dashboard/DashboardShell', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ children }) => React.createElement('div', { 'data-testid': 'shell-stub' }, children),
    };
});
jest.mock('../../../components/dashboard/DashboardHero', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ title, right }) => React.createElement(
            'div',
            { 'data-testid': 'hero-stub' },
            React.createElement('h1', null, title),
            right
        ),
    };
});
jest.mock('../../../components/dashboard/SectionCard', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ children }) => React.createElement('div', { 'data-testid': 'section-card-stub' }, children),
    };
});
jest.mock('../../../utils/dashboardTheme', () => ({
    __esModule: true,
    useDashboardThemeState: () => ({ mode: 'light', toggle: () => {}, tokensSx: {}, contextValue: {} }),
}));

// Sidebars — page imports all four for role-based switching. Stub so the
// avatar/quote/notification deep imports don't drag in.
jest.mock('../../../components/AdminSidebar', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/Sidebar', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/ManagerSidebar', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/skillhub/SkillhubSidebar', () => ({
    __esModule: true,
    default: () => null,
}));

// Stub PreviewTab — fires a canned previewState through onPreviewChange so
// HeaderDownloadButtons gets something to render against.
jest.mock('../../../components/exports/PreviewTab', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ onPreviewChange }) => {
            React.useEffect(() => {
                onPreviewChange?.({
                    mode: 'raw',
                    rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
                    columns: [{ key: 'id', lbl: 'ID' }],
                    filename: 'students_luc',
                    disclaimerRows: [],
                    totalEstimate: 3,
                });
            }, [onPreviewChange]);
            return React.createElement('div', { 'data-testid': 'preview-tab-stub' }, 'preview');
        },
    };
});

// Stub TemplatesTab — empty content, just renders.
jest.mock('../../../components/exports/TemplatesTab', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: () => React.createElement('div', { 'data-testid': 'templates-tab-stub' }, 'templates'),
    };
});

// Stub the small primitives so they don't pull MUI x-date-pickers etc into
// jsdom land for this spec.
jest.mock('../../../components/exports/DatasetSelector', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/exports/ExportOrgTabs', () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock('../../../components/exports/DateRangeChips', () => ({
    __esModule: true,
    default: () => null,
}));

// Capture HeaderDownloadButtons props.
let lastPreviewProp = null;
jest.mock('../../../components/exports/HeaderDownloadButtons', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: ({ previewState }) => {
            lastPreviewProp = previewState;
            return React.createElement(
                'div',
                { 'data-testid': 'header-buttons-stub', 'data-row-count': previewState ? previewState.rows.length : 0 },
                'header-buttons'
            );
        },
    };
});

const ExportCenterPage = require('../../../pages/ExportCenterPage').default;

beforeEach(() => {
    lastPreviewProp = null;
});

describe('ExportCenterPage', () => {
    test('PreviewTab onPreviewChange syncs into HeaderDownloadButtons', async () => {
        await act(async () => {
            render(<ExportCenterPage />);
        });
        // Stub fires synthetic state on mount via useEffect.
        expect(screen.getByTestId('header-buttons-stub')).toBeInTheDocument();
        expect(lastPreviewProp).toMatchObject({
            mode: 'raw',
            filename: 'students_luc',
            totalEstimate: 3,
        });
        expect(lastPreviewProp.rows).toHaveLength(3);
    });

    test('switching to Templates tab hides HeaderDownloadButtons', async () => {
        await act(async () => {
            render(<ExportCenterPage />);
        });
        expect(screen.getByTestId('header-buttons-stub')).toBeInTheDocument();

        // Click the Templates tab.
        const templatesTab = screen.getByRole('tab', { name: /templates/i });
        await act(async () => {
            fireEvent.click(templatesTab);
        });

        expect(screen.queryByTestId('header-buttons-stub')).not.toBeInTheDocument();
        expect(screen.getByTestId('templates-tab-stub')).toBeInTheDocument();
    });
});
