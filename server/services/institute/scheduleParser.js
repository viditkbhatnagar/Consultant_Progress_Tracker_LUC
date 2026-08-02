/**
 * Parses a Skillhub Institute schedule workbook into teachers + timetable rows.
 *
 * Shape the teachers actually use: ONE SHEET PER TEACHER, sheet name = teacher
 * name. Row 1 is a header; each later row is a session:
 *
 *   Day | Time | Grade / Student | Year | Subject | Curriculum
 *
 * Column lookup is by header name with fallbacks, because the sheets vary
 * ("Grade / Student" vs "Year" vs "Grade/Year", "Curriculum" vs "Syllabus").
 * A row is only a session if column A parses to a weekday — that's what lets
 * the parser skip title rows, blank spacers, and non-schedule tabs.
 *
 * Pure: takes a Buffer, touches no DB and no filesystem, so the upload
 * endpoint, the one-off import script, and the tests all share one parser.
 */
const XLSX = require('xlsx');
const { canonicalizeSubject } = require('../../config/instituteSubjects');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Guard rails against a malformed or hostile workbook: a sheet's declared
// range can be enormous even when it holds almost no data, and every parsed
// row becomes a DB write.
const MAX_SHEETS = 100;
const MAX_ROWS_PER_SHEET = 5000;
const MAX_SESSIONS = 5000;

const norm = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
const lc = (s) => norm(s).toLowerCase();

// "12.30 pm - 1.30 pm" → minutes-from-midnight of the start, for ordering.
function parseStartMinutes(time) {
    const m = String(time || '').match(/(\d{1,2})[.:]?(\d{2})?\s*(am|pm)/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3].toLowerCase();
    if (ap === 'pm' && hh !== 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return hh * 60 + mm;
}

// Accepts "Monday", "monday", "Mon", "Tues", "Thurs" — and a real Date, which
// is what `cellDates: true` hands back when the day column is date-formatted.
const dayOf = (v) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return DAYS[(v.getDay() + 6) % 7];
    const d = lc(v).replace(/\.$/, '');
    if (!d) return null;
    const exact = DAYS.find((x) => x.toLowerCase() === d);
    if (exact) return exact;
    // Abbreviations, but only unambiguous ones: "s" or "t" alone could be
    // either of two days, so require at least the 3-letter prefix.
    if (d.length < 3) return null;
    const hits = DAYS.filter((x) => x.toLowerCase().startsWith(d));
    return hits.length === 1 ? hits[0] : null;
};
const isCbse = (cur) => /cbse/i.test(cur || '');

// Grade/year label kept identical to the attendance + tests convention so a
// timetable row links to the same roster ("Grade 9" for CBSE, else "Year 9").
function gradeLabel(numOrText, curriculum) {
    const n = String(numOrText || '').match(/\d+/);
    if (!n) return norm(numOrText);
    return `${isCbse(curriculum) ? 'Grade' : 'Year'} ${n[0]}`;
}

// Candidate student names out of a "Grade / Student" cell, dropping the grade
// token. "Deneth / Mohd. Thekkil" → [Deneth, Mohd. Thekkil];
// "8 (Rishi, Annie and Tanushri)" → [Rishi, Annie, Tanushri]; "Grade 9" → [].
function studentsFromLabel(label) {
    const s = norm(label);
    const paren = s.match(/\(([^)]*)\)/);
    const names = paren
        ? paren[1].split(/,|\band\b/i)
        : s.replace(/\bgrade\b/gi, '').split(/[/,]| and /i);
    return names
        .map((x) => norm(x).replace(/^\d+\s*/, '').trim())
        .filter((x) => x && !/^\d+$/.test(x) && !/^grade\s*\d*$/i.test(x));
}

/**
 * @param {Buffer} buffer  the uploaded .xlsx/.xls
 * @returns {{teachers: Array, timetable: Array, warnings: string[]}}
 * @throws {Error} with a user-facing message when the file isn't readable
 */
