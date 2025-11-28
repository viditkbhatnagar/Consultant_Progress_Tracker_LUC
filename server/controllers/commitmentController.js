const Commitment = require('../models/Commitment');
const User = require('../models/User');

// @desc    Get commitments
// @route   GET /api/commitments
// @access  Private
exports.getCommitments = async (req, res, next) => {
    try {
        let query;
        const { weekNumber, year, status } = req.query;

        // Role-based filtering
        if (req.user.role === 'consultant') {
            // Consultants can only see their own commitments
            query = { consultant: req.user.id };
        } else if (req.user.role === 'team_lead') {
            // Team leads can see their team's commitments
            query = { teamLead: req.user.id };
        } else if (req.user.role === 'admin') {
            // Admin can see all commitments
            query = {};
        }

        // Filter by week if provided
        if (weekNumber && year) {
            query.weekNumber = parseInt(weekNumber);
            query.year = parseInt(year);
        }

        // Filter by status if provided
        if (status) {
            query.status = status;
        }

        const commitments = await Commitment.find(query)
            .populate('consultant', 'name email')
            .populate('teamLead', 'name email')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: commitments.length,
            data: commitments,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single commitment
// @route   GET /api/commitments/:id
// @access  Private
exports.getCommitment = async (req, res, next) => {
    try {
        const commitment = await Commitment.findById(req.params.id)
            .populate('consultant', 'name email')
            .populate('teamLead', 'name email');

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && commitment.consultant._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this commitment',
            });
        }

        if (req.user.role === 'team_lead' && commitment.teamLead._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this commitment',
            });
        }

        res.status(200).json({
            success: true,
            data: commitment,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new commitment
// @route   POST /api/commitments
// @access  Private/Consultant
exports.createCommitment = async (req, res, next) => {
    try {
        // Get consultant's team lead
        const consultant = await User.findById(req.user.id);

        if (!consultant.teamLead) {
            return res.status(400).json({
                success: false,
                message: 'You must be assigned to a team lead to create commitments',
            });
        }

        const teamLead = await User.findById(consultant.teamLead);

        // Add user info to req.body
        req.body.consultant = req.user.id;
        req.body.consultantName = req.user.name;
        req.body.teamLead = consultant.teamLead;
        req.body.teamName = teamLead.teamName;
        req.body.createdBy = req.user.id;
        req.body.lastUpdatedBy = req.user.id;

        const commitment = await Commitment.create(req.body);

        res.status(201).json({
            success: true,
            data: commitment,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update commitment
// @route   PUT /api/commitments/:id
// @access  Private
exports.updateCommitment = async (req, res, next) => {
    try {
        let commitment = await Commitment.findById(req.params.id);

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant') {
            if (commitment.consultant.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this commitment',
                });
            }

            // Consultants can update specific fields
            const allowedFields = [
                'commitmentAchieved',
                'meetingsDone',
                'achievementPercentage',
                'reasonForNotAchieving',
                'leadStage',
                'conversionProbability',
                'followUpDate',
                'followUpNotes',
                'admissionClosed',
                'closedDate',
                'closedAmount',
                'status',
            ];

            const updateData = {};
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            updateData.lastUpdatedBy = req.user.id;

            commitment = await Commitment.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );
        } else if (req.user.role === 'team_lead') {
            if (commitment.teamLead.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this commitment',
                });
            }

            // Team leads can add corrective actions and prospect ratings
            const allowedFields = [
                'commitmentVsAchieved',
                'correctiveActionByTL',
                'prospectForWeek',
            ];

            const updateData = {};
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            updateData.lastUpdatedBy = req.user.id;

            commitment = await Commitment.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );
        } else if (req.user.role === 'admin') {
            // Admin can update any field
            req.body.lastUpdatedBy = req.user.id;
            commitment = await Commitment.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
        }

        res.status(200).json({
            success: true,
            data: commitment,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete commitment (soft delete)
// @route   DELETE /api/commitments/:id
// @access  Private
exports.deleteCommitment = async (req, res, next) => {
    try {
        const commitment = await Commitment.findById(req.params.id);

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && commitment.consultant.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this commitment',
            });
        }

        if (req.user.role === 'team_lead' && commitment.teamLead.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this commitment',
            });
        }

        // Soft delete
        commitment.isActive = false;
        await commitment.save();

        res.status(200).json({
            success: true,
            data: {},
            message: 'Commitment deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark admission as closed
// @route   PATCH /api/commitments/:id/close
// @access  Private/Consultant
exports.closeAdmission = async (req, res, next) => {
    try {
        let commitment = await Commitment.findById(req.params.id);

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && commitment.consultant.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this commitment',
            });
        }

        const { closedDate, closedAmount } = req.body;

        commitment.admissionClosed = true;
        commitment.closedDate = closedDate || new Date();
        commitment.closedAmount = closedAmount;
        commitment.status = 'achieved';
        commitment.achievementPercentage = 100;
        commitment.leadStage = 'Admission';
        commitment.lastUpdatedBy = req.user.id;

        await commitment.save();

        res.status(200).json({
            success: true,
            data: commitment,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update meetings count
// @route   PATCH /api/commitments/:id/meetings
// @access  Private/Consultant
exports.updateMeetings = async (req, res, next) => {
    try {
        let commitment = await Commitment.findById(req.params.id);

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && commitment.consultant.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this commitment',
            });
        }

        const { meetingsDone } = req.body;

        commitment.meetingsDone = meetingsDone;
        commitment.lastUpdatedBy = req.user.id;

        await commitment.save();

        res.status(200).json({
            success: true,
            data: commitment,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get commitments for a specific week
// @route   GET /api/commitments/week/:weekNumber/:year
// @access  Private
exports.getWeekCommitments = async (req, res, next) => {
    try {
        const { weekNumber, year } = req.params;

        let query = {
            weekNumber: parseInt(weekNumber),
            year: parseInt(year),
        };

        // Role-based filtering
        if (req.user.role === 'consultant') {
            query.consultant = req.user.id;
        } else if (req.user.role === 'team_lead') {
            query.teamLead = req.user.id;
        }

        const commitments = await Commitment.find(query)
            .populate('consultant', 'name email')
            .populate('teamLead', 'name email')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: commitments.length,
            data: commitments,
        });
    } catch (error) {
        next(error);
    }
};
