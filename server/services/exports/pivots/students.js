const mongoose = require('mongoose');
const Student = require('../../../models/Student');
const { applyHideLucZeroFeeFilter } = require('../../../controllers/studentController');
const {
    withSkillhubFinancials,
    bucketDate,
    buildAccumulator,
} = require('./_shared');

const LUC_DIMENSIONS = [
    { key: 'source',          lbl: 'Source',            kind: 'distinct', path: 'source' },
    { key: 'university',      lbl: 'University',        kind: 'distinct', path: 'university' },
    { key: 'program',         lbl: 'Program',           kind: 'distinct', path: 'program' },
    { key: 'teamLeadName',    lbl: 'Team Lead',         kind: 'distinct', path: 'teamLeadName' },
    { key: 'teamName',        lbl: 'Team',              kind: 'distinct', path: 'teamName' },
    { key: 'consultantName',  lbl: 'Consultant',        kind: 'distinct', path: 'consultantName' },
    { key: 'month',           lbl: 'Month',             kind: 'distinct', path: 'month' },
    { key: 'gender',          lbl: 'Gender',            kind: 'distinct', path: 'gender' },
    { key: 'nationality',     lbl: 'Nationality',       kind: 'distinct', path: 'nationality' },
    { key: 'region',          lbl: 'Region',            kind: 'distinct', path: 'region' },
    { key: 'campaignName',    lbl: 'Campaign',          kind: 'distinct', path: 'campaignName' },
    { key: 'openDay',         lbl: 'Open Day',          kind: 'distinct', path: 'openDay' },
    { key: 'openDayLocation', lbl: 'Open Day Location', kind: 'distinct', path: 'openDayLocation' },
    { key: 'referredBy',      lbl: 'Referred By',       kind: 'distinct', path: 'referredBy' },
    // Derived bucket dim for the conversion-time funnel template.
    {
        key: 'conversionBucket',
        lbl: 'Conversion bucket',
        kind: 'derived',
        expr: {
            $switch: {
                branches: [
                    { case: { $eq: [{ $ifNull: ['$conversionTime', null] }, null] }, then: '(unknown)' },
                    { case: { $lte: ['$conversionTime', 7] },  then: '≤7 days' },
                    { case: { $lte: ['$conversionTime', 30] }, then: '8-30 days' },
                ],
                default: '>30 days',
            },
        },
    },
    {
        key: 'closingDateMonth',
        lbl: 'Closing month',
        kind: 'bucket',
        expr: bucketDate('closingDate', 'month'),
    },
    {
        key: 'closingDateQuarter',
        lbl: 'Closing quarter',
        kind: 'bucket',
        expr: bucketDate('closingDate', 'quarter'),
    },
];

const SKILLHUB_DIMENSIONS = [
    { key: 'curriculum',      lbl: 'Curriculum',        kind: 'distinct', path: 'curriculum' },
    { key: 'curriculumSlug',  lbl: 'Curriculum Slug',   kind: 'distinct', path: 'curriculumSlug' },
    { key: 'yearOrGrade',     lbl: 'Year/Grade',        kind: 'distinct', path: 'yearOrGrade' },
    { key: 'academicYear',    lbl: 'Academic Year',     kind: 'distinct', path: 'academicYear' },
    { key: 'mode',            lbl: 'Mode',              kind: 'distinct', path: 'mode' },
    { key: 'courseDuration',  lbl: 'Course Duration',   kind: 'distinct', path: 'courseDuration' },
    { key: 'school',          lbl: 'School',            kind: 'distinct', path: 'school' },
    { key: 'leadSource',      lbl: 'Lead Source',       kind: 'distinct', path: 'leadSource' },
    { key: 'studentStatus',   lbl: 'Status',            kind: 'distinct', path: 'studentStatus' },
    { key: 'organization',    lbl: 'Branch',            kind: 'distinct', path: 'organization' },
    { key: 'consultantName',  lbl: 'Consultant',        kind: 'distinct', path: 'consultantName' },
    { key: 'gender',          lbl: 'Gender',            kind: 'distinct', path: 'gender' },
    { key: 'addressEmirate',  lbl: 'Address Emirate',   kind: 'distinct', path: 'addressEmirate' },
    // Pivot-only: each subject in `subjects[]` is a row of its own (plan §4).
    // Non-distinct measures count enrolled subjects, not students.
    { key: 'subjects',        lbl: 'Subject',           kind: 'unwind',   path: 'subjects' },
];