function parseScheduleWorkbook(buffer) {
    if (!buffer || !buffer.length) {
        const err = new Error('The file is empty.');
        err.userFacing = true;
        throw err;
    }

    let wb;
    try {
        wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (e) {
        const err = new Error('That file could not be read as an Excel workbook.');
        err.userFacing = true;
        throw err;
    }

    const teachers = [];
    const timetable = [];
    const warnings = [];

    const sheetNames = (wb.SheetNames || []).slice(0, MAX_SHEETS);
    if ((wb.SheetNames || []).length > MAX_SHEETS) {
        warnings.push(`Only the first ${MAX_SHEETS} sheets were read.`);
    }

    for (const sheetName of sheetNames) {
        const teacherName = norm(sheetName);
        if (!teacherName) continue;

        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
            header: 1,
            blankrows: false,
        });
        if (!rows.length) {
            warnings.push(`"${teacherName}": sheet is empty — skipped.`);
            continue;
        }

        const header = (rows[0] || []).map(norm);
        const idx = (label) => header.findIndex((h) => lc(h) === lc(label));
        const iTime = idx('Time');
        const iGS = idx('Grade / Student') >= 0 ? idx('Grade / Student') : 2;
        const iYear = idx('Year') >= 0 ? idx('Year') : idx('Grade/Year');
        const iSubject = idx('Subject');
        const iCur = idx('Curriculum') >= 0 ? idx('Curriculum') : idx('Syllabus');

        const subjectsSet = new Set();
        const sessions = [];
        // Excel merges the Day cell across each day's block, so continuation
        // rows come back blank. Carry the last day forward — without this the
        // parser silently drops most of a normally-formatted schedule.
        let lastDay = null;
        const unreadable = [];

        const limit = Math.min(rows.length, MAX_ROWS_PER_SHEET + 1);
        for (let r = 1; r < limit; r++) {
            const row = rows[r] || [];
            const time = norm(row[iTime >= 0 ? iTime : 1]);
            const gsLabel = norm(row[iGS]);
            const subjectCell = iSubject >= 0 ? norm(row[iSubject]) : '';

            const rawDay = row[0] instanceof Date ? row[0] : norm(row[0]);
            const explicitDay = dayOf(rawDay);
            if (explicitDay) lastDay = explicitDay;

            // A row is a session only if it actually carries session data;
            // title rows and spacers have none and are skipped silently.
            if (!time && !gsLabel && !subjectCell) continue;

            // Blank day cell → merged continuation, inherit. A NON-blank day
            // cell we couldn't read is a real problem: report it rather than
            // dropping data on the floor.
            const day = explicitDay || (rawDay === '' ? lastDay : null);
            if (!day) {
                unreadable.push(r + 1); // 1-based, matches the Excel row number
                continue;
            }
            const curriculum = iCur >= 0 ? norm(row[iCur]) : '';
            // Canonicalize so Excel spellings ("Maths"/"Mathematics") collapse
            // onto the same subject the pickers and reports use.
            const subject = canonicalizeSubject(subjectCell) || subjectCell;
            const yearVal = iYear >= 0 ? row[iYear] : gsLabel;
            const gradeOrYear = gradeLabel(yearVal, curriculum);

            if (subject) subjectsSet.add(subject);
            sessions.push({
                teacherName,
                dayOfWeek: day,
                time,
                startMinutes: parseStartMinutes(time),
                gradeOrYear,
                curriculum,
                subject,
                studentLabel: gsLabel,
                studentNames: studentsFromLabel(gsLabel),
            });
        }

        // Rows that carried data but whose day couldn't be read are surfaced,
        // never dropped quietly — the import replaces a teacher's schedule, so
        // an unreported skip means silently deleting real sessions.
        if (unreadable.length) {
            const shown = unreadable.slice(0, 10).join(', ');
            warnings.push(
                `"${teacherName}": ${unreadable.length} row(s) skipped — the Day column could not be read (row ${shown}${unreadable.length > 10 ? '…' : ''}).`
            );
        }
        if (rows.length > MAX_ROWS_PER_SHEET + 1) {
            warnings.push(
                `"${teacherName}": only the first ${MAX_ROWS_PER_SHEET} rows were read.`
            );
        }

        if (!sessions.length) {
            warnings.push(`"${teacherName}": no sessions found (no weekday rows) — skipped.`);
            continue;
        }

        timetable.push(...sessions);
        teachers.push({
            name: teacherName,
            subjects: [...subjectsSet],
            sessions: sessions.length,
        });

        if (timetable.length > MAX_SESSIONS) {
            const err = new Error(
                `This file has more than ${MAX_SESSIONS} sessions, which is far larger than a real schedule. Please split it up.`
            );
            err.userFacing = true;
            throw err;
        }
    }

    if (!timetable.length) {
        const err = new Error(
            'No sessions found. Each teacher should be their own sheet, with a Day column (Monday, Tuesday…) and a Time column.'
        );
        err.userFacing = true;
        throw err;
    }

    return { teachers, timetable, warnings };
}

module.exports = {
    parseScheduleWorkbook,
    // exported for tests / reuse
    parseStartMinutes,
    gradeLabel,
    studentsFromLabel,
    DAYS,
};
