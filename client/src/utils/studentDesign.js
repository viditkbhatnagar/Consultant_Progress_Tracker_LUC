// Shared design tokens + column definitions for the Student Database.
// The light/dark surfaces/texts come from trackerTheme.js (`var(--t-...)`);
// this file only keeps semantic data (university palette, LUC columns,
// Skillhub status meta) that is the same in both themes.

// ─── LUC ────────────────────────────────────────────────
// The sticky Table view shows every column; Cards view picks a subset.
// `export` is true for fields that should be included in xlsx/csv exports.
export const LUC_COLUMNS = [
    { key: 'sno', lbl: 'S.No', width: 60, export: true, exportLbl: 'S.No' },
    { key: 'month', lbl: 'Month', width: 100, export: true },
    { key: 'studentName', lbl: 'Student Name', width: 180, export: true, exportLbl: 'Student Name', primary: true },
    { key: 'gender', lbl: 'Gender', width: 90, export: true, chip: true },
    { key: 'phone', lbl: 'Phone', width: 140, export: true },
    { key: 'email', lbl: 'Email', width: 200, export: true, truncate: 180 },
    { key: 'program', lbl: 'Program', width: 200, export: true, truncate: 180 },
    { key: 'university', lbl: 'University', width: 160, export: true, chip: true },
    { key: 'courseFee', lbl: 'Course Fee', width: 130, align: 'right', money: true, export: true, exportLbl: 'Course Fee (AED)' },
    { key: 'admissionFeePaid', lbl: 'Admission Fee', width: 140, align: 'right', money: true, export: true, exportLbl: 'Admission Fee Paid (AED)' },
    { key: 'source', lbl: 'Source', width: 120, chip: true, export: true },
    { key: 'openDay', lbl: 'Open Day', width: 120, export: true },
    { key: 'openDayLocation', lbl: 'Open Day Location', width: 160, export: true, exportLbl: 'Open Day Location' },
    { key: 'referredBy', lbl: 'Referred By', width: 150, export: true },
    { key: 'campaignName', lbl: 'Campaign', width: 200, truncate: 180, export: true, exportLbl: 'Campaign Name' },
    { key: 'enquiryDate', lbl: 'Enquiry Date', width: 130, date: true, export: true },
    { key: 'closingDate', lbl: 'Closing Date', width: 130, date: true, export: true },
    { key: 'conversionTime', lbl: 'Conv. Time', width: 110, align: 'center', conversionPill: true, export: true, exportLbl: 'Conversion Time (Days)' },
    { key: 'consultantName', lbl: 'Consultant', width: 140, export: true },
    { key: 'teamLeadName', lbl: 'Team Leader', width: 140, export: true },
    { key: 'residence', lbl: 'Residence', width: 120, export: true },
    { key: 'area', lbl: 'Area', width: 110, export: true },
    { key: 'nationality', lbl: 'Nationality', width: 120, export: true },
    { key: 'region', lbl: 'Region/Country', width: 150, export: true, exportLbl: 'Region/Country' },
    { key: 'companyName', lbl: 'Company', width: 200, truncate: 180, export: true, exportLbl: 'Company Name' },
    { key: 'designation', lbl: 'Designation', width: 170, truncate: 160, export: true },
    { key: 'experience', lbl: 'Exp', width: 80, align: 'center', suffix: ' yrs', export: true, exportLbl: 'Experience (Years)' },
    { key: 'industryType', lbl: 'Industry', width: 130, truncate: 110, export: true, exportLbl: 'Industry Type' },
    { key: 'deptType', lbl: 'Dept', width: 140, truncate: 130, export: true, exportLbl: 'Dept Type' },
];

export const LUC_UNIVERSITIES = [
    'Swiss School of Management (SSM)',
    'Knights College',
    'Malaysia University of Science & Technology (MUST)',
    'AGI – American Global Institute (Certifications)',
    'CMBS',
    'OTHM',
];

export const LUC_SOURCES = [
    'Google Ads',
    'Facebook',
    'Tik Tok',
    'Call-In',
    'Old Crm',
    'Linkedin',
    'Whatsapp',
    'Alumni',
    'Seo',
    'B2C',
    'Open Day',
    'Instagram',
    'Reference',
    'Re-Registration',
];

export const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// Same palette (borrowed from the hourly tracker) — semantic across themes.
// Keys match `filter.source` values.
export const SOURCE_PALETTE = {
    'Google Ads': '#4285F4',
    Facebook: '#1877F2',
    'Tik Tok': '#FF0050',
    Instagram: '#C13584',
    Linkedin: '#0A66C2',
    Whatsapp: '#25D366',
    Alumni: '#8B5CF6',
    Reference: '#0891B2',
    'Open Day': '#D97706',
    'Call-In': '#16A34A',
    'Old Crm': '#64748B',
    Seo: '#EA580C',
    B2C: '#0D9488',
    're-Registration': '#BE185D',
};

export const UNIVERSITY_PALETTE = {
    'Swiss School of Management (SSM)': '#2563EB',
    'Knights College': '#7C3AED',
    'Malaysia University of Science & Technology (MUST)': '#16A34A',
    'AGI – American Global Institute (Certifications)': '#D97706',
    CMBS: '#0891B2',
    OTHM: '#BE185D',
};

export const shortUniversity = (u = '') => {
    const m = u.match(/\(([^)]+)\)/);
    if (m) return m[1];
    return u.split(' ')[0] || u;
};

