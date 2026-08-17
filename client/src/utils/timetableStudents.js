// Pulling individual student names out of a timetable row's "Grade / Student"
// cell. The source spreadsheets never settled on one shape, so the live data
// holds all of these:
//
//   "Mahi"                            one student
//   "Khadija / Natalie"               two students, slash-separated
//   "Deneth / Mohd. Thekkil"          names may contain dots and spaces
//   "12 / Taksheel"                   a grade prefix, then the student
//   "6 (Adwaith)"                     grade with the student in brackets
//   "8 (Rishi, Annie and Tanushri)"   grade with several bracketed students
//   "Grade 10"                        a whole grade — no individual student
//
// Grade tokens are dropped so the By Student picker lists people only.

// "Grade 10", "Year 9", "yr 10", "g11", or a bare "12" — a class, not a person.
const GRADE_TOKEN = /^(?:(?:grade|year|yr|g)\s*\.?\s*)?\d+\s*$/i;

const isGradeToken = (s) => GRADE_TOKEN.test(s.trim());

/** Individual student names in one "Grade / Student" label. */
export function extractStudentNames(label) {
    if (!label || typeof label !== 'string') return [];

    const parts = [];
    let rest = label;

    // Bracketed groups first — their contents are always students, and they can
    // be comma/"and"-separated: "8 (Rishi, Annie and Tanushri)".
    const groups = label.match(/\(([^)]*)\)/g) || [];
    for (const g of groups) {
        rest = rest.replace(g, ' ');
        parts.push(...g.slice(1, -1).split(/,|\/|\band\b|&/i));
    }

    // Whatever's left splits on slash / comma / "and".
    parts.push(...rest.split(/\/|,|\band\b|&/i));

    const seen = new Set();
    const names = [];
    for (const raw of parts) {
        const name = raw.trim().replace(/\s+/g, ' ');
        if (!name || isGradeToken(name)) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
    }
    return names;
}

/** Distinct student names across timetable entries, alphabetical. */
export function studentOptions(entries = []) {
    const byKey = new Map();
    for (const e of entries) {
        for (const name of extractStudentNames(e.studentLabel)) {
            const key = name.toLowerCase();
            if (!byKey.has(key)) byKey.set(key, name);
        }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** Does this entry belong to `student`? Case-insensitive exact name match. */
export function entryHasStudent(entry, student) {
    if (!student) return false;
    const target = student.trim().toLowerCase();
    return extractStudentNames(entry.studentLabel).some((n) => n.toLowerCase() === target);
}
