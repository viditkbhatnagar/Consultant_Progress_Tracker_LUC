// Thin shim around xlsxBuilder for back-compat with the four legacy
// callers that haven't migrated to column-config-driven exports yet:
//   - components/StudentTable.js  → exportToExcel / exportToCSV
//   - pages/TeamLeadDashboard.js  → exportCommitmentsToExcel / exportToCSV
//   - pages/ConsultantDashboard.js (dead code per CLAUDE.md)
// The four pages refactored as part of Export Center Phase 1 (LucStudentDB,
// SkillhubStudentDB, AdminDashboard, HourlyTracker) call xlsxBuilder
// directly. New code SHOULD do the same. This file exists only so the
// remaining legacy call sites keep working.

import xlsxBuilder from './xlsxBuilder';
import { commitmentsColumns } from '../config/exportColumns/commitments';

// Generic key-as-label columns derived from the first row.
function inferColumns(data) {
    if (!Array.isArray(data) || data.length === 0) return [];
    return Object.keys(data[0]).map((k) => ({ key: k, lbl: k }));
}

export const exportCommitmentsToExcel = (commitments, filename = 'commitments') => {
    xlsxBuilder.exportRawSheet(commitments, commitmentsColumns, filename, 'xlsx');
};

export const exportToCSV = (data, filename = 'export') => {
    if (!Array.isArray(data) || data.length === 0) return;
    xlsxBuilder.exportRawSheet(data, inferColumns(data), filename, 'csv');
};

export const exportToExcel = (data, filename = 'export') => {
    if (!Array.isArray(data) || data.length === 0) return;
    xlsxBuilder.exportRawSheet(data, inferColumns(data), filename, 'xlsx');
};

const exportService = {
    exportCommitmentsToExcel,
    exportToCSV,
    exportToExcel,
};

export default exportService;
