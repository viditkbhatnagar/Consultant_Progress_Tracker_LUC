const mongoose = require('mongoose');
const { ORGANIZATIONS, ORG_LUC } = require('../config/organizations');

// Org-wide broadcast announcement.
//
// Unlike Notification (one row per user, passive — only seen if you open the
// bell), an Announcement is a single doc that EVERYONE in the org sees as a
// prominent dashboard banner until they personally acknowledge it. That's the
// "visible to everyone, not a normal notification" guarantee:
//   - high priority  -> app-wide banner + live toast (+ bell, future)
//   - normal         -> quiet (bell only, future)
//
// Visibility is guaranteed by persistence: getActive serves it on every page
// load, so users who were offline when it fired still see the banner next time
// they open the tracker. Per-user `acknowledgedBy` keeps it pinned until each
// person dismisses it (it can't scroll away or vanish after one render).
const AnnouncementSchema = new mongoose.Schema(
    {
        organization: { type: String, enum: ORGANIZATIONS, default: ORG_LUC, required: true },
        type: { type: String, enum: ['admission', 'manual', 'tier'], default: 'manual' },
        priority: { type: String, enum: ['normal', 'high'], default: 'high' },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        // Free-form context (studentId, consultantName, teamName, program, …).
        meta: { type: mongoose.Schema.Types.Mixed, default: {} },
        // null for system-generated (auto on admission); set for manual posts.
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        // Per-user acknowledgement — the banner stays until each user dismisses it.
        acknowledgedBy: [
            {
                _id: false,
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                at: { type: Date, default: Date.now },
            },
        ],
        // Auto-expire so old banners don't accumulate (set by the creator).
        expiresAt: { type: Date },
    },
    { timestamps: true }
);

AnnouncementSchema.index({ organization: 1, createdAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