export const conversionColor = (days) => {
    if (days == null || days === '') return 'var(--t-text-faint)';
    if (days <= 7) return '#16A34A';
    if (days <= 30) return '#D97706';
    return '#64748B';
};

// Common programs — kept in sync with the original StudentTable.js
const COMMON_PROGRAMS = [
    'MBA', 'BBA', 'BSc', 'DBA', 'OTHM L7 + MBA', 'OTHM + BBA',
    'OTHM + BSC', 'MBA Premium', 'BSc Premium', 'BBA Premium',
    'DBA Premium', 'OTHM Diploma Extended L5', 'OTHM Diploma Level 3',
    'OTHM Diploma Level 4', 'OTHM Diploma Level 5', 'OTHM Diploma Level 6',
    'OTHM Diploma Level 7', 'IoSCM', 'UniFash',
    'AGI Standalone Certificate', 'AGI Standalone Manager',
];

export const LUC_PROGRAMS_BY_UNIVERSITY = {
    'Swiss School of Management (SSM)': [
        ...COMMON_PROGRAMS,
        'Ext L5 + BBA',
        'OTHM L7+SSM MBA',
        'MBA General',
        'MBA Others',
        'Top-up MBA Standalone',
        'BBA Level 4 & 5',
        'BBA Extended Level 5',
        'Top-up BBA Standalone',
        'Level 3 Diploma',
        'Level 4 Diploma',
        'Level 5 Diploma',
        'Level 5 Extended Diploma',
        'Level 6 Diploma',
        'Level 7 Diploma',
        'Other',
    ],
    'Knights College': [
        ...COMMON_PROGRAMS,
        'MBA + Premium',
        'OTHM+BSC',
        'MBA OTHM Level 7',
        'Top-up MBA Standalone',
        'BSc OTHM Level 4 & 5',
        'BSc OTHM Extended Level 5',
        'BSc Top-up Standalone',
        'Other',
    ],
    'Malaysia University of Science & Technology (MUST)': [
        ...COMMON_PROGRAMS,
        'Other',
    ],
    'AGI – American Global Institute (Certifications)': [
        ...COMMON_PROGRAMS,
        'Pathway Program Certification',
        'Standalone – Professional Certification',
        'Standalone – Manager Certification',
        'SSM MBA Plus Certification',
        'SSM BBA Plus Certification',
        'CMBS MBA Plus Certification',
        'CMBS BSc Plus Certification',
        'MUST MBA Plus Certification',
        'Other',
    ],
    CMBS: [
        ...COMMON_PROGRAMS,
        'BSC',
        'B.Sc',
        'Ext L5 + BBA',
        'Ext L5 + B.Sc',
        'Ext lev 5+ Bsc',
        'Other',
    ],
    OTHM: [
        ...COMMON_PROGRAMS,
        'Level 4 & 5',
        'Level 6',
        'Level 7',
        'Level 3 Diploma',
        'Level 4 Diploma',
        'Level 5 Diploma',
        'Level 6 Diploma',
        'Level 7 Diploma',
        'Other',
    ],
};

export const getFilterPrograms = (university) => {
    if (university) {
        return LUC_PROGRAMS_BY_UNIVERSITY[university] || [];
    }
    const all = new Set();
    Object.values(LUC_PROGRAMS_BY_UNIVERSITY).forEach((list) => {
        list.forEach((p) => all.add(p));
    });
    return [...all].sort();
};

// ─── SKILLHUB ────────────────────────────────────────────
// Status palette used by the pill + Board view (if ever re-enabled).
export const SKILLHUB_STATUS_META = {
    new_admission: {
        lbl: 'New Admission',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.12)',
    },
    active: {
        lbl: 'Active',
        color: '#16A34A',
        bg: 'rgba(22, 163, 74, 0.12)',
    },
    inactive: {
        lbl: 'Inactive',
        color: '#64748B',
        bg: 'rgba(100, 116, 139, 0.12)',
    },
};

export const SKILLHUB_COLUMNS = [
    { key: 'enrollmentNumber', lbl: 'Enrollment #', width: 150, mono: true },
    { key: 'studentName', lbl: 'Name', width: 180, primary: true, subKey: 'school' },
    { key: 'curriculum', lbl: 'Curriculum', width: 140, chip: true },
    { key: 'yearOrGrade', lbl: 'Year/Grade', width: 110 },
    { key: 'academicYear', lbl: 'Acad. Year', width: 110 },
    { key: 'consultantName', lbl: 'Counselor', width: 140 },
    { key: 'mode', lbl: 'Mode', width: 100 },
    { key: 'dateOfEnrollment', lbl: 'Date of Enrollment', width: 160, date: true },
    { key: 'courseFee', lbl: 'Course Fee', width: 130, align: 'right', money: true },
    { key: 'outstandingAmount', lbl: 'Outstanding', width: 130, align: 'right', money: true },
    { key: 'studentStatus', lbl: 'Status', width: 130, statusPill: true },
];

// Which fields count as "outstanding" so the KPI strip can show risk.
export const computeSkillhubOutstanding = (s) => {
    const paid =
        (s.admissionFeePaid || 0) +
        (s.registrationFee || 0) +
        (Array.isArray(s.emis)
            ? s.emis.reduce((sum, e) => sum + (e.paidAmount || 0), 0)
            : 0);
    return Math.max(0, (s.courseFee || 0) - paid);
};
