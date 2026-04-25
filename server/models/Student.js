const mongoose = require('mongoose');
const {
    ORGANIZATIONS,
    ORG_LUC,
    isSkillhub,
    isLuc,
} = require('../config/organizations');

const SKILLHUB_SUBJECTS = [
    'Math',
    'Science',
    'Physics',
    'Chemistry',
    'Biology',
    'Accounting',
    'Business Studies',
    'Economics',
    'English',
    'JEE',
    'NEET',
];
const SKILLHUB_CURRICULA = [
    'CBSE',
    'IGCSE-Cambridge',
    'IGCSE-Edexcel',
    'IGCSE-AQA',
];
const SKILLHUB_MODES = ['Online', 'Offline', 'Hybrid', 'OneToOne'];
const SKILLHUB_COURSE_DURATIONS = ['Monthly', 'OneYear', 'TwoYears'];
const SKILLHUB_LEAD_SOURCES = [
    'Google',
    'FacebookMeta',
    'Instagram',
    'School',
    'Reference',
    'Walk-In',
    'Tele-Inquiry',
];
const STUDENT_STATUSES = ['new_admission', 'active', 'inactive'];
const ACADEMIC_YEARS = ['2024-25', '2025-26', '2026-27'];

const lucOnly = function () {
    return isLuc(this.organization);
};
const skillhubOnly = function () {
    return isSkillhub(this.organization);
};

