import React from 'react';
import { Stack, Button, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

import xlsxBuilder from '../../services/xlsxBuilder';

// Plan §4 — pinned to the page header. Reads the current PreviewTab state
// from props and downloads the exact rows + columns the grid is showing
// (raw rows or pivot wide-table). Always visible — no scrolling required.
const HeaderDownloadButtons = ({ previewState }) => {
    const ready =
        previewState &&
        Array.isArray(previewState.rows) &&
        Array.isArray(previewState.columns) &&
        previewState.rows.length > 0 &&
        previewState.columns.length > 0;

    const handle = (kind) => () => {
        if (!ready) return;
        const { rows, columns, filename, disclaimerRows = [] } = previewState;
        xlsxBuilder.exportRawSheet(rows, columns, filename, kind, { disclaimerRows });
    };

    const tooltip = ready
        ? `${previewState.rows.length.toLocaleString()} row${previewState.rows.length === 1 ? '' : 's'} ready`
        : 'No rows to download — adjust filters';

    return (
        <Stack direction="row" spacing={1}>
            <Tooltip title={tooltip}>
                <span>
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={handle('xlsx')}
                        disabled={!ready}
                    >
                        .xlsx
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title={tooltip}>
                <span>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handle('csv')}
                        disabled={!ready}
                    >
                        .csv
                    </Button>
                </span>
            </Tooltip>
        </Stack>
    );
};

export default HeaderDownloadButtons;
