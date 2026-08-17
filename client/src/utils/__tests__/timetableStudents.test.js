import { extractStudentNames, studentOptions, entryHasStudent } from '../timetableStudents';

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

describe('entryHasStudent', () => {
    test('matches a student inside a shared slot', () => {
        const e = { studentLabel: 'Deneth / Mohd. Thekkil' };
        expect(entryHasStudent(e, 'Deneth')).toBe(true);
        expect(entryHasStudent(e, 'Mohd. Thekkil')).toBe(true);
        expect(entryHasStudent(e, 'mohd. thekkil')).toBe(true); // case-insensitive
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