const ContactSchema = new mongoose.Schema(
    {
        student: { type: String, default: '', trim: true },
        mother: { type: String, default: '', trim: true },
        father: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const EmiSchema = new mongoose.Schema({
    dueDate: { type: Date },
    amount: { type: Number, default: 0, min: 0 },
    paidOn: { type: Date, default: null },
    paidAmount: { type: Number, default: 0, min: 0 },
});

const StudentSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_LUC,
            required: true,
            index: true,
        },
        // Serial — scoped per team (LUC) or per org (Skillhub)
        sno: {
            type: Number,
            required: true,
        },
        // Month — auto from closing date (LUC)
        month: {
            type: String,
            required: lucOnly,
        },

        // ── Common identity ─────────────────────────────────────────────
        studentName: {
            type: String,
            required: [true, 'Please add student name'],
            trim: true,
        },
        gender: {
            type: String,
            enum: ['Male', 'Female'],
            required: [true, 'Please select gender'],
        },
        dob: { type: Date },
        phone: { type: String, default: '', trim: true },
        email: { type: String, default: '', trim: true, lowercase: true },
        // Skillhub-only: 3-contact phones/emails
        phones: { type: ContactSchema, default: () => ({}) },
        emails: { type: ContactSchema, default: () => ({}) },

        // ── LUC academic info ───────────────────────────────────────────
        program: { type: String, required: lucOnly, trim: true },
        university: {
            type: String,
            enum: [
                'Swiss School of Management (SSM)',
                'Knights College',
                'Malaysia University of Science & Technology (MUST)',
                'AGI – American Global Institute (Certifications)',
                'CMBS',
                'OTHM',
            ],
            required: lucOnly,
        },

        // ── Skillhub academic info ──────────────────────────────────────
        studentStatus: {
            type: String,
            enum: STUDENT_STATUSES,
            default: 'new_admission',
            index: true,
        },
        // Manually entered by the counselor on the New Admission form.
        // Required + unique for Skillhub records.
        enrollmentNumber: {
            type: String,
            index: true,
            sparse: true,
            unique: true,
            required: skillhubOnly,
            trim: true,
        },
        curriculum: {
            type: String,
            enum: SKILLHUB_CURRICULA,
            required: skillhubOnly,
        },
        curriculumSlug: { type: String, enum: ['IGCSE', 'CBSE'] },
        yearOrGrade: { type: String, required: skillhubOnly, trim: true },
        academicYear: {
            type: String,
            enum: ACADEMIC_YEARS,
            required: skillhubOnly,
        },
        subjects: {
            type: [{ type: String, enum: SKILLHUB_SUBJECTS }],
            default: [],
        },
        school: { type: String, default: '', trim: true },
        mode: {
            type: String,
            enum: SKILLHUB_MODES,
            required: skillhubOnly,
        },
        courseDuration: {
            type: String,
            enum: SKILLHUB_COURSE_DURATIONS,
            required: skillhubOnly,
        },

        // ── Fees ────────────────────────────────────────────────────────
        courseFee: {
            type: Number,
            required: lucOnly,
            min: 0,
            default: 0,
        },
        admissionFeePaid: { type: Number, default: 0, min: 0 },
        registrationFee: { type: Number, default: 0, min: 0 },
        emis: { type: [EmiSchema], default: [] },

        // ── Lead source ─────────────────────────────────────────────────
        source: {
            type: String,
            enum: [
                'Google Ads',
                'Facebook',
                'Tik Tok',
                'Call-In',
                'Old Crm',
                'Linkedin',
                'Whatsapp',
                'Alumni',
                'Seo',
                'Instagram',
                'Reference',
                'B2C',
                'Open Day',
                'Re-Registration',
            ],
            required: lucOnly,
        },
        leadSource: { type: String, enum: SKILLHUB_LEAD_SOURCES },
        referredBy: { type: String, default: '', trim: true },
        openDay: { type: String, default: '', trim: true },
        openDayLocation: { type: String, default: '', trim: true },
        campaignName: {
            type: String,
            required: lucOnly,
            trim: true,
            default: '',
        },

        // ── Dates & conversions ─────────────────────────────────────────
        enquiryDate: { type: Date, required: lucOnly },
        closingDate: { type: Date, required: lucOnly },
        dateOfEnrollment: { type: Date },
        conversionTime: { type: Number, default: 0 },

        // ── Counselor / Team Assignment ─────────────────────────────────
        consultantName: {
            type: String,
            required: [true, 'Please select consultant'],
            trim: true,
        },
        consultant: {
            type: mongoose.Schema.ObjectId,
            ref: 'Consultant',
        },
        teamLeadName: { type: String, required: true, trim: true },
        teamLead: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true,
        },
        teamName: { type: String, required: true, trim: true },

        // ── LUC profile fields (residence + professional) ───────────────
        residence: { type: String, required: lucOnly, trim: true, default: '' },
        area: { type: String, required: lucOnly, trim: true, default: '' },
        nationality: { type: String, required: lucOnly, trim: true, default: '' },
        region: { type: String, default: '', trim: true },
        // Skillhub-specific address
        addressEmirate: { type: String, default: '', trim: true },
        // LUC-specific professional info
        companyName: { type: String, required: lucOnly, trim: true, default: '' },
        designation: { type: String, required: lucOnly, trim: true, default: '' },
        experience: { type: Number, required: lucOnly, min: 0, default: 0 },
        industryType: { type: String, required: lucOnly, trim: true, default: '' },
        deptType: { type: String, required: lucOnly, trim: true, default: '' },

        // ── Audit ───────────────────────────────────────────────────────
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Pre-validate hook: derive computed fields before validation so that
// required checks on `sno`, `month`, and `enrollmentNumber` can pass.
StudentSchema.pre('validate', async function () {
    // LUC: conversion time + month from enquiry/closing dates
    if (isLuc(this.organization)) {
        if (this.enquiryDate && this.closingDate) {
            const diffMs = Math.abs(
                new Date(this.closingDate) - new Date(this.enquiryDate)
            );
            this.conversionTime = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
        if (this.closingDate) {
            const months = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
            ];
            this.month = months[new Date(this.closingDate).getMonth()];
        }
    }

    // Skillhub: derive curriculumSlug from the chosen curriculum. Enrollment
    // numbers are now entered manually by the counselor — no auto-generation.
    if (isSkillhub(this.organization)) {
        if (this.curriculum) {
            this.curriculumSlug = this.curriculum.startsWith('IGCSE')
                ? 'IGCSE'
                : 'CBSE';
        }

        if (this.enquiryDate && this.closingDate) {
            const diffMs = Math.abs(
                new Date(this.closingDate) - new Date(this.enquiryDate)
            );
            this.conversionTime = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
    }
});

// Static: next per-team or per-org SNO
StudentSchema.statics.getNextSno = async function (teamLeadId, organization) {
    const filter = organization && organization !== ORG_LUC
        ? { organization }
        : { teamLead: teamLeadId };
    const last = await this.findOne(filter).sort({ sno: -1 }).select('sno');
    return last ? last.sno + 1 : 1;
};

// Virtual: Skillhub outstanding amount
StudentSchema.virtual('outstandingAmount').get(function () {
    if (!isSkillhub(this.organization)) return 0;
    const paidEmi = (this.emis || []).reduce(
        (sum, e) => sum + (e.paidAmount || 0),
        0
    );
    const totalPaid =
        (this.admissionFeePaid || 0) +
        (this.registrationFee || 0) +
        paidEmi;
    return Math.max(0, (this.courseFee || 0) - totalPaid);
});

// Indexes
StudentSchema.index({ teamLead: 1, closingDate: -1 });
StudentSchema.index({ consultantName: 1 });
StudentSchema.index({ closingDate: -1 });
StudentSchema.index({ month: 1 });
StudentSchema.index({ source: 1 });
StudentSchema.index({ program: 1 });
StudentSchema.index({ organization: 1, studentStatus: 1 });
// Export Center pivot indexes (plan §9). Mongoose builds these in the
// background on app start; no migration needed.
StudentSchema.index({ organization: 1, source: 1, closingDate: -1 });
StudentSchema.index({ organization: 1, leadSource: 1, createdAt: -1 });
StudentSchema.index({ organization: 1, university: 1, program: 1 });

module.exports = mongoose.model('Student', StudentSchema);
