const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// One student's attendance for one class session on one date, in the Skillhub
// Institute. Keyed by (date, gradeOrYear, subject, student). `student` is a
// ref when the name matched a Student doc; `studentName` is always kept so
// unmatched/legacy names still render. Marked by the branch login or admin.
const AttendanceSchema = new mongoose.Schema(
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
        subject: { type: String, default: '', trim: true },
        curriculum: { type: String, default: '', trim: true },

        teacher: { type: mongoose.Schema.ObjectId, ref: 'Teacher', default: null },
        teacherName: { type: String, default: '', trim: true },

        status: { type: String, enum: ['Present', 'Absent'], required: true },
        markedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// The marking view queries by (org, grade/year, subject, date); reporting by
// student or date. Not unique — a class can legitimately have multiple rows.
AttendanceSchema.index({ organization: 1, gradeOrYear: 1, subject: 1, date: 1 });
AttendanceSchema.index({ organization: 1, date: 1 });
AttendanceSchema.index({ student: 1, date: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
