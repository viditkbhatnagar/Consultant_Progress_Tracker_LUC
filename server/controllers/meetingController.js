const Meeting = require('../models/Meeting');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');

// Resolve consultant + team lead display names so the Meeting doc carries
// a stable historical label even if the referenced entities are later
// deleted. Mirrors the denormalization pattern used by Commitment.
//
// `consultant` may be null when the TL themselves conducted the meeting;
// in that case we trust the consultantName the client sent, and the form
// sets it to the TL's name.
async function denormalizeNames(body) {
    if (body.consultant) {
        const consultant = await Consultant.findById(body.consultant);
        if (!consultant) {
            return { ok: false, error: 'Consultant not found' };
        }
        body.consultantName = consultant.name;
    }
    if (body.teamLead) {
        const tl = await User.findById(body.teamLead);
        if (!tl) {
            return { ok: false, error: 'Team lead not found' };
        }
        body.teamLeadName = tl.name;
        // If the TL is also the one who conducted the meeting (no consultant
        // ref), default consultantName to the TL's name when the client
        // didn't supply one.
        if (!body.consultant && !body.consultantName) {
            body.consultantName = tl.name;
        }
    }
    return { ok: true };
}

// @desc    List meetings (paginated)
// @route   GET /api/meetings
// @access  Private (admin, team_lead)
exports.getMeetings = async (req, res, next) => {
    try {
        const {
            page: pageParam,
            limit: limitParam,
            startDate,
            endDate,
            teamLead,
            consultant,
            status,
            mode,
            search,
        } = req.query;

        const page = Math.max(parseInt(pageParam, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100);

        const filter = buildScopeFilter(req);

        if (startDate || endDate) {
            filter.meetingDate = {};
            if (startDate) filter.meetingDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.meetingDate.$lte = end;
            }
        }

        // Admin-only filter by specific TL; non-admin is already scoped by
        // buildScopeFilter so this would be a no-op (or collide with their
        // own teamLead filter). Guard to admin to keep it predictable.
        if (teamLead && req.user.role === 'admin') {
            filter.teamLead = teamLead;
        }
        if (consultant) filter.consultant = consultant;
        if (status) filter.status = status;
        if (mode) filter.mode = mode;
        if (search) {
            filter.studentName = { $regex: search, $options: 'i' };
        }

        const [total, data] = await Promise.all([
            Meeting.countDocuments(filter),
            Meeting.find(filter)
                .populate('teamLead', 'name email teamName')
                .populate('consultant', 'name')
                .sort({ meetingDate: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(Math.ceil(total / limit), 1),
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeeting = async (req, res, next) => {
    try {
        const meeting = await Meeting.findById(req.params.id)
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name');

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        if (!canAccessDoc(req.user, meeting)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this meeting',
            });
        }

        res.status(200).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Create meeting
// @route   POST /api/meetings
// @access  Private (admin, team_lead)
exports.createMeeting = async (req, res, next) => {
    try {
        if (req.user.role === 'team_lead') {
            req.body.teamLead = req.user.id;
            req.body.organization = req.user.organization;
        } else if (req.user.role === 'admin') {
            if (!req.body.teamLead) {
                return res.status(400).json({
                    success: false,
                    message: 'Team lead is required',
                });
            }
            req.body.organization = resolveOrganization(req);
        }

        req.body.createdBy = req.user.id;
        req.body.lastUpdatedBy = req.user.id;

        const resolved = await denormalizeNames(req.body);
        if (!resolved.ok) {
            return res.status(400).json({ success: false, message: resolved.error });
        }

        const meeting = await Meeting.create(req.body);

        res.status(201).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private (admin, team_lead)
exports.updateMeeting = async (req, res, next) => {
    try {
        let meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        if (!canAccessDoc(req.user, meeting)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this meeting',
            });
        }

        // Non-admins cannot reassign ownership.
        if (req.user.role !== 'admin') {
            delete req.body.teamLead;
            delete req.body.organization;
        }

        req.body.lastUpdatedBy = req.user.id;

        const resolved = await denormalizeNames(req.body);
        if (!resolved.ok) {
            return res.status(400).json({ success: false, message: resolved.error });
        }

        meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        })
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name');

        res.status(200).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private (Admin only)
exports.deleteMeeting = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete meetings. Only admins can delete.',
            });
        }

        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        await meeting.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
            data: {},
        });
    } catch (error) {
        next(error);
    }
};
