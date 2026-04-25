// Shared helpers for pivot builders. Plan §3 + §4.

// Skillhub financials — appended to every Skillhub pipeline so the
// `outstandingAmount` virtual is computable during $group. Mirrors the exact
// shape from `studentController.getStudentStats:709–770`.
function withSkillhubFinancials(pipeline) {
    return [
        ...pipeline,
        {
            $addFields: {
                emiPaid: {
                    $sum: {
                        $map: {
                            input: { $ifNull: ['$emis', []] },
                            as: 'e',
                            in: { $ifNull: ['$$e.paidAmount', 0] },
                        },
                    },
                },
            },
        },
        {
            $addFields: {
                totalPaidPerStudent: {
                    $add: [
                        { $ifNull: ['$admissionFeePaid', 0] },
                        { $ifNull: ['$registrationFee', 0] },
                        '$emiPaid',
                    ],
                },
            },
        },
        {
            $addFields: {
                outstandingPerStudent: {
                    $max: [
                        0,
                        { $subtract: [{ $ifNull: ['$courseFee', 0] }, '$totalPaidPerStudent'] },
                    ],
                },
            },
        },
        {
            $addFields: {
                overdueEmiCount: {
                    $size: {
                        $filter: {
                            input: { $ifNull: ['$emis', []] },
                            as: 'e',
                            cond: {
                                $and: [
                                    { $lt: ['$$e.dueDate', '$$NOW'] },
                                    {
                                        $or: [
                                            { $eq: ['$$e.paidOn', null] },
                                            { $not: '$$e.paidOn' },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            },
        },
    ];
}

// HourlyActivity flat-vs-array normalizer. Plan §13.3 — single source of
// truth, mirrors `hourlyController.getActivityItems:88–103`.
function normalizeHourlyActivities(pipeline) {
    return [
        ...pipeline,
        {
            $addFields: {
                _items: {
                    $cond: [
                        { $gt: [{ $size: { $ifNull: ['$activities', []] } }, 0] },
                        '$activities',
                        [
                            {
                                activityType: '$activityType',
                                count: '$count',
                                followupCount: '$followupCount',
                                duration: '$duration',
                            },
                        ],
                    ],
                },
            },
        },
        { $unwind: '$_items' },
        {
            $addFields: {
                activityTypeNorm: '$_items.activityType',
                countNorm: { $ifNull: ['$_items.count', 1] },
                followupCountNorm: { $ifNull: ['$_items.followupCount', 0] },
                durationNorm: { $ifNull: ['$_items.duration', 0] },
            },
        },
    ];
}

// Build a `$dateToString` expression for a date field at a given bucket
// granularity. Returns the format string and the expression to use in
// `$addFields`. Granularity values: 'day' | 'week' | 'month' | 'quarter' | 'year'.
function bucketDate(fieldPath, granularity) {
    const field = fieldPath.startsWith('$') ? fieldPath : `$${fieldPath}`;
    switch (granularity) {
        case 'day':
            return { $dateToString: { format: '%Y-%m-%d', date: field } };
        case 'week':
            // ISO week — `%G-W%V` matches `date-fns weekStartsOn:1` semantics
            // closely enough for week buckets. Project convention.
            return { $dateToString: { format: '%G-W%V', date: field } };
        case 'month':
            return { $dateToString: { format: '%Y-%m', date: field } };
        case 'quarter':
            return {
                $concat: [
                    { $dateToString: { format: '%Y', date: field } },
                    '-Q',
                    {
                        $toString: {
                            $ceil: { $divide: [{ $month: field }, 3] },
                        },
                    },
                ],
            };
        case 'year':
            return { $dateToString: { format: '%Y', date: field } };
        default:
            return field;
    }
}

// Build a `$group` accumulator expression for the requested measure + agg.
// Returns { stage: aggExpression, projection?: aliasShape } the caller
// composes into its $group + $project.
function buildAccumulator(measurePath, agg) {
    if (agg === 'count') return { $sum: 1 };
    if (agg === 'sum')   return { $sum: { $ifNull: [`$${measurePath}`, 0] } };
    if (agg === 'avg')   return { $avg: `$${measurePath}` };
    if (agg === 'min')   return { $min: `$${measurePath}` };
    if (agg === 'max')   return { $max: `$${measurePath}` };
    // 'distinct' is handled separately by `distinctStudentsMeasure` because
    // it uses $addToSet + $size, not a single accumulator.
    return null;
}

// Compose a "distinct students" $group + $project that returns true unique
// student counts even on subject-unwound pipelines. Plan §4 dataset 2.
function distinctStudentsMeasure(rowExpr, colExpr) {
    const groupId = colExpr ? { row: rowExpr, col: colExpr } : { row: rowExpr };
    return [
        { $group: { _id: groupId, studentSet: { $addToSet: '$_id' } } },
        {
            $project: {
                _id: 0,
                row: '$_id.row',
                col: colExpr ? '$_id.col' : undefined,
                value: { $size: '$studentSet' },
            },
        },
    ];
}

module.exports = {
    withSkillhubFinancials,
    normalizeHourlyActivities,
    bucketDate,
    buildAccumulator,
    distinctStudentsMeasure,
};
