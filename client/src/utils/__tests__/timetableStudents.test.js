import {
    extractStudentNames,
    studentOptions,
    entryHasStudent,
    namesMatch,
    buildStudentOptions,
} from '../timetableStudents';

// Every case below is a real "Grade / Student" value from the live Institute
// timetable — the sheets never used one consistent shape.
describe('extractStudentNames', () => {
    test('a single name', () => {
        expect(extractStudentNames('Mahi')).toEqual(['Mahi']);
    });

    test('slash-separated names, including names with dots', () => {
        expect(extractStudentNames('Khadija / Natalie')).toEqual(['Khadija', 'Natalie']);
        expect(extractStudentNames('Deneth / Mohd. Thekkil')).toEqual(['Deneth', 'Mohd. Thekkil']);
    });

    test('a grade prefix is dropped, the student kept', () => {
        expect(extractStudentNames('12 / Taksheel')).toEqual(['Taksheel']);
        expect(extractStudentNames('9 / Nasia')).toEqual(['Nasia']);
        expect(extractStudentNames('6 / Adwaith Akhila')).toEqual(['Adwaith Akhila']);
    });

    test('bracketed students are extracted and split on comma / "and"', () => {
        expect(extractStudentNames('6 (Adwaith)')).toEqual(['Adwaith']);
        expect(extractStudentNames('8 (Rishi, Annie and Tanushri)'))
            .toEqual(['Rishi', 'Annie', 'Tanushri']);
    });

    test('a whole-grade label yields no students', () => {
        ['Grade 10', 'Grade 8', 'Year 11', 'yr 10', 'g11', '12'].forEach((g) => {
            expect(extractStudentNames(g)).toEqual([]);
        });
    });

    test('empty / missing labels are safe', () => {
        expect(extractStudentNames('')).toEqual([]);
        expect(extractStudentNames(null)).toEqual([]);
        expect(extractStudentNames(undefined)).toEqual([]);
    });

    test('the same name twice collapses to one', () => {
        expect(extractStudentNames('Mahi / mahi')).toEqual(['Mahi']);
    });
});

describe('studentOptions', () => {
    test('distinct names across entries, alphabetical, grades excluded', () => {
        const entries = [
            { studentLabel: 'Khadija / Natalie' },
            { studentLabel: 'Grade 10' },
            { studentLabel: 'Mahi' },
            { studentLabel: '8 (Rishi, Annie and Tanushri)' },
            { studentLabel: 'Natalie' }, // dup
            { studentLabel: '' },
        ];
        expect(studentOptions(entries))
            .toEqual(['Annie', 'Khadija', 'Mahi', 'Natalie', 'Rishi', 'Tanushri']);
    });

    test('no entries is safe', () => {
        expect(studentOptions()).toEqual([]);
        expect(studentOptions([])).toEqual([]);
    });
});

// The timetable writes short names, the student roster full ones, so the
// picker has to bridge the two without over-matching.
describe('namesMatch', () => {
    test('exact, case- and space-insensitive', () => {
        expect(namesMatch('Mahi', 'mahi')).toBe(true);
        expect(namesMatch('Mohd.  Thekkil', 'Mohd. Thekkil')).toBe(true);
    });

    test('a short name matches the full roster name it starts', () => {
        expect(namesMatch('Mahi', 'Mahi Subhash Chaurasia')).toBe(true);
        expect(namesMatch('Mahi Subhash Chaurasia', 'Mahi')).toBe(true);
        expect(namesMatch('Adwaith Akhila', 'Adwaith Akhila Aswani')).toBe(true);
    });

    test('a mid-name match is refused — that is a different student', () => {
        // "Faizan" must NOT pull in Mohammed Faizan Hussain's classes.
        expect(namesMatch('Faizan', 'Mohammed Faizan Hussain')).toBe(false);
        // and a partial word never matches
        expect(namesMatch('Nat', 'Natalie')).toBe(false);
        expect(namesMatch('Mohammed Thekkil Thayal', 'Mohammed Faizan Hussain')).toBe(false);
    });

    test('blanks never match', () => {
        expect(namesMatch('', 'Mahi')).toBe(false);
        expect(namesMatch('Mahi', null)).toBe(false);
    });
});

