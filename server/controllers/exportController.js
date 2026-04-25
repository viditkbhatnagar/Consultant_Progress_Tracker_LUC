const studentsBuilder = require('../services/exports/pivots/students');
const commitmentsBuilder = require('../services/exports/pivots/commitments');
const meetingsBuilder = require('../services/exports/pivots/meetings');
const hourlyBuilder = require('../services/exports/pivots/hourly');
const templatesRegistry = require('../services/exports/templates');
const SavedExportTemplate = require('../models/SavedExportTemplate');

const VALID_DATASETS = ['students', 'commitments', 'meetings', 'hourly'];
const VALID_ORGS = ['luc', 'skillhub_training', 'skillhub_institute', 'all'];

// Permission matrix — see plan §6. Manager Export Center exception lives
// here: manager is granted on `students` only, including cross-org.
function assertDatasetAccess(user, dataset, organization) {
    const m = {
        students:    ['admin', 'team_lead', 'manager', 'skillhub'],
        commitments: ['admin', 'team_lead', 'skillhub'],
        meetings:    ['admin', 'team_lead'],
        hourly:      ['admin', 'team_lead', 'skillhub'],
    };
    if (!m[dataset] || !m[dataset].includes(user.role)) {
        const err = new Error(`Role '${user.role}' cannot access dataset '${dataset}'`);
        err.statusCode = 403;
        throw err;
    }
    if (user.role === 'team_lead' && organization && organization !== 'luc') {
        const err = new Error("team_lead is locked to LUC");
        err.statusCode = 403;
        throw err;
    }
    if (user.role === 'manager' && dataset !== 'students') {
        const err = new Error('Manager Export Center is restricted to the students dataset');
        err.statusCode = 403;
        throw err;
    }
    if (user.role === 'skillhub' && organization && organization !== user.organization && organization !== 'all') {
        // skillhub locked to own branch; 'all' rejected below
        const err = new Error('Skillhub user can only export own branch');
        err.statusCode = 403;
        throw err;
    }
    if (organization === 'all' && !['admin', 'manager'].includes(user.role)) {
        const err = new Error("'all' organization is admin/manager only");
        err.statusCode = 403;
        throw err;
    }
    if (organization && !VALID_ORGS.includes(organization)) {
        const err = new Error(`Invalid organization '${organization}'`);
        err.statusCode = 400;
        throw err;
    }
}

function getBuilder(dataset) {
    if (dataset === 'students')    return studentsBuilder;
    if (dataset === 'commitments') return commitmentsBuilder;
    if (dataset === 'meetings')    return meetingsBuilder;
    if (dataset === 'hourly')      return hourlyBuilder;
    return null;
}

