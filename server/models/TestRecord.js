const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// One student's result in one weekly test, in the Skillhub Institute. A test
// session is keyed by (date, gradeOrYear, subject, testTopic); each student in
// the grade gets one row. `student` is a ref when the name matched a Student
// doc; `studentName` is always kept so unmatched/ad-hoc names still render.
// Mirrors Attendance.js — same org scoping, same denormalized teacher name.
const TestRecordSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_SKILLHUB_INSTITUTE,
            required: true,
            index: true,
        },
        date: { type: Date, required: true, index: true },

        student: { type: mongoose.Schema.ObjectId, ref: 'Student', default: null, index: true },
        studentName: { type: String, required: true, trim: true },

        gradeOrYear: { type: String, default: '', trim: true },
        curriculum: { type: String, default: '', trim: true }, // "CBSE" / "IGCSE" / "IGCSE Edexcel"…
        subject: { type: String, default: '', trim: true },
        testTopic: { type: String, default: '', trim: true }, // e.g. "Algebra — Quadratics"

        marksObtained: { type: Number, required: true, min: 0 },
        // Optional denominator so marks can render as X/Y with a percentage.
        // Left null when the branch only tracks the raw score.
        maxMarks: { type: Number, default: null, min: 0 },

        teacher: { type: mongoose.Schema.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, default: '', trim: true },

        markedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// One result per student per test session. This unique key backs the
// createTests upsert: it collapses a double-clicked / retried save to a single
// row instead of racing two inserts (a non-unique index can't). subject and
// testTopic default to '' so the key is always fully populated.
TestRecordSchema.index(
    { organization: 1, date: 1, gradeOrYear: 1, subject: 1, testTopic: 1, studentName: 1 },
    { unique: true }
);
// Reporting: by grade/subject, by date, by teacher, by student.
TestRecordSchema.index({ organization: 1, gradeOrYear: 1, subject: 1, date: 1 });
TestRecordSchema.index({ organization: 1, date: 1 });
TestRecordSchema.index({ organization: 1, teacherName: 1 });
TestRecordSchema.index({ student: 1, date: 1 });

module.exports = mongoose.model('TestRecord', TestRecordSchema);
