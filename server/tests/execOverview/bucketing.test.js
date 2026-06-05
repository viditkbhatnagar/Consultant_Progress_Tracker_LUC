const {
    PROGRAM_BUCKETS,
    AGI_BUCKETS,
    ALL_BUCKETS,
    BUCKET_SLUGS,
    PROGRAM_SLUGS,
    AGI_SLUGS,
    ALL_SLUGS,
    KHDA_BUCKETS,
    EXCLUDED_BUCKETS,
    KHDA_SLUGS,
    EXCLUDED_SLUGS,
    bucketToSlug,
    slugToBucket,
    isAgiBucket,
    isAgiSlug,
    isKhdaBucket,
    isExcludedBucket,
    isExcludedSlug,
    bucketProgram,
} = require('../../services/execOverview/bucketing');

describe('execOverview bucketing', () => {
    test('exposes 14 program + KHDA + 2 AGI buckets', () => {
        expect(PROGRAM_BUCKETS).toHaveLength(14);
        expect(AGI_BUCKETS).toEqual(['AGI', 'AGI Standalone']);
        expect(KHDA_BUCKETS).toEqual(['KHDA']);
        // Excluded-from-total buckets, KHDA listed before AGI.
        expect(EXCLUDED_BUCKETS).toEqual(['KHDA', 'AGI', 'AGI Standalone']);
        expect(ALL_BUCKETS).toHaveLength(17);
        // KHDA renders immediately before AGI in the column order.
        expect(ALL_BUCKETS.indexOf('KHDA')).toBe(ALL_BUCKETS.indexOf('AGI') - 1);
        // KHDA is NOT a program bucket, so it never enters Total Admissions.
        expect(PROGRAM_BUCKETS).not.toContain('KHDA');
    });

    test('isAgiBucket flags AGI variants only', () => {
        expect(isAgiBucket('AGI')).toBe(true);
        expect(isAgiBucket('AGI Standalone')).toBe(true);
        expect(isAgiBucket('SSM MBA')).toBe(false);
        expect(isAgiBucket('MUST')).toBe(false);
        expect(isAgiBucket('KHDA')).toBe(false);
    });

    test('KHDA is its own excluded bucket, distinct from AGI', () => {
        expect(isKhdaBucket('KHDA')).toBe(true);
        expect(isKhdaBucket('AGI')).toBe(false);
        // Both KHDA and AGI are excluded from Total Admissions.
        expect(isExcludedBucket('KHDA')).toBe(true);
        expect(isExcludedBucket('AGI')).toBe(true);
        expect(isExcludedBucket('AGI Standalone')).toBe(true);
        expect(isExcludedBucket('SSM MBA')).toBe(false);
        expect(isExcludedSlug('khda')).toBe(true);
        expect(isExcludedSlug('agi')).toBe(true);
        expect(isExcludedSlug('knights_mba')).toBe(false);
        expect(BUCKET_SLUGS['KHDA']).toBe('khda');
    });

    describe('bucket slugs (safe DB field names)', () => {
        test('every bucket has a slug', () => {
            for (const b of ALL_BUCKETS) {
                expect(typeof BUCKET_SLUGS[b]).toBe('string');
                expect(BUCKET_SLUGS[b]).toMatch(/^[a-z0-9_]+$/);
            }
        });
        test('PROGRAM + KHDA + AGI slugs = ALL_SLUGS, no dupes', () => {
            expect(PROGRAM_SLUGS).toHaveLength(14);
            expect(AGI_SLUGS).toEqual(['agi', 'agi_standalone']);
            expect(KHDA_SLUGS).toEqual(['khda']);
            expect(EXCLUDED_SLUGS).toEqual(['khda', 'agi', 'agi_standalone']);
            expect(new Set(ALL_SLUGS).size).toBe(17);
            expect(PROGRAM_SLUGS).not.toContain('khda');
        });
        test('bucketToSlug / slugToBucket round-trip', () => {
            for (const b of ALL_BUCKETS) {
                expect(slugToBucket(bucketToSlug(b))).toBe(b);
            }
        });
        test('isAgiSlug agrees with isAgiBucket', () => {
            expect(isAgiSlug('agi')).toBe(true);
            expect(isAgiSlug('agi_standalone')).toBe(true);
            expect(isAgiSlug('knights_mba')).toBe(false);
        });
        test('unknown inputs return null', () => {
            expect(bucketToSlug('Bogus')).toBeNull();
            expect(slugToBucket('bogus')).toBeNull();
        });
    });

    describe('university-driven buckets (university wins)', () => {
        test('AGI university routes any program to AGI bucket', () => {
            expect(
                bucketProgram({
                    university: 'AGI – American Global Institute (Certifications)',
                    program: 'Pathway Program Certification',
                })
            ).toBe('AGI');
        });

        test('AGI Standalone splits on program qualifier', () => {
            expect(
                bucketProgram({
                    university: 'AGI – American Global Institute (Certifications)',
                    program: 'AGI Standalone Certificate',
                })
            ).toBe('AGI Standalone');
            expect(
                bucketProgram({
                    university: 'AGI – American Global Institute (Certifications)',
                    program: 'Standalone – Manager Certification',
                })
            ).toBe('AGI Standalone');
        });

        test('MUST collapses every program into one bucket', () => {
            expect(
                bucketProgram({
                    university: 'Malaysia University of Science & Technology (MUST)',
                    program: 'MBA',
                })
            ).toBe('MUST');
            expect(
                bucketProgram({
                    university: 'Malaysia University of Science & Technology (MUST)',
                    program: 'BBA',
                })
            ).toBe('MUST');
        });
    });

    describe('SSM × degree', () => {
        test('SSM MBA combos map to SSM MBA', () => {
            expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'MBA' })).toBe('SSM MBA');
            expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'MBA General' })).toBe('SSM MBA');
            expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'Top-up MBA Standalone' })).toBe('SSM MBA');
        });

        test('SSM BBA combos map to SSM BBA', () => {
            expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'BBA' })).toBe('SSM BBA');
            expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'BBA Level 4 & 5' })).toBe('OTHM-4,5');
        });
    });

    describe('Knights × degree', () => {
        test('Knights MBA combos map to KNIGHTS MBA', () => {
            expect(bucketProgram({ university: 'Knights College', program: 'MBA' })).toBe('KNIGHTS MBA');
            expect(bucketProgram({ university: 'Knights College', program: 'MBA + Premium' })).toBe('KNIGHTS MBA');
        });

        test('Knights BBA combos map to KNIGHTS BBA', () => {
            expect(bucketProgram({ university: 'Knights College', program: 'BBA' })).toBe('KNIGHTS BBA');
        });
    });

    describe('OTHM diploma levels', () => {
        test('Level 7 routes to OTHM-7', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'OTHM Diploma Level 7' })).toBe('OTHM-7');
            expect(bucketProgram({ university: 'OTHM', program: 'Level 7' })).toBe('OTHM-7');
        });
        test('Level 6 routes to OTHM-6', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'OTHM Diploma Level 6' })).toBe('OTHM-6');
        });
        test('Level 3 routes to OTHM-3', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'OTHM Diploma Level 3' })).toBe('OTHM-3');
        });
        test('Level 4 or 5 routes to OTHM-4,5', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'OTHM Diploma Level 4' })).toBe('OTHM-4,5');
            expect(bucketProgram({ university: 'OTHM', program: 'Level 4 & 5' })).toBe('OTHM-4,5');
        });
        test('Extended L5 routes to OTHM Ext L5', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'OTHM Diploma Extended L5' })).toBe('OTHM Ext L5');
            expect(bucketProgram({ university: 'OTHM', program: 'Extended Level 5' })).toBe('OTHM Ext L5');
        });
    });

    describe('combo buckets', () => {
        test('OTHM + MBA combos route to OTHM+MBA', () => {
            expect(bucketProgram({ university: 'Knights College', program: 'OTHM L7 + MBA' })).toBe('OTHM+MBA');
            expect(bucketProgram({ university: 'Knights College', program: 'MBA OTHM Level 7' })).toBe('OTHM+MBA');
        });

        test('IOSCM + MBA combos route to IOSCM+MBA', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'IoSCM + MBA' })).toBe('IOSCM+MBA');
        });

        test('IOSCM Level 7 routes to IOSCM-7', () => {
            expect(bucketProgram({ university: 'OTHM', program: 'IoSCM Level 7' })).toBe('IOSCM-7');
        });
    });

    test('DBA routes to DBA regardless of university', () => {
        expect(bucketProgram({ university: 'Swiss School of Management (SSM)', program: 'DBA' })).toBe('DBA');
        expect(bucketProgram({ university: 'Knights College', program: 'DBA Premium' })).toBe('DBA');
    });

    test('null/empty input returns null', () => {
        expect(bucketProgram()).toBeNull();
        expect(bucketProgram({})).toBeNull();
        expect(bucketProgram({ university: '', program: '' })).toBeNull();
    });

    test('unknown combinations fall back to closest degree bucket when possible', () => {
        expect(bucketProgram({ university: 'CMBS', program: 'BSC' })).toBeNull();
        expect(bucketProgram({ university: 'CMBS', program: 'MBA Premium' })).toBe('SSM MBA');
    });
});
