// Canonical subject list for the Skillhub Institute.
//
// Subjects used to be pure free text: every dropdown was built from
// `distinct('subject')` across attendance / timetable / test rows, so whatever
// the Excel import or a typed-in value contained became an option. That drifted
// into duplicates ("Math" vs "Maths", "Accountancy" vs "Accounting",
// "Business Studies" vs "Business studies", "biology") plus a retired subject
// (CHRM) and blank strings.
//
// This module is the single source of truth. The meta endpoints serve this list
// (never raw DB values), the entry forms pick from it, and
// scripts/normalizeInstituteSubjects.js rewrites historical rows onto it.
const INSTITUTE_SUBJECTS = [
    'Accountancy',
    'Biology',
    'Business Studies',
    'Chemistry',
    'Economics',
    'English',
    'IELTS',
    'Math',
    'Physics',
    'Science',
];

// Subjects the branch has discontinued. Kept here (rather than just deleted) so
// the meta endpoints can actively filter them out of the pickers even while
// historical rows still reference them.
const RETIRED_INSTITUTE_SUBJECTS = ['CHRM'];

// Legacy spellings → canonical. Keys are lower-cased and whitespace-collapsed.
// Anything that only differs by case/spacing is handled generically below, so
// this map only needs genuinely different words.
const SUBJECT_ALIASES = {
    maths: 'Math',
    mathematics: 'Math',
    accounting: 'Accountancy',
    accounts: 'Accountancy',
    'business study': 'Business Studies',
    bio: 'Biology',
    phy: 'Physics',
    chem: 'Chemistry',
    eco: 'Economics',
    eng: 'English',
};

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Map any historical/typed value onto the canonical spelling.
// Returns '' for blanks and null for values we don't recognise (callers decide
// whether to keep the original or drop it) — retired subjects map to null too.
function canonicalizeSubject(value) {
    const n = norm(value);
    if (!n) return '';
    const exact = INSTITUTE_SUBJECTS.find((s) => norm(s) === n);
    if (exact) return exact;
    if (SUBJECT_ALIASES[n]) return SUBJECT_ALIASES[n];
    return null;
}

// Every spelling that means `value`: the canonical name plus any aliases that
// resolve to it. Used to build a query condition so a filter keeps matching
// historical rows whether or not the normalisation script has been run.
function subjectVariants(value) {
    const canonical = canonicalizeSubject(value);
    if (!canonical) return null;
    const variants = new Set([canonical]);
    for (const [alias, target] of Object.entries(SUBJECT_ALIASES)) {
        if (target === canonical) variants.add(alias);
    }
    return [...variants];
}

// Mongo condition for "subject is `value`", tolerant of case and legacy
// spellings — selecting "Math" still matches rows stored as "Maths"/"maths".
// Unknown values fall back to an exact match so nothing is over-matched.
function subjectMatchCondition(value) {
    const variants = subjectVariants(value);
    if (!variants) return value;
    const escaped = variants.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { $regex: `^(${escaped.join('|')})$`, $options: 'i' };
}

// The list the pickers should show: canonical only, retired removed, sorted.
function subjectOptions() {
    const retired = new Set(RETIRED_INSTITUTE_SUBJECTS.map(norm));
    return INSTITUTE_SUBJECTS.filter((s) => !retired.has(norm(s)))
        .slice()
        .sort((a, b) => a.localeCompare(b));
}

module.exports = {
    INSTITUTE_SUBJECTS,
    RETIRED_INSTITUTE_SUBJECTS,
    SUBJECT_ALIASES,
    canonicalizeSubject,
    subjectVariants,
    subjectMatchCondition,
    subjectOptions,
};
