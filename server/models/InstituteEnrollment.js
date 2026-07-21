const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

// Who is on the class list for a (grade/year, subject), independent of whether
// they have been marked yet.
//
// Before this existed the roster was *derived* from attendance/test history, so
// a student only appeared on the list once they already had a mark. Adding
// someone and saving without ticking Present/Absent therefore wrote nothing and
// they silently vanished on reload — and marking them for one subject put them
// on every subject of that grade. This collection is the durable membership
// record; attendance rows remain the record of what actually happened.
const InstituteEnrollmentSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
            enum: ORGANIZATIONS,
            default: ORG_SKILLHUB_INSTITUTE,
            required: true,
            index: true,
        },
        gradeOrYear: { type: String, required: true, trim: true },
        subject: { type: String, default: '', trim: true },

        // `student` links to the admissions record when the counsellor picked a
        // real student; free-typed names keep it null and render "(unlinked)".
        student: { type: mongoose.Schema.ObjectId, ref: 'Student', default: null, index: true },
        studentName: { type: String, required: true, trim: true },

        addedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// One membership row per student per class. Unique so a double-click or a
// re-add is idempotent rather than duplicating the roster entry.
InstituteEnrollmentSchema.index(
    { organization: 1, gradeOrYear: 1, subject: 1, studentName: 1 },
    { unique: true }
);

module.exports = mongoose.model('InstituteEnrollment', InstituteEnrollmentSchema);
