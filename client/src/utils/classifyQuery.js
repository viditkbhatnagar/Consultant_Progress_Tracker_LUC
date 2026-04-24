// Client-side router classifier for the unified chat drawer (spec §9).
// Returns 'tracker' | 'docs' | 'ambiguous'. Pure function — no network.
//
// Strategy: two keyword regexes + the Phase 2 program alias list.
//   - Strict tracker signal AND no docs signal → tracker.
//   - Strict docs signal AND no tracker signal → docs.
//   - Both or neither → ambiguous (caller defaults to docs for LUC users
//     per spec step A).
//
// Keep this list in sync with the backend retrieval corpus as new terms
// surface. If a query genuinely spans both (e.g. "how many students asked
// about Ofqual last week?"), the ambiguous path + docs default is fine —
// the docs answer is the more interesting one for a consultant.

const TRACKER_RE =
    /\b(meeting|commitment|lead stage|consultant|admission|weekly|this week|team lead|student|hourly|enrollment|pipeline|follow[\s-]?up|revenue|target|attendance|conversion)\b/i;

const DOCS_RE =
    /\b(accredit|ofqual|mfhea|deac|iacbe|eduqua|dba|mba|bba|othm|knights|ssm|malaysia|must|ioscm|specialization|specialisation|eligibility|ects|dissertation|viva|fee|tuition|curriculum|modules?|semester|credits?|pathway|top[\s-]?up|scholarship)\b/i;

const PROGRAM_ALIASES = {
    'ssm-dba': ['dba', 'doctorate', 'doctor of business'],
    'ioscm-l7': ['ioscm', 'level 7 supply chain', 'supply chain management l7'],
    'knights-bsc': ['knights bsc', 'bsc business management'],
    'knights-mba': ['knights mba', 'work-based mba', 'work based mba'],
    'malaysia-mba': ['malaysia', 'must', 'malaysian mba'],
    'othm-l5': ['othm', 'level 5', 'l5 diploma', 'extended diploma'],
    'ssm-bba': ['bba', 'bachelor business administration'],
    'ssm-mba': ['ssm mba', 'swiss mba', 'swiss school mba'],
};

const hasProgramAlias = (q) => {
    const s = q.toLowerCase();
    for (const aliases of Object.values(PROGRAM_ALIASES)) {
        for (const a of aliases) {
            if (/[\s-]/.test(a)) {
                if (s.includes(a.toLowerCase())) return true;
            } else {
                const re = new RegExp(
                    '\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b',
                    'i'
                );
                if (re.test(s)) return true;
            }
        }
    }
    return false;
};

export function classifyQuery(query) {
    if (!query || typeof query !== 'string') return 'ambiguous';
    const trackerHit = TRACKER_RE.test(query);
    const docsHit = DOCS_RE.test(query) || hasProgramAlias(query);

    if (trackerHit && !docsHit) return 'tracker';
    if (docsHit && !trackerHit) return 'docs';
    return 'ambiguous';
}

// Default-to-docs for LUC users on ambiguous queries (spec step A).
// Non-LUC users should never reach here — docs is gated LUC-only — but if
// they do, fall back to tracker so we don't hit a 403.
export function routeFor(query, user) {
    const c = classifyQuery(query);
    if (c === 'tracker') return 'tracker';
    if (c === 'docs') return 'docs';
    // ambiguous
    return user && user.organization === 'luc' ? 'docs' : 'tracker';
}
