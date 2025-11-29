const Commitment = require('../models/Commitment');
const User = require('../models/User');

// @desc    Get commitments
// @route   GET /api/commitments
// @access  Private
exports.getCommitments = async (req, res, next) => {
    try {
        let query;
        const { weekNumber, year, status } = req.query;

        // Role-based filtering (only team_lead and admin remain)
        if (req.user.role === 'team_lead') {
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
            .populate('teamLead', 'name email');

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        // Authorization check (only team_lead and admin now)
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
        // Team leads create commitments for their consultants
        if (req.user.role === 'team_lead') {
            // Team lead is creating commitment, set team info from their profile
            req.body.teamLead = req.user.id;
            req.body.teamName = req.user.teamName;
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;
        } else if (req.user.role === 'admin') {
            // Admin can create commitments, need to verify team lead exists
            if (!req.body.teamLead || !req.body.teamName) {
                return res.status(400).json({
                    success: false,
                    message: 'Team lead and team name are required',
                });
            }
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;
        }

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

        // Authorization check (no consultant role anymore)
        if (req.user.role === 'team_lead') {
            // Team lead can only update their team's commitments
            if (commitment.teamLead.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update this commitment',
                });
            }
        }
        // Admin can update anything (no check needed)

        // Update last modified info
        req.body.lastUpdatedBy = req.user.id;

        commitment = await Commitment.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        }).populate('teamLead', 'name email');

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
        if (req.user.role === 'team_lead') {
            query.teamLead = req.user.id;
        }

        const commitments = await Commitment.find(query)
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

// @desc    Get commitments by date range
// @route   GET /api/commitments/date-range
// @access  Private
exports.getCommitmentsByDateRange = async (req, res, next) => {
    try {
        const { startDate, endDate, consultantId } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        let query = {
            weekStartDate: { $gte: new Date(startDate) },
            weekEndDate: { $lte: new Date(endDate) },
        };

        // Role-based filtering (only team_lead and admin)
        if (req.user.role === 'team_lead') {
            query.teamLead = req.user.id;
        }
        // Admin sees all by default

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email')
            .sort('-weekStartDate');

        res.status(200).json({
            success: true,
            count: commitments.length,
            data: commitments,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get consultant performance details  
// @route   GET /api/commitments/consultant/:consultantName/performance
// @access  Private (Team Lead/Admin)
exports.getConsultantPerformance = async (req, res, next) => {
    try {
        const { consultantName } = req.params;
        const { months = 3 } = req.query; // Default to last 3 months

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(months));

        let query = {
            consultantName: consultantName,
            weekStartDate: { $gte: startDate },
            weekEndDate: { $lte: endDate },
        };

        // Team lead can only view their team members
        if (req.user.role === 'team_lead') {
            query.teamLead = req.user.id;
        }

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email teamName')
            .sort('weekStartDate');

        // Calculate monthly aggregates
        const monthlyStats = {};
        commitments.forEach(c => {
            const monthKey = `${c.year}-${String(c.weekStartDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                    month: monthKey,
                    total: 0,
                    achieved: 0,
                    meetings: 0,
                    closed: 0,
                    commitments: [],
                };
            }
            monthlyStats[monthKey].total++;
            monthlyStats[monthKey].meetings += c.meetingsDone || 0;
            if (c.status === 'achieved' || c.admissionClosed) monthlyStats[monthKey].achieved++;
            if (c.admissionClosed) monthlyStats[monthKey].closed++;
            monthlyStats[monthKey].commitments.push(c);
        });

        res.status(200).json({
            success: true,
            consultant: { name: consultantName }, // Return consultant name as object for compatibility
            totalCommitments: commitments.length,
            monthlyStats: Object.values(monthlyStats),
            allCommitments: commitments,
        });
    } catch (error) {
        next(error);
    }
};
