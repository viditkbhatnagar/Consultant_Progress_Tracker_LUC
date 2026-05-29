const Announcement = require('../models/Announcement');
const { toPayload } = require('../services/announcer');

// @desc    Active (non-expired) announcements for the caller's org that the
//          caller hasn't acknowledged yet — drives the dashboard banner.
// @route   GET /api/announcements/active
// @access  Private (any authenticated user)
exports.getActive = async (req, res) => {
    try {
        const now = new Date();
        const docs = await Announcement.find({
            organization: req.user.organization,
            $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
            'acknowledgedBy.user': { $ne: req.user.id },
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        res.json({ success: true, data: docs.map(toPayload) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to load announcements' });
    }
};

// @desc    Current user acknowledges (dismisses) an announcement. Idempotent —
//          the guard prevents duplicate ack entries.
// @route   POST /api/announcements/:id/ack
// @access  Private
exports.acknowledge = async (req, res) => {
    try {
        await Announcement.updateOne(
            { _id: req.params.id, 'acknowledgedBy.user': { $ne: req.user.id } },
            { $push: { acknowledgedBy: { user: req.user.id, at: new Date() } } }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to acknowledge announcement' });
    }
};
