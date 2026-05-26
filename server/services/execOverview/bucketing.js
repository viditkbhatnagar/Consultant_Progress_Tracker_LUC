// Program bucketing for the Executive Overview / Team Detail dashboards.
//
// The Excel groups every (university, program) combination into one of 16
// buckets: 14 program buckets (counted toward Total Admissions) and 2 AGI
// buckets (tracked separately, NEVER counted toward totals).
//
// Bucket order matches the column order in the source Excel
// (DASHBOARD_changes.xlsx) so the UI can render columns identically.

const PROGRAM_BUCKETS = [
    'SSM MBA',
    'SSM BBA',
    'OTHM+MBA',
    'IOSCM+MBA',
    'KNIGHTS MBA',
    'KNIGHTS BBA',
    'MUST',
    'OTHM-7',
    'IOSCM-7',
    'OTHM-3',
    'DBA',
    'OTHM Ext L5',
    'OTHM-4,5',
    'OTHM-6',
];

const AGI_BUCKETS = ['AGI', 'AGI Standalone'];

const ALL_BUCKETS = [...PROGRAM_BUCKETS, ...AGI_BUCKETS];

const isAgiBucket = (bucket) => AGI_BUCKETS.includes(bucket);

// Lowercase normalization helper. Trims, collapses whitespace, removes the
// "diploma" word so "OTHM Diploma Level 7" and "Level 7" both reduce to
// "othm level 7".
const norm = (s) =>
    (s || '')
        .toString()
        .toLowerCase()
        .replace(/diploma/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

// Returns the bucket key for a (university, program) pair, or null when the
// row doesn't map cleanly. Callers decide whether to log/silently skip.
function bucketProgram({ university, program } = {}) {
    const u = norm(university);
    const p = norm(program);
    if (!u && !p) return null;

    // AGI — university wins. "Standalone" qualifier splits it.
    if (u.includes('agi') || u.includes('american global')) {
        return p.includes('standalone') ? 'AGI Standalone' : 'AGI';
    }

    // MUST — university wins; collapse all MUST programs into one column.
    if (u.includes('must') || u.includes('malaysia university')) {
        return 'MUST';
    }

    // IOSCM combos and standalone level 7 (check before generic Level 7).
    const isIoscm = p.includes('ioscm') || p.includes('iscm');
    if (isIoscm && p.includes('mba')) return 'IOSCM+MBA';
    if (isIoscm && p.includes('level 7')) return 'IOSCM-7';

    // OTHM + MBA combos (e.g. "OTHM L7 + MBA", "MBA OTHM Level 7").
    if (p.includes('othm') && p.includes('mba')) return 'OTHM+MBA';

    // OTHM diploma levels — most specific first.
    if (p.includes('extended l5') || p.includes('ext l5') || p.includes('extended level 5')) {
        return 'OTHM Ext L5';
    }
    if (p.includes('level 3')) return 'OTHM-3';
    if (p.includes('level 6')) return 'OTHM-6';
    if (p.includes('level 7')) return 'OTHM-7';
    if (p.includes('level 4') || p.includes('level 5')) return 'OTHM-4,5';

    // DBA — any university.
    if (p.includes('dba')) return 'DBA';

    // University × degree-type buckets for SSM and Knights.
    if (u.includes('knight')) {
        if (p.includes('mba')) return 'KNIGHTS MBA';
        if (p.includes('bba')) return 'KNIGHTS BBA';
    }
    if (u.includes('ssm') || u.includes('swiss school')) {
        if (p.includes('mba')) return 'SSM MBA';
        if (p.includes('bba')) return 'SSM BBA';
    }

    // CMBS and OTHM (university) rows that don't match a specific bucket
    // above fall back to the closest degree-type bucket so they're visible
    // somewhere instead of dropping silently.
    if (p.includes('mba')) return 'SSM MBA';
    if (p.includes('bba')) return 'SSM BBA';

    return null;
}

module.exports = {
    PROGRAM_BUCKETS,
    AGI_BUCKETS,
    ALL_BUCKETS,
    isAgiBucket,
    bucketProgram,
};
