const mongoose = require('mongoose');
const HourlyActivity = require('../../../models/HourlyActivity');
const Consultant = require('../../../models/Consultant');
const User = require('../../../models/User');
const { normalizeHourlyActivities } = require('./_shared');

const DIMENSIONS = [
    { key: 'activityType', lbl: 'Activity Type', kind: 'distinct', path: 'activityType' },
    { key: 'slotId',       lbl: 'Slot',          kind: 'distinct', path: 'slotId' },
    { key: 'organization', lbl: 'Organization',  kind: 'distinct', path: 'organization' },
];

const MEASURES = [
    { key: 'count',    lbl: 'Slots filled', default: true },
    { key: 'sumCount', lbl: 'Sum count' },
    { key: 'duration', lbl: 'Sum duration (mins)' },
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

// Hourly docs have no teamLead FK — scope by date + organization, then for
// non-admin team_leads filter post-hoc by consultant.teamLead match. This
// mirrors `hourlyController.hourlyScopeFilter`/`leaderboardConsultantScope`
// for Export Center's stricter own-team rule (plan §11.4).
function buildRawMatch({ user, orgScope, filters }) {
    const match = {};

    if (user.role === 'admin') {
        if (orgScope && orgScope !== 'all') match.organization = orgScope;
    } else {
        match.organization = user.organization || (user.role === 'team_lead' ? 'luc' : undefined);
        if (!match.organization) delete match.organization;
    }

    if (filters && (filters.startDate || filters.endDate)) {
        match.date = {};
        if (filters.startDate) match.date.$gte = new Date(filters.startDate);
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            match.date.$lte = end;
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

// Mirror `hourlyController.getActivityItems`: flat shape OR `activities[]`
// array. Plan §13.3 — single source of truth for the normalizer.
function getActivityItems(doc) {
    if (Array.isArray(doc.activities) && doc.activities.length > 0) return doc.activities;
    return [
        {
            activityType: doc.activityType,
            count: doc.count,
            followupCount: doc.followupCount,
            duration: doc.duration,
        },
    ];
}

async function runRawQuery({ user, orgScope, filters, columns: _columns, cursor, limit }) {
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

    // Fetch a slightly oversized page (cap+1) so we know if there's a next.
    const docs = await HourlyActivity.find(finalMatch)
        .sort({ _id: 1 })
        .limit(cap + 1)
        .lean();

    let pageDocs = docs;
    let nextCursor = null;
    if (docs.length > cap) {
        pageDocs = docs.slice(0, cap);
        const lastId = pageDocs[pageDocs.length - 1]._id;
        nextCursor = Buffer.from(JSON.stringify({ lastId: lastId.toString() }), 'utf-8').toString('base64');
    }

    // Hydrate consultant + team for each unique consultant id in the page.
    const cIds = Array.from(new Set(pageDocs.map((d) => d.consultant?.toString()).filter(Boolean)));
    const consultants = await Consultant.find({ _id: { $in: cIds } })
        .select('_id name teamLead teamName organization')
        .lean();
    const tlIds = Array.from(new Set(consultants.map((c) => c.teamLead?.toString()).filter(Boolean)));
    const tlUsers = tlIds.length
        ? await User.find({ _id: { $in: tlIds } }).select('_id name teamName').lean()
        : [];
    const tlMap = new Map(tlUsers.map((u) => [u._id.toString(), u]));
    const cMap = new Map(
        consultants.map((c) => {
            const tl = c.teamLead ? tlMap.get(c.teamLead.toString()) : null;
            return [
                c._id.toString(),
                {
                    name: c.name,
                    teamName: c.teamName || tl?.teamName || '',
                    teamLeadId: c.teamLead?.toString() || null,
                },
            ];
        })
    );

    // For non-admin team_lead and skillhub, filter to own team's consultants.
    // Plan §11.4: team_lead × Hourly is restricted to own team — divergence
    // from the leaderboardConsultantScope hack is intentional.
    const ownTeamLeadId =
        user.role === 'team_lead' || user.role === 'skillhub'
            ? user._id?.toString()
            : null;

    const rows = [];
    for (const doc of pageDocs) {
        const cinfo = doc.consultant ? cMap.get(doc.consultant.toString()) : null;
        if (ownTeamLeadId && (!cinfo || cinfo.teamLeadId !== ownTeamLeadId)) continue;

        const items = getActivityItems(doc);
        for (const item of items) {
            rows.push({
                _id: doc._id,
                date: doc.date,
                slotId: doc.slotId,
                organization: doc.organization,
                consultantName: cinfo?.name || doc.consultantName || '',
                teamName: cinfo?.teamName || '',
                activityType: item.activityType,
                count: typeof item.count === 'number' ? item.count : 1,
                followupCount: item.followupCount || 0,
                duration: item.duration || 0,
                note: doc.note || '',
            });
        }
    }

    const totalEstimate = !cursor ? await HourlyActivity.countDocuments(match) : null;

    return { rows, nextCursor, totalEstimate };
}

async function distinctValues({ user, orgScope, dimensionKey }) {
    const dim = DIMENSIONS.find((d) => d.key === dimensionKey);
    if (!dim) return [];
    const match = buildRawMatch({ user, orgScope, filters: {} });
    const values = await HourlyActivity.distinct(dim.path, match);
    return values.filter((v) => v !== null && v !== undefined && v !== '').sort();
}

// After `normalizeHourlyActivities`, the activity-level fields live at
// `_items.*` and are projected as `activityTypeNorm` / `countNorm` /
// `durationNorm`. `slotId` and `organization` stay doc-level.
const PIVOT_PATH = {
    activityType: 'activityTypeNorm',
    slotId: 'slotId',
    organization: 'organization',
};
const MEASURE_EXPR = {
    sumCount: '$countNorm',
    duration: '$durationNorm',
};

async function runPivotQuery({ user, orgScope, filters, rowDim, colDim, measure, agg }) {
    if (!rowDim) {
        const e = new Error('rowDim is required');
        e.statusCode = 400;
        throw e;
    }
    const rowDef = DIMENSIONS.find((d) => d.key === rowDim);
    if (!rowDef) {
        const e = new Error(`rowDim '${rowDim}' is not available for hourly`);
        e.statusCode = 400;
        throw e;
    }
    const colDef = colDim ? DIMENSIONS.find((d) => d.key === colDim) : null;
    if (colDim && !colDef) {
        const e = new Error(`colDim '${colDim}' is not available for hourly`);
        e.statusCode = 400;
        throw e;
    }

    const validAggs = ['count', 'sum'];
    if (!validAggs.includes(agg)) {
        const e = new Error(`agg '${agg}' must be one of ${validAggs.join('|')}`);
        e.statusCode = 400;
        throw e;
    }

    if (agg === 'sum') {
        if (!MEASURE_EXPR[measure]) {
            const e = new Error(`measure '${measure}' is not summable for hourly`);
            e.statusCode = 400;
            throw e;
        }
    }

    const match = buildRawMatch({ user, orgScope, filters });

    // Normalize activities[] BEFORE grouping so activityType pivots count
    // each unwound activity, not each doc. Plan §13.3.
    let pipeline = [{ $match: match }];
    pipeline = normalizeHourlyActivities(pipeline);

    const rowExpr = `$${PIVOT_PATH[rowDef.key]}`;
    const colExpr = colDef ? `$${PIVOT_PATH[colDef.key]}` : null;
    const groupId = colExpr ? { row: rowExpr, col: colExpr } : { row: rowExpr };
    const acc = agg === 'count'
        ? { $sum: 1 }
        : { $sum: { $ifNull: [MEASURE_EXPR[measure], 0] } };

    pipeline.push({ $group: { _id: groupId, value: acc } });
    pipeline.push({
        $project: colExpr
            ? { _id: 0, row: '$_id.row', col: '$_id.col', value: 1 }
            : { _id: 0, row: '$_id.row', value: 1 },
    });

    const cells = await HourlyActivity.aggregate(pipeline);

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
