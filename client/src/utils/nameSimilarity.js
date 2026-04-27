// Soft-warning helper for the Linked Commitment picker. When a TL/admin picks
// a commit whose studentName barely resembles the one they're entering, we
// nudge them to double-check. Pure client-side, no deps.
//
// Score is max of three signals:
//  - token-containment ("Maria Smith" ⊂ "Maria Anne Smith" → 1.0): handles
//    middle-name drops and additions cleanly.
//  - token-Jaccard: handles reordered tokens and partial overlaps.
//  - normalized-Levenshtein-ratio: catches single-char typos and
//    transliterations ("Mohamed" vs "Mohammed").
// Whichever is most lenient wins, so we only warn when *all* signals agree
// the names look meaningfully different.

const WARN_THRESHOLD = 0.75;

function normalize(s) {
    if (!s) return '';
    return String(s)
        .toLowerCase()
        .replace(/[.,'"\-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

function tokenStats(aTokens, bTokens) {
    const A = new Set(aTokens);
    const B = new Set(bTokens);
    if (!A.size && !B.size) return { jaccard: 1, containment: 1 };
    if (!A.size || !B.size) return { jaccard: 0, containment: 0 };
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    return {
        jaccard: inter / (A.size + B.size - inter),
        containment: inter / Math.min(A.size, B.size),
    };
}

export function compareNames(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    // No-op when either side is empty — picker just opened, or commit has no
    // student name yet. We don't want to warn about nothing.
    if (!na || !nb) return { score: 1, warn: false };
    const aTokens = na.split(' ').filter(Boolean);
    const bTokens = nb.split(' ').filter(Boolean);
    const { jaccard: jac, containment } = tokenStats(aTokens, bTokens);
    const lev = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
    const score = Math.max(jac, lev, containment);
    return { score, warn: score < WARN_THRESHOLD };
}

export const NAME_SIMILARITY_THRESHOLD = WARN_THRESHOLD;
