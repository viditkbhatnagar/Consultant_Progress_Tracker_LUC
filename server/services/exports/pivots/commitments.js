const mongoose = require('mongoose');
const Commitment = require('../../../models/Commitment');
const { buildScopeFilter } = require('../../../middleware/auth');
const { bucketDate, buildAccumulator } = require('./_shared');

const DIMENSIONS = [
    { key: 'status',         lbl: 'Status',          kind: 'distinct', path: 'status' },
    { key: 'leadStage',      lbl: 'Lead Stage',      kind: 'distinct', path: 'leadStage' },
    { key: 'teamName',       lbl: 'Team',            kind: 'distinct', path: 'teamName' },
    { key: 'teamLeadName',   lbl: 'Team Lead',       kind: 'distinct', path: 'teamLeadName' },
    { key: 'consultantName', lbl: 'Consultant',      kind: 'distinct', path: 'consultantName' },
    { key: 'dayCommitted',   lbl: 'Day Committed',   kind: 'distinct', path: 'dayCommitted' },
    {
        key: 'admissionClosed',
        lbl: 'Admission Closed',
        kind: 'distinct',
        path: 'admissionClosed',
    },
    // Bucket dims used by the commitments_*_x_week templates.
    {
        key: 'weekStartDateWeek',
        lbl: 'Week (start)',
        kind: 'bucket',
        expr: bucketDate('weekStartDate', 'week'),
    },
    {
        key: 'weekStartDateMonth',
        lbl: 'Month (week start)',
        kind: 'bucket',
        expr: bucketDate('weekStartDate', 'month'),
    },
];

const MEASURES = [
    { key: 'count', lbl: 'Count', default: true },
    { key: 'closedAmount', lbl: 'Sum closedAmount (AED)', money: true },
    { key: 'achievementPercentage', lbl: 'Avg Achievement %' },
    { key: 'conversionProbability', lbl: 'Avg Conversion Probability %' },
    { key: 'meetingsDone', lbl: 'Sum Meetings Done' },
];

function dimensionCatalog() {
    return DIMENSIONS;
}

function measureCatalog() {
    return MEASURES;
}

function resolveOrgScope(user, bodyOrganization) {
    if (user.role === 'admin') {
        if (bodyOrganization === 'all') return 'all';
        if (bodyOrganization && ['luc', 'skillhub_training', 'skillhub_institute'].includes(bodyOrganization)) {
            return bodyOrganization;
        }
        return 'luc';
    }
    if (user.role === 'team_lead') return 'luc';
    if (user.role === 'skillhub') return user.organization;
    return null;
}

function buildRawMatch({ user, orgScope, filters }) {
    const fakeReq = { user, query: {} };
    const baseScope = buildScopeFilter(fakeReq);
    const match = { ...baseScope };

    if (user.role === 'admin') {
        if (orgScope && orgScope !== 'all') match.organization = orgScope;
    }

    // Date filter — Phase 1 Raw uses commitmentDate (the actual day), per
    // the existing `getCommitmentsByDateRange` precedent.
    if (filters && (filters.startDate || filters.endDate)) {
        match.commitmentDate = {};
        if (filters.startDate) match.commitmentDate.$gte = new Date(filters.startDate);
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            match.commitmentDate.$lte = end;
        }
    }

    if (filters && typeof filters === 'object') {
        for (const dim of DIMENSIONS) {
            const v = filters[dim.key];
            if (v == null) continue;
            if (Array.isArray(v) && v.length > 0) match[dim.path] = { $in: v };
            else if (!Array.isArray(v) && v !== '') match[dim.path] = v;
        }
    }

    return match;
}

async function runRawQuery({ user, orgScope, filters, columns, cursor, limit }) {
    const match = buildRawMatch({ user, orgScope, filters });

    let cursorMatch = {};
    if (cursor) {
        try {
            const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
            if (decoded.lastId) {
                cursorMatch._id = { $gt: new mongoose.Types.ObjectId(decoded.lastId) };
            }
        } catch (_e) {
            // ignore
        }
    }

    const finalMatch = { ...match, ...cursorMatch };
    const cap = Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 5000);

    let projection;
    if (Array.isArray(columns) && columns.length > 0) {
        projection = { _id: 1, organization: 1 };
        for (const key of columns) projection[key.split('.')[0]] = 1;
    }

    const query = Commitment.find(finalMatch);
    if (projection) query.select(projection);
    const rows = await query.sort({ _id: 1 }).limit(cap + 1).lean();

    let nextCursor = null;
    let pageRows = rows;
    if (rows.length > cap) {
        pageRows = rows.slice(0, cap);
        const lastId = pageRows[pageRows.length - 1]._id;
        nextCursor = Buffer.from(JSON.stringify({ lastId: lastId.toString() }), 'utf-8').toString('base64');
    }

    const totalEstimate = !cursor ? await Commitment.countDocuments(match) : null;

    return { rows: pageRows, nextCursor, totalEstimate };
}

