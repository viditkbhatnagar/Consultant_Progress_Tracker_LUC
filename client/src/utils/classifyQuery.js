// Client-side router classifier for the unified "Ask me" drawer.
// Returns 'tracker' | 'docs' | 'ambiguous' (sync) and exposes an async
// routeFor(query) that resolves to 'tracker' | 'docs'.
//
// Phase 5.3 hotfix: bulletproofed against the two prod failures:
//   1. Program-name + tracker-keyword combo queries ("SSM MBA credits")
//      went to tracker because "how many" out-weighted "SSM". Fix:
//      program-alias match now wins immediately — programs are the
//      strongest possible signal that the user wants docs.
//   2. Misspellings ("paas", "knihgts", "creidts", "disseration") broke
//      keyword matching. Fix: MISSPELLING_MAP normalises them first,
//      and fuzzy (Levenshtein ≤ 1) matching catches the long tail of
//      typos on program names.
//
// When strict rules are still ambiguous we fall through to an LLM
// classifier (Groq primary, OpenAI fallback, server-side cached).

import { distance as levDistance } from 'fastest-levenshtein';
import { API_BASE_URL } from './constants';

// ── Misspelling normalisation (run first) ─────────────────────────────
// Case-insensitive, whole-word. Keys are what the user typed; values
// are the canonical spelling the regexes below expect. Keep this tight
// and intentional — it's not a general spell-checker, just the set of
// typos we've actually observed.
const MISSPELLING_MAP = {
    paas: 'pass',
    knihgts: 'knights',
    knigths: 'knights',
    knigts: 'knights',
    malasia: 'malaysia',
    malaiysa: 'malaysia',
    malaysiya: 'malaysia',
    creidts: 'credits',
    credti: 'credits',
    credit: 'credits',
    addmission: 'admission',
    adimission: 'admission',
    disseration: 'dissertation',
    dissertaion: 'dissertation',
    accredition: 'accreditation',
    accredation: 'accreditation',
    certificaiton: 'certification',
    qualificaton: 'qualification',
    eligiblity: 'eligibility',
};

const normaliseMisspellings = (q) => {
    if (!q) return '';
    let out = q;
    for (const [bad, good] of Object.entries(MISSPELLING_MAP)) {
        const re = new RegExp(`\\b${bad}\\b`, 'gi');
        out = out.replace(re, good);
    }
    return out;
};

// ── Program aliases (spec §3e + fuzzy extras) ─────────────────────────
// Single-token aliases go through Levenshtein ≤ 1 fuzzy matching against
// every word in the query. Multi-word aliases use substring match on the
// full lowercased query — fuzzy on phrases is noisy, substring is precise
// enough given the short corpus.
const PROGRAM_ALIASES = {
    'ssm-dba': ['dba', 'doctorate', 'ph.d', 'doctor of business', 'ssm dba'],
    'ioscm-l7': [
        'ioscm',
        'level 7 supply chain',
        'supply chain management l7',
        'ofqual supply chain',
    ],
    'knights-bsc': [
        'knights',
        'knights bsc',
        'bsc business management',
        'bachelor science knights',
        'cmbs bsc',
    ],
    'knights-mba': [
        'knights',
        'knights mba',
        'work-based mba',
        'work based mba',
        'cmbs mba',
    ],
    'malaysia-mba': [
        'malaysia',
        'must',
        'malaysian mba',
        'malaysia university',
    ],
    'othm-l5': ['othm', 'level 5', 'l5 diploma', 'extended diploma'],
    'ssm-bba': ['bba', 'bachelor business administration', 'ssm bba'],
    'ssm-mba': ['ssm', 'ssm mba', 'swiss mba', 'swiss school mba', 'swiss school'],
};

const SINGLE_TOKEN_ALIASES = new Set();
const MULTI_TOKEN_ALIASES = [];
for (const aliases of Object.values(PROGRAM_ALIASES)) {
    for (const a of aliases) {
        const lower = a.toLowerCase();
        if (/[\s-]/.test(lower)) MULTI_TOKEN_ALIASES.push(lower);
        else SINGLE_TOKEN_ALIASES.add(lower);
    }
}

const hasProgramAlias = (q) => {
    const s = q.toLowerCase();
    // Multi-word substring matches first (strong, precise signal).
    for (const m of MULTI_TOKEN_ALIASES) {
        if (s.includes(m)) return true;
    }
    // Single-token fuzzy. Short aliases (≤3 chars) require exact match
    // — distance 1 on "dba" would match "db", "ba", "aba", etc.
    const tokens = s.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
    for (const t of tokens) {
        for (const a of SINGLE_TOKEN_ALIASES) {
            if (a.length <= 3) {
                if (t === a) return true;
            } else {
                if (t === a || levDistance(t, a) <= 1) return true;
            }
        }
    }
    return false;
};