// POST /api/exports/raw
exports.getRaw = async (req, res, next) => {
    try {
        const { dataset, filters, columns, organization, cursor, limit } = req.body || {};

        if (!dataset || !VALID_DATASETS.includes(dataset)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing dataset' });
        }

        assertDatasetAccess(req.user, dataset, organization);

        const builder = getBuilder(dataset);
        if (!builder) {
            return res.status(501).json({
                success: false,
                message: `Dataset '${dataset}' raw export is not yet implemented`,
            });
        }

        const orgScope = builder.resolveOrgScope(req.user, organization);
        const { rows, nextCursor, totalEstimate } = await builder.runRawQuery({
            user: req.user,
            orgScope,
            filters: filters || {},
            columns,
            cursor,
            limit,
        });

        return res.json({
            success: true,
            rows,
            nextCursor,
            totalEstimate,
            scopeNote: orgScope === 'all' ? 'Cross-org (all)' : `Scoped to ${orgScope}`,
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        return next(err);
    }
};

// GET /api/exports/dimensions/:dataset?organization=luc
exports.getDimensions = async (req, res, next) => {
    try {
        const { dataset } = req.params;
        const organization = req.query.organization;

        if (!dataset || !VALID_DATASETS.includes(dataset)) {
            return res.status(400).json({ success: false, message: 'Invalid dataset' });
        }

        assertDatasetAccess(req.user, dataset, organization);

        const builder = getBuilder(dataset);
        if (!builder) {
            return res.status(501).json({
                success: false,
                message: `Dataset '${dataset}' dimensions are not yet implemented`,
            });
        }

        const orgScope = builder.resolveOrgScope(req.user, organization);
        const dims = builder.dimensionCatalog(orgScope);
        const measures = builder.measureCatalog(orgScope);

        // Resolve distinct values for distinct-kind dimensions, scoped by user.
        const dimensions = [];
        for (const dim of dims) {
            if (dim.kind === 'distinct') {
                const values = await builder.distinctValues({
                    user: req.user,
                    orgScope,
                    dimensionKey: dim.key,
                });
                dimensions.push({ key: dim.key, lbl: dim.lbl, kind: 'distinct', values });
            } else {
                dimensions.push({ key: dim.key, lbl: dim.lbl, kind: dim.kind });
            }
        }

        return res.json({ success: true, dataset, orgScope, dimensions, measures });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        return next(err);
    }
};

// POST /api/exports/pivot
exports.getPivot = async (req, res, next) => {
    try {
        const { dataset, filters, rowDim, colDim, measure, agg, organization } = req.body || {};

        if (!dataset || !VALID_DATASETS.includes(dataset)) {
            return res.status(400).json({ success: false, message: 'Invalid or missing dataset' });
        }

        assertDatasetAccess(req.user, dataset, organization);

        const builder = getBuilder(dataset);
        if (!builder || typeof builder.runPivotQuery !== 'function') {
            return res.status(501).json({
                success: false,
                message: `Pivot for dataset '${dataset}' lands later in Phase 2`,
            });
        }

        const orgScope = builder.resolveOrgScope(req.user, organization);
        const result = await builder.runPivotQuery({
            user: req.user,
            orgScope,
            filters: filters || {},
            rowDim,
            colDim,
            measure,
            agg,
        });

        return res.json({
            success: true,
            ...result,
            scopeNote: orgScope === 'all' ? 'Cross-org (all)' : `Scoped to ${orgScope}`,
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        return next(err);
    }
};
// ─── Templates ────────────────────────────────────────────────────────

// GET /api/exports/templates — pre-built catalog visible to current role.
exports.listTemplates = async (req, res, next) => {
    try {
        const list = templatesRegistry.listForRole(req.user).map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            dataset: t.dataset,
            organization: t.organization,
            sheets: t.sheets.length,
        }));
        return res.json({ success: true, templates: list });
    } catch (err) {
        return next(err);
    }
};

// POST /api/exports/template/:templateId  — body: { filters?, organization? }
exports.runTemplate = async (req, res, next) => {
    try {
        const tpl = templatesRegistry.findById(req.params.templateId);
        if (!tpl) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        if (!tpl.roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Template not available for your role' });
        }

        const dataset = tpl.dataset;
        const organization = req.body?.organization || tpl.organization;
        assertDatasetAccess(req.user, dataset, organization);

        const builder = getBuilder(dataset);
        if (!builder) {
            return res.status(501).json({ success: false, message: `Dataset '${dataset}' not implemented` });
        }
        const orgScope = builder.resolveOrgScope(req.user, organization);

        const baseFilters = { ...(tpl.defaultFilters || {}), ...(req.body?.filters || {}) };
        if (tpl.defaultDateRange === 'last_30_days' && !baseFilters.startDate) {
            const start = new Date();
            start.setDate(start.getDate() - 30);
            baseFilters.startDate = start.toISOString().slice(0, 10);
        }

        const sheets = [];
        for (const sheet of tpl.sheets) {
            const sheetFilters = { ...baseFilters, ...(sheet.filters || {}) };
            if (sheet.kind === 'raw') {
                if (typeof builder.runRawQuery !== 'function') {
                    return res.status(501).json({ success: false, message: 'Raw sheet not supported for dataset' });
                }
                const { rows, totalEstimate } = await builder.runRawQuery({
                    user: req.user, orgScope, filters: sheetFilters,
                    columns: sheet.columns, cursor: undefined, limit: 5000,
                });
                sheets.push({ name: sheet.name, kind: 'raw', rows, totalEstimate: totalEstimate ?? rows.length });
            } else if (sheet.kind === 'pivot') {
                if (typeof builder.runPivotQuery !== 'function') {
                    return res.status(501).json({ success: false, message: 'Pivot sheet not supported for dataset' });
                }
                const result = await builder.runPivotQuery({
                    user: req.user, orgScope, filters: sheetFilters,
                    rowDim: sheet.rowDim, colDim: sheet.colDim,
                    measure: sheet.measure, agg: sheet.agg,
                });
                sheets.push({
                    name: sheet.name, kind: 'pivot',
                    rowDim: sheet.rowDim, colDim: sheet.colDim,
                    measure: sheet.measure, agg: sheet.agg,
                    ...result,
                });
            } else {
                return res.status(500).json({ success: false, message: `Unknown sheet kind '${sheet.kind}'` });
            }
        }

        return res.json({
            success: true,
            templateId: tpl.id,
            name: tpl.name,
            dataset,
            organization,
            orgScope,
            sheets,
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        return next(err);
    }
};

// ─── Saved templates (server-side persistence — plan §11) ─────────────

exports.listSavedTemplates = async (req, res, next) => {
    try {
        const docs = await SavedExportTemplate.find({ user: req.user._id })
            .sort({ updatedAt: -1 })
            .lean();
        return res.json({ success: true, templates: docs });
    } catch (err) {
        return next(err);
    }
};

exports.createSavedTemplate = async (req, res, next) => {
    try {
        const { name, dataset, config, organization } = req.body || {};
        if (!name || !dataset || !VALID_DATASETS.includes(dataset)) {
            return res.status(400).json({ success: false, message: 'Missing or invalid name/dataset' });
        }
        if (organization && !VALID_ORGS.includes(organization)) {
            return res.status(400).json({ success: false, message: 'Invalid organization' });
        }
        const existingCount = await SavedExportTemplate.countDocuments({ user: req.user._id });
        if (existingCount >= 200) {
            return res.status(429).json({
                success: false,
                message: 'Saved-template limit reached (200) — delete some before saving more',
            });
        }
        const doc = await SavedExportTemplate.create({
            user: req.user._id,
            name: name.trim(),
            dataset,
            config: config || {},
            organization: organization || 'luc',
        });
        return res.status(201).json({ success: true, template: doc });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ success: false, message: 'A saved template with that name already exists' });
        }
        return next(err);
    }
};

exports.deleteSavedTemplate = async (req, res, next) => {
    try {
        const doc = await SavedExportTemplate.findOne({ _id: req.params.id, user: req.user._id });
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Saved template not found' });
        }
        await doc.deleteOne();
        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
};

exports.assertDatasetAccess = assertDatasetAccess;