describe('buildStudentOptions', () => {
    const entries = [
        { studentLabel: 'Mahi' },
        { studentLabel: 'Mohd. Thekkil' },   // spelled differently from the roster
        { studentLabel: 'Grade 10' },
    ];
    const roster = [
        { studentName: 'Mahi Subhash Chaurasia', yearOrGrade: 'year 13', curriculumSlug: 'IGCSE', studentStatus: 'active' },
        { studentName: 'Zoya Khan', yearOrGrade: 'grade 8', curriculumSlug: 'CBSE', studentStatus: 'inactive' },
    ];

    test('lists the whole roster, including students with no sessions', () => {
        const names = buildStudentOptions(entries, roster).map((o) => o.name);
        expect(names).toContain('Zoya Khan'); // no timetable rows at all
        expect(names).toContain('Mahi Subhash Chaurasia');
    });

    test('keeps timetable-only names so nobody on a schedule is lost', () => {
        const names = buildStudentOptions(entries, roster).map((o) => o.name);
        expect(names).toContain('Mohd. Thekkil');
    });

    test('does not list a student twice when the roster spells them longer', () => {
        const names = buildStudentOptions(entries, roster).map((o) => o.name);
        expect(names).not.toContain('Mahi');                 // folded into the roster entry
        expect(names.filter((n) => /^Mahi/.test(n))).toHaveLength(1);
    });

    test('carries grade/board and an inactive flag, sorted by name', () => {
        const opts = buildStudentOptions(entries, roster);
        expect(opts.map((o) => o.name)).toEqual([...opts.map((o) => o.name)].sort());
        const zoya = opts.find((o) => o.name === 'Zoya Khan');
        expect(zoya.meta).toBe('grade 8 · CBSE');
        expect(zoya.inactive).toBe(true);
    });

    test('no roster still yields the timetable names', () => {
        expect(buildStudentOptions(entries, []).map((o) => o.name))
            .toEqual(['Mahi', 'Mohd. Thekkil']);
    });
});

describe('entryHasStudent', () => {
    test('matches a student inside a shared slot', () => {
        const e = { studentLabel: 'Deneth / Mohd. Thekkil' };
        expect(entryHasStudent(e, 'Deneth')).toBe(true);
        expect(entryHasStudent(e, 'Mohd. Thekkil')).toBe(true);
        expect(entryHasStudent(e, 'mohd. thekkil')).toBe(true); // case-insensitive
    });

    test('a full roster name finds the short label on the timetable', () => {
        // Picking "Mahi Subhash Chaurasia" from the roster must find her
        // sessions, which are labelled just "Mahi".
        expect(entryHasStudent({ studentLabel: 'Mahi' }, 'Mahi Subhash Chaurasia')).toBe(true);
        expect(entryHasStudent({ studentLabel: '6 / Adwaith Akhila' }, 'Adwaith Akhila Aswani')).toBe(true);
    });

    test('does not match a different student or a partial name', () => {
        const e = { studentLabel: 'Khadija / Natalie' };
        expect(entryHasStudent(e, 'Mahi')).toBe(false);
        // "Nat" must not match "Natalie" — exact names only, or a picker
        // selection would pull in unrelated slots.
        expect(entryHasStudent(e, 'Nat')).toBe(false);
    });

    test('a grade-only slot belongs to no individual student', () => {
        expect(entryHasStudent({ studentLabel: 'Grade 10' }, 'Grade 10')).toBe(false);
    });

    test('no student selected matches nothing', () => {
        expect(entryHasStudent({ studentLabel: 'Mahi' }, '')).toBe(false);
    });
});