const ALL_DIMENSIONS = [
    { key: 'organization',    lbl: 'Organization',      kind: 'distinct', path: 'organization' },
    { key: 'consultantName',  lbl: 'Consultant',        kind: 'distinct', path: 'consultantName' },
    { key: 'gender',          lbl: 'Gender',            kind: 'distinct', path: 'gender' },
    // Cross-org date buckets — use createdAt since closingDate is LUC-only required.
    {
        key: 'createdAtMonth',
        lbl: 'Month (created)',
        kind: 'bucket',
        expr: bucketDate('createdAt', 'month'),
    },
    {
        key: 'createdAtQuarter',
        lbl: 'Quarter (created)',
        kind: 'bucket',
        expr: bucketDate('createdAt', 'quarter'),
    },
];

const ALL_MEASURES = [
    { key: 'count',            lbl: 'Count',                         default: true },
    { key: 'courseFee',        lbl: 'Sum Course Fee (AED)',          money: true },
    { key: 'admissionFeePaid', lbl: 'Sum Admission Fee Paid (AED)',  money: true },
];

const LUC_MEASURES = [
    { key: 'count',            lbl: 'Count of admissions',           default: true },
    { key: 'courseFee',        lbl: 'Sum Course Fee (AED)',          money: true },
    { key: 'admissionFeePaid', lbl: 'Sum Admission Fee Paid (AED)',  money: true },
    { key: 'conversionTime',   lbl: 'Avg Conversion Time (days)' },
];

const SKILLHUB_MEASURES = [
    { key: 'count',                 lbl: 'Count',                                    default: true },
    { key: 'courseFee',             lbl: 'Sum Course Fee (AED)',          money: true },
    { key: 'admissionFeePaid',      lbl: 'Sum Admission Fee Paid (AED)',  money: true },
    { key: 'registrationFee',       lbl: 'Sum Registration Fee (AED)',    money: true },
    { key: 'emiPaid',               lbl: 'Sum EMI Paid (AED)',            money: true },
    { key: 'outstandingPerStudent', lbl: 'Sum Outstanding (AED)',         money: true },
    { key: 'overdueEmiCount',       lbl: 'Sum Overdue EMI Count' },
];

function dimensionCatalog(orgScope) {
    if (orgScope === 'luc') return LUC_DIMENSIONS;
    if (orgScope === 'skillhub_training' || orgScope === 'skillhub_institute') return SKILLHUB_DIMENSIONS;
    if (orgScope === 'all') return ALL_DIMENSIONS;
    return [];
}

function measureCatalog(orgScope) {
    if (orgScope === 'luc') return LUC_MEASURES;
    if (orgScope === 'skillhub_training' || orgScope === 'skillhub_institute') return SKILLHUB_MEASURES;
    if (orgScope === 'all') return ALL_MEASURES;
    return [];
}

