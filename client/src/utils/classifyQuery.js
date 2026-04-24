// Client-side router classifier for the unified chat drawer (spec §9).
// Returns 'tracker' | 'docs' | 'ambiguous'. Pure function — no network.
//
// Phase 4.2 hotfix: tracker is now the safe default. Tracker can gracefully
// say "I don't have enough data" when a query falls outside its scope; docs
// refuses hard, so docs-on-ambiguous creates a worse UX than the inverse.
// Only strict-docs signal (docs keyword or program alias + no tracker
// keyword) routes to docs. Everything else → tracker.

// Broad tracker-term regex. Includes verbs, nouns, time ranges, counts, and
// domain entities that only make sense in the CRM data. "team" on its own
// is a tracker signal (distinct from the "team lead" phrase in the original
// list), because "my team", "team performance" etc. are common.
const TRACKER_RE = new RegExp(
    '\\b(' +
        // admissions + students
        'admission|admissions|admitted|enrollment|enrolled|student|students|' +
        // attendance
        'attendance|attend|absent|absents|present|presents|' +
        // ranking / performance
        'performer|performance|top|bottom|ranking|rank|' +
        // targets / metrics / kpis
        'revenue|target|achievement|goal|quota|conversion|metric|kpi|' +
        // counts
        'total|count|how many|how much|' +
        // time ranges
        'today|yesterday|this week|last week|this month|last month|' +
        'this year|last year|weekly|monthly|' +
        // CRM entities
        'meeting|commitment|lead|leads|deal|pipeline|' +
        'consultant|consultants|counselor|counsellor|' +
        'team|team lead|follow[\\s-]?up|' +
        // tracker surfaces / reports
        'hourly|slot|schedule|report|analytics|dashboard' +
        ')\\b',
    'i'
);

// Docs-term regex — vocabulary specific to the program collateral. Unchanged
// from Phase 3 except for the explicit PROGRAM_ALIASES matcher below.
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
    // Both match OR neither match → ambiguous. Caller routes to tracker
    // under the new Phase 4.2 default.
    return 'ambiguous';
}

// Route resolver. Under Phase 4.2 the only path that returns 'docs' is a
// strict docs classification. Everything else (including ambiguous) goes
// to tracker. Skillhub hard-lock is enforced at the ChatPanel call site —
// this function is org-agnostic.
export function routeFor(query) {
    const c = classifyQuery(query);
    if (c === 'docs') return 'docs';
    return 'tracker';
}
