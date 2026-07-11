const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// Faculty for the Skillhub Institute timetable/attendance feature. Teachers
// are records only (no login) — the branch login + admin manage them, their
// timetable, and mark attendance. Scoped to skillhub_institute.
const TeacherSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_SKILLHUB_INSTITUTE,
            required: true,
            index: true,
        },
        name: { type: String, required: [true, 'Teacher name is required'], trim: true },
        // Free-text subjects this teacher covers (Maths, English, Business Studies…).
        subjects: { type: [String], default: [] },
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

TeacherSchema.index({ organization: 1, name: 1 });

module.exports = mongoose.model('Teacher', TeacherSchema);