// Resolve effective org scope from user role + body.organization.
// Manager Export Center exception: manager can set body.organization to any
// of the four values ('luc', 'skillhub_training', 'skillhub_institute', 'all').
// See plan §6.
function resolveOrgScope(user, bodyOrganization) {
    if (user.role === 'admin' || user.role === 'manager') {
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
    const match = {};

    if (user.role === 'admin' || user.role === 'manager') {
        if (orgScope && orgScope !== 'all') match.organization = orgScope;
    } else if (user.role === 'team_lead') {
        match.organization = 'luc';
        match.teamLead = user._id;
    } else if (user.role === 'skillhub') {
        match.organization = user.organization;
        match.teamLead = user._id;
    }

    const dateField = orgScope === 'luc' ? 'closingDate' : 'createdAt';
    if (filters && (filters.startDate || filters.endDate)) {
        match[dateField] = {};
        if (filters.startDate) match[dateField].$gte = new Date(filters.startDate);
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23, 59, 59, 999);
            match[dateField].$lte = end;
        }
    }

    if (orgScope === 'luc' || orgScope === 'all') {
        applyHideLucZeroFeeFilter(match);
    }

    const catalog = dimensionCatalog(orgScope);
    if (filters && typeof filters === 'object') {
        for (const dim of catalog) {
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
            // fall through with empty cursorMatch
        }
    }

    const finalMatch = { ...match, ...cursorMatch };
    const cap = Math.min(Math.max(parseInt(limit, 10) || 1000, 1), 5000);

    let projection;
    if (Array.isArray(columns) && columns.length > 0) {
        projection = { _id: 1, organization: 1 };
        for (const key of columns) projection[key.split('.')[0]] = 1;
        if (columns.includes('outstandingAmount')) {
            projection.courseFee = 1;
            projection.admissionFeePaid = 1;
            projection.registrationFee = 1;
            projection.emis = 1;
        }
    }

    const query = Student.find(finalMatch);
    if (projection) query.select(projection);
    const rows = await query.sort({ _id: 1 }).limit(cap + 1).lean();

    let nextCursor = null;
    let pageRows = rows;
    if (rows.length > cap) {
        pageRows = rows.slice(0, cap);
        const lastId = pageRows[pageRows.length - 1]._id;
        nextCursor = Buffer.from(JSON.stringify({ lastId: lastId.toString() }), 'utf-8').toString('base64');
    }

    // Compute Skillhub-derived fields per row:
    //   - outstandingAmount (virtual, used by skillhub_outstanding_by_counselor)
    //   - overdueEmiCount   (used by skillhub_overdue_emis)
    // Mongoose .lean() strips virtuals; doing it client-side keeps the raw
    // pipeline simple. Filtering on overdueEmiCount happens AFTER the fetch
    // because the field doesn't exist in storage.
    const now = Date.now();
    for (const r of pageRows) {
        if (r.organization === 'skillhub_training' || r.organization === 'skillhub_institute') {
            const emiPaid = Array.isArray(r.emis)
                ? r.emis.reduce((s, e) => s + (Number(e?.paidAmount) || 0), 0)
                : 0;
            const totalPaid = (Number(r.admissionFeePaid) || 0) + (Number(r.registrationFee) || 0) + emiPaid;
            r.outstandingAmount = Math.max(0, (Number(r.courseFee) || 0) - totalPaid);
            r.overdueEmiCount = Array.isArray(r.emis)
                ? r.emis.reduce((c, e) => {
                      if (!e || !e.dueDate) return c;
                      if (e.paidOn) return c;
                      const due = e.dueDate instanceof Date ? e.dueDate : new Date(e.dueDate);
                      if (Number.isNaN(due.getTime())) return c;
                      return due.getTime() < now ? c + 1 : c;
                  }, 0)
                : 0;
        }
    }

    // Post-fetch filter for the skillhub_overdue_emis template. Filtering
    // here (not in $match) because overdueEmiCount is a derived field.
    let filteredRows = pageRows;
    if (filters && filters.overdueOnly) {
        filteredRows = pageRows.filter((r) => (r.overdueEmiCount || 0) > 0);
    }

    const totalEstimate = !cursor
        ? (filters && filters.overdueOnly ? filteredRows.length : await Student.countDocuments(match))
        : null;

    return { rows: filteredRows, nextCursor, totalEstimate };
}

async function distinctValues({ user, orgScope, dimensionKey }) {
    const dim = dimensionCatalog(orgScope).find((d) => d.key === dimensionKey);
    if (!dim) return [];
    const match = buildRawMatch({ user, orgScope, filters: {} });
    const values = await Student.distinct(dim.path, match);
    return values.filter((v) => v !== null && v !== undefined && v !== '').sort();
}

// ─── Pivot ────────────────────────────────────────────────────────────────
// Resolve a dim from the catalog. For `'all'` orgScope, dims must exist in
// both LUC and Skillhub variants — otherwise the controller returns 400.
function resolveDim(orgScope, dimKey) {
    if (!dimKey) return null;
    const cat = dimensionCatalog(orgScope);
    return cat.find((d) => d.key === dimKey) || null;
}

function isSkillhubScope(orgScope) {
    return orgScope === 'skillhub_training' || orgScope === 'skillhub_institute';
}

