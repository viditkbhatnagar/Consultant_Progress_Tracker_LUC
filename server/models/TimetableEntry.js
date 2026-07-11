const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// A recurring weekly class session in the Skillhub Institute timetable — one
// row of a teacher's schedule sheet. The "Grade / Student" column in the
// source mixes grades ("Grade 9"), individual students ("Mitali"), and pairs
// ("Deneth / Mohd. Thekkil"), so we keep the raw `studentLabel` AND resolve
// `students` (refs) by name where possible. Times are stored as raw text
// (source formats are inconsistent) plus a parsed `startMinutes` for sorting.
const TimetableEntrySchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_SKILLHUB_INSTITUTE,
            required: true,
            index: true,
        },
        teacher: { type: mongoose.Schema.ObjectId, ref: 'Teacher', required: true, index: true },
        teacherName: { type: String, default: '', trim: true },

        dayOfWeek: { type: String, enum: DAYS, required: true },
        time: { type: String, required: true, trim: true }, // raw, e.g. "12.30 pm - 1.30 pm"
        startMinutes: { type: Number, default: null }, // parsed minutes-from-midnight for ordering

        gradeOrYear: { type: String, default: '', trim: true }, // "Grade 9" / "Year 10" / "G11"
        curriculum: { type: String, default: '', trim: true }, // "CBSE" / "IGCSE Edexcel" / "Cambridge"…
        subject: { type: String, default: '', trim: true },

        studentLabel: { type: String, default: '', trim: true }, // raw "Grade / Student" cell
        students: [{ type: mongoose.Schema.ObjectId, ref: 'Student' }],

        createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

TimetableEntrySchema.index({ organization: 1, teacher: 1 });
TimetableEntrySchema.index({ organization: 1, dayOfWeek: 1, startMinutes: 1 });
TimetableEntrySchema.index({ organization: 1, gradeOrYear: 1 });

TimetableEntrySchema.statics.DAYS = DAYS;

module.exports = mongoose.model('TimetableEntry', TimetableEntrySchema);