// ── Keyword regexes ───────────────────────────────────────────────────
const docsKeywordList = [
    'accredit', 'accreditation', 'accredited', 'ofqual', 'mfhea', 'deac',
    'iacbe', 'eduqua', 'aacsb', 'equis', 'wes', 'ces', 'icas', 'mofa',
    'apostille', 'specialization', 'specialisation', 'specializations',
    'specialisations', 'eligibility', 'ects', 'uk credit', 'credits',
    'module', 'modules', 'curriculum', 'syllabus', 'dissertation',
    'thesis', 'viva', 'capstone', 'tuition', 'fee', 'fees', 'cost',
    'price', 'emi', 'installment', 'scholarship', 'duration', 'months',
    'years', 'recognized', 'recognition', 'valid', 'equivalent',
    'equivalence', 'career path', 'promotion', 'director', 'vp',
    'c-suite', 'cv', 'linkedin', 'program', 'programme', 'degree',
    'diploma', 'bachelor', 'master', 'doctorate', 'postgraduate',
    'graduate', 'undergrad', 'entry requirement', 'weekends',
    'weekend class', 'online', 'blended', 'distance learning',
    'capstone project', 'final project',
];

const trackerKeywordList = [
    'admission today', 'admissions today', 'admissions this week',
    'admit today', 'revenue today', 'revenue this month',
    'revenue this week', 'revenue this year', 'pipeline',
    'pipeline value', 'top performer', 'top performers',
    'bottom performer', 'performance today', 'performance this week',
    'achievement rate', 'conversion rate', 'conversion', 'target',
    'quota', 'consultant', 'consultants', 'counselor', 'counselors',
    'counsellor', 'counsellors', 'team lead', 'team leads', 'manager',
    'hot lead', 'warm lead', 'cold lead', 'unresponsive', 'cif',
    'follow up', 'followup', 'follow-up', 'callback', 'attendance',
    'absent', 'absents', 'present', 'presents', 'meeting today',
    'meetings today', 'meetings this week', 'scheduled', 'hourly slot',
    'hourly', 'slot', 'student database', 'enrollment number',
    'student count', 'how many students', 'how many meetings',
    'how many admissions', 'revenue trend', 'total admissions',
    'top team performer',
];

const buildAlternationRe = (terms) => {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b(' + terms.map(esc).join('|') + ')\\b', 'i');
};
const DOCS_RE = buildAlternationRe(docsKeywordList);
const TRACKER_RE = buildAlternationRe(trackerKeywordList);

const countHits = (re, s) => {
    const m = s.match(new RegExp(re.source, 'gi'));
    return m ? m.length : 0;
};

// ── Synchronous classification ────────────────────────────────────────
// Strict priority order:
//   1. Misspelling normalisation.
//   2. Program alias (exact or fuzzy) → 'docs' immediately.
//   3. Docs hit + no tracker hit → 'docs'.
//   4. Tracker hit + no docs hit → 'tracker'.
//   5/6. Ambiguous → 'ambiguous' (caller escalates to LLM).
// Docs-dominant tie-break: docs ≥ 2 vs tracker = 1 → docs; mirror for
// tracker-dominant.
export function classifyQuery(query) {
    if (!query || typeof query !== 'string') return 'ambiguous';
    const s = normaliseMisspellings(query);

    if (hasProgramAlias(s)) return 'docs';

    const docsHits = countHits(DOCS_RE, s);
    const trackerHits = countHits(TRACKER_RE, s);

    if (docsHits > 0 && trackerHits === 0) return 'docs';
    if (trackerHits > 0 && docsHits === 0) return 'tracker';
    if (docsHits >= 2 && trackerHits === 1) return 'docs';
    if (trackerHits >= 2 && docsHits === 1) return 'tracker';

    return 'ambiguous';
}

// ── LLM fallback (server-side cached) ────────────────────────────────
const authHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

async function classifyViaLLM(query, signal) {
    const res = await fetch(`${API_BASE_URL}/chat/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ query }),
        signal,
    });
    if (!res.ok) throw new Error(`classify HTTP ${res.status}`);
    const j = await res.json();
    return j.route === 'docs' ? 'docs' : 'tracker';
}

// Always resolves to 'tracker' | 'docs'. Falls back to 'tracker' on
// network error so a classifier outage doesn't break the chat path.
export async function routeFor(query, { signal } = {}) {
    const c = classifyQuery(query);
    if (c === 'docs') return 'docs';
    if (c === 'tracker') return 'tracker';
    try {
        return await classifyViaLLM(query, signal);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
            '[classifyQuery] LLM fallback failed, defaulting to tracker:',
            err.message
        );
        return 'tracker';
    }
}

// Exposed for tests.
export const _internal = {
    normaliseMisspellings,
    hasProgramAlias,
    DOCS_RE,
    TRACKER_RE,
};