// Build the field expression to use as the GROUP key for a dimension.
// Distinct + unwind dimensions just reference the field. Bucket dims would
// pre-derive via $addFields (none in v1 catalog — extend here when adding).
// Resolve the group-key expression for a dim. Derived/bucket dims emit an
// `$addFields` entry so the caller can splice it into the pipeline before
// `$group`.
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
    const rowDef = resolveDim(orgScope, rowDim);
    if (!rowDef) {
        const e = new Error(`rowDim '${rowDim}' is not available for orgScope '${orgScope}'`);
        e.statusCode = 400;
        throw e;
    }
    const colDef = colDim ? resolveDim(orgScope, colDim) : null;
    if (colDim && !colDef) {
        const e = new Error(`colDim '${colDim}' is not available for orgScope '${orgScope}'`);
        e.statusCode = 400;
        throw e;
    }

    // Allowed agg list. distinct is a first-class option (plan §4).
    const validAggs = ['count', 'sum', 'avg', 'min', 'max', 'distinct'];
    if (!validAggs.includes(agg)) {
        const e = new Error(`agg '${agg}' must be one of ${validAggs.join('|')}`);
        e.statusCode = 400;
        throw e;
    }

    // Validate measure for non-count/distinct aggs.
    let measurePath = null;
    if (agg !== 'count' && agg !== 'distinct') {
        const measures = measureCatalog(orgScope);
        const measureDef = measures.find((m) => m.key === measure);
        if (!measureDef) {
            const e = new Error(`measure '${measure}' is not available for orgScope '${orgScope}'`);
            e.statusCode = 400;
            throw e;
        }
        // Some measures are paths on the doc; emiPaid / outstandingPerStudent /
        // overdueEmiCount are derived via withSkillhubFinancials. Path equals
        // the measure key in both cases.
        measurePath = measure;
    }

    const match = buildRawMatch({ user, orgScope, filters });

    let pipeline = [{ $match: match }];

    // Skillhub financials must precede $group whenever the measure is one
    // of the derived fields, OR when the orgScope is Skillhub/all (so the
    // outstanding/emiPaid measures are valid choices).
    if (isSkillhubScope(orgScope) || orgScope === 'all') {
        pipeline = withSkillhubFinancials(pipeline);
    }

    // Subjects unwind — only when row or col dim is `subjects`.
    if (rowDef.kind === 'unwind') {
        pipeline.push({ $unwind: { path: `$${rowDef.path}`, preserveNullAndEmptyArrays: false } });
    }
    if (colDef && colDef.kind === 'unwind' && colDef.key !== rowDef.key) {
        pipeline.push({ $unwind: { path: `$${colDef.path}`, preserveNullAndEmptyArrays: false } });
    }

    // Derived / bucket dims project their expression to a temp field BEFORE
    // $group so the group key references a single path, not an inline expr.
    const dimAdds = {};
    const rowExpr = resolveDimGroupExpr(rowDef, '__rowKey', dimAdds);
    const colExpr = colDef ? resolveDimGroupExpr(colDef, '__colKey', dimAdds) : null;
    if (Object.keys(dimAdds).length > 0) {
        pipeline.push({ $addFields: dimAdds });
    }
    const groupId = colExpr ? { row: rowExpr, col: colExpr } : { row: rowExpr };

    if (agg === 'distinct') {
        pipeline.push({ $group: { _id: groupId, studentSet: { $addToSet: '$_id' } } });
        const project = colExpr
            ? { _id: 0, row: '$_id.row', col: '$_id.col', value: { $size: '$studentSet' } }
            : { _id: 0, row: '$_id.row', value: { $size: '$studentSet' } };
        pipeline.push({ $project: project });
    } else {
        const acc = buildAccumulator(measurePath, agg);
        pipeline.push({ $group: { _id: groupId, value: acc } });
        const project = colExpr
            ? { _id: 0, row: '$_id.row', col: '$_id.col', value: 1 }
            : { _id: 0, row: '$_id.row', value: 1 };
        pipeline.push({ $project: project });
    }

    const cells = await Student.aggregate(pipeline);

    // Compute totals client-side from the cell list. Cheaper than running
    // two more aggregations.
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
        // Normalize back to strings for the wire shape so the client doesn't
        // have to coerce.
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
    LUC_DIMENSIONS,
    SKILLHUB_DIMENSIONS,
    LUC_MEASURES,
    SKILLHUB_MEASURES,
};
