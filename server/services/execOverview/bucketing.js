// Program bucketing for the Executive Overview / Team Detail dashboards.
//
// The Excel groups every (university, program) combination into program
// buckets: 14 counted toward Total Admissions, plus separately-tracked
// buckets (KHDA + 2 AGI) that are NEVER counted toward totals.
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

// KHDA — a separately-counted bucket like AGI: tracked in its own column but
// NEVER added to Total Admissions. Manual entry only (bucketProgram never
// classifies a student into KHDA; it's filled by hand in the team tables).
const KHDA_BUCKETS = ['KHDA'];

// Buckets excluded from Total Admissions, in display order (KHDA before AGI).
const EXCLUDED_BUCKETS = [...KHDA_BUCKETS, ...AGI_BUCKETS];

const ALL_BUCKETS = [...PROGRAM_BUCKETS, ...EXCLUDED_BUCKETS];

// Stable slugs for use as Mongoose field names + JSON keys. Several of
// the display names contain characters (space, +, comma) that don't
// play nicely as object keys, so we maintain a fixed mapping.
const BUCKET_SLUGS = {
    'SSM MBA': 'ssm_mba',
    'SSM BBA': 'ssm_bba',
    'OTHM+MBA': 'othm_mba',
    'IOSCM+MBA': 'ioscm_mba',
    'KNIGHTS MBA': 'knights_mba',
    'KNIGHTS BBA': 'knights_bba',
    'MUST': 'must',
    'OTHM-7': 'othm_7',
    'IOSCM-7': 'ioscm_7',
    'OTHM-3': 'othm_3',
    'DBA': 'dba',
    'OTHM Ext L5': 'othm_ext_l5',
    'OTHM-4,5': 'othm_4_5',
    'OTHM-6': 'othm_6',
    'KHDA': 'khda',
    'AGI': 'agi',
    'AGI Standalone': 'agi_standalone',
};
const SLUG_TO_BUCKET = Object.fromEntries(
    Object.entries(BUCKET_SLUGS).map(([k, v]) => [v, k])
);
const PROGRAM_SLUGS = PROGRAM_BUCKETS.map((b) => BUCKET_SLUGS[b]);
const AGI_SLUGS = AGI_BUCKETS.map((b) => BUCKET_SLUGS[b]);
const KHDA_SLUGS = KHDA_BUCKETS.map((b) => BUCKET_SLUGS[b]);
const EXCLUDED_SLUGS = [...KHDA_SLUGS, ...AGI_SLUGS];
const ALL_SLUGS = [...PROGRAM_SLUGS, ...EXCLUDED_SLUGS];

const bucketToSlug = (bucket) => BUCKET_SLUGS[bucket] || null;
const slugToBucket = (slug) => SLUG_TO_BUCKET[slug] || null;

const isAgiBucket = (bucket) => AGI_BUCKETS.includes(bucket);
const isAgiSlug = (slug) => AGI_SLUGS.includes(slug);
const isKhdaBucket = (bucket) => KHDA_BUCKETS.includes(bucket);
const isKhdaSlug = (slug) => KHDA_SLUGS.includes(slug);
// "Excluded" = tracked separately, never summed into Total Admissions (KHDA + AGI).
const isExcludedBucket = (bucket) => EXCLUDED_BUCKETS.includes(bucket);
const isExcludedSlug = (slug) => EXCLUDED_SLUGS.includes(slug);

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
    KHDA_BUCKETS,
    EXCLUDED_BUCKETS,
    ALL_BUCKETS,
    BUCKET_SLUGS,
    PROGRAM_SLUGS,
    AGI_SLUGS,
    KHDA_SLUGS,
    EXCLUDED_SLUGS,
    ALL_SLUGS,
    bucketToSlug,
    slugToBucket,
    isAgiBucket,
    isAgiSlug,
    isKhdaBucket,
    isKhdaSlug,
    isExcludedBucket,
    isExcludedSlug,
    bucketProgram,
};
