const Announcement = require('../models/Announcement');
const { emitToOrg } = require('./realtime');
const { isLuc } = require('../config/organizations');

const ANNOUNCEMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // banners auto-expire after 7 days

// Shape sent over the wire (socket payload + REST list rows). Keeps the
// acknowledgedBy array and other internals off the client.
function toPayload(ann) {
    return {
        _id: ann._id,
        type: ann.type,
        priority: ann.priority,
        title: ann.title,
        message: ann.message,
        meta: ann.meta || {},
        createdAt: ann.createdAt,
    };
}

// Fire a high-priority "new admission" announcement to the whole org.
// LUC-only for now (the admissions feature is LUC-centric). Best-effort:
// callers wrap this in try/catch so a failure here never blocks the
// admission itself.
async function announceAdmission({ student, actorName } = {}) {
    if (!student || !isLuc(student.organization)) return null;
    const who = student.consultantName || student.teamLeadName || actorName || 'Someone';
    const what = student.studentName || 'a new student';
    const extra = student.program
        ? ` · ${student.program}${student.university ? ` (${student.university})` : ''}`
        : '';
    const ann = await Announcement.create({
        organization: student.organization,
        type: 'admission',
        priority: 'high',
        title: '🎉 New Admission',
        message: `${who} closed an admission — ${what}${extra}`,
        meta: {
            studentId: student._id,
            studentName: student.studentName,
            consultantName: student.consultantName,
            teamName: student.teamName,
            program: student.program,
            university: student.university,
        },
        expiresAt: new Date(Date.now() + ANNOUNCEMENT_TTL_MS),
    });
    emitToOrg(student.organization, 'announcement', toPayload(ann));
    return ann;
}

module.exports = { announceAdmission, toPayload };