async function distinctValues({ user, orgScope, dimensionKey }) {
    const dim = DIMENSIONS.find((d) => d.key === dimensionKey);
    if (!dim) return [];
    const match = buildRawMatch({ user, orgScope, filters: {} });
    const values = await Commitment.distinct(dim.path, match);
    return values
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map((v) => (typeof v === 'boolean' ? String(v) : v))
        .sort();
}

function resolveDimGroupExpr(dim, fieldName, addsAccum) {
    if (dim.kind === 'derived' || dim.kind === 'bucket') {
        addsAccum[fieldName] = dim.expr;
        return `$${fieldName}`;
    }
    return `$${dim.path}`;
}

async function runPivotQuery({ user, orgScope, filters, rowDim, colDim, measure, agg }) {
    if (!rowDim) {
        const e = new Error('rowDim is required');
        e.statusCode = 400;
        throw e;
    }
    const rowDef = DIMENSIONS.find((d) => d.key === rowDim);
    if (!rowDef) {
        const e = new Error(`rowDim '${rowDim}' is not available for commitments`);
        e.statusCode = 400;
        throw e;
    }
    const colDef = colDim ? DIMENSIONS.find((d) => d.key === colDim) : null;
    if (colDim && !colDef) {
        const e = new Error(`colDim '${colDim}' is not available for commitments`);
        e.statusCode = 400;
        throw e;
    }

    const validAggs = ['count', 'sum', 'avg', 'min', 'max'];
    if (!validAggs.includes(agg)) {
        const e = new Error(`agg '${agg}' must be one of ${validAggs.join('|')}`);
        e.statusCode = 400;
        throw e;
    }

    let measurePath = null;
    if (agg !== 'count') {
        const measureDef = MEASURES.find((m) => m.key === measure);
        if (!measureDef) {
            const e = new Error(`measure '${measure}' is not available for commitments`);
            e.statusCode = 400;
            throw e;
        }
        measurePath = measure;
    }

    const match = buildRawMatch({ user, orgScope, filters });
    const pipeline = [{ $match: match }];

    const dimAdds = {};
    const rowExpr = resolveDimGroupExpr(rowDef, '__rowKey', dimAdds);
    const colExpr = colDef ? resolveDimGroupExpr(colDef, '__colKey', dimAdds) : null;
    if (Object.keys(dimAdds).length > 0) {
        pipeline.push({ $addFields: dimAdds });
    }
    const groupId = colExpr ? { row: rowExpr, col: colExpr } : { row: rowExpr };
    const acc = buildAccumulator(measurePath, agg);

    pipeline.push({ $group: { _id: groupId, value: acc } });
    pipeline.push({
        $project: colExpr
            ? { _id: 0, row: '$_id.row', col: '$_id.col', value: 1 }
            : { _id: 0, row: '$_id.row', value: 1 },
    });

    const cells = await Commitment.aggregate(pipeline);

    const rowTotalsMap = new Map();
    const colTotalsMap = new Map();
    let grandTotal = 0;
    const rowOrderSet = new Set();
    const colOrderSet = new Set();
    for (const cell of cells) {
        const r = cell.row == null ? '' : String(cell.row);
        const c = cell.col == null ? '' : String(cell.col);
        const v = Number(cell.value) || 0;
        rowOrderSet.add(r);
        if (colExpr) colOrderSet.add(c);
        rowTotalsMap.set(r, (rowTotalsMap.get(r) || 0) + v);
        if (colExpr) colTotalsMap.set(c, (colTotalsMap.get(c) || 0) + v);
        grandTotal += v;
        cell.row = r;
        if (colExpr) cell.col = c;
    }

    return {
        cells,
        rowTotals: Array.from(rowTotalsMap.entries()).map(([row, value]) => ({ row, value })),
        colTotals: colExpr
            ? Array.from(colTotalsMap.entries()).map(([col, value]) => ({ col, value }))
            : [],
        grandTotal,
        rowOrder: Array.from(rowOrderSet).sort(),
        colOrder: colExpr ? Array.from(colOrderSet).sort() : [],
    };
}

module.exports = {
    dimensionCatalog,
    measureCatalog,
    resolveOrgScope,
    buildRawMatch,
    runRawQuery,
    runPivotQuery,
    distinctValues,
    DIMENSIONS,
    MEASURES,
};
