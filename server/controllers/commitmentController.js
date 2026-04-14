const Commitment = require('../models/Commitment');
const User = require('../models/User');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');

// @desc    Get commitments
// @route   GET /api/commitments
// @access  Private
exports.getCommitments = async (req, res, next) => {
    try {
        const { weekNumber, year, status } = req.query;
        const query = buildScopeFilter(req);

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

        if (!canAccessDoc(req.user, commitment)) {
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
        // Team leads and skillhub branch logins create commitments owned by themselves
        if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            req.body.teamLead = req.user.id;
            req.body.teamName = req.user.teamName;
            req.body.organization = req.user.organization;
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;
        } else if (req.user.role === 'admin') {
            if (!req.body.teamLead || !req.body.teamName) {
                return res.status(400).json({
                    success: false,
                    message: 'Team lead and team name are required',
                });
            }
            req.body.organization = resolveOrganization(req);
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;
        }

        // Auto-set fields when admission is being closed
        if (req.body.admissionClosed === true) {
            req.body.admissionClosedDate = new Date();
            req.body.status = 'achieved';
            req.body.achievementPercentage = 100;
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

        if (!canAccessDoc(req.user, commitment)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this commitment',
            });
        }

        // Auto-set fields when closing admission (only if not already closed)
        if (req.body.admissionClosed === true && !commitment.admissionClosed) {
            req.body.admissionClosedDate = new Date();
            req.body.status = 'achieved';
            req.body.achievementPercentage = 100;
        }

        // Prevent reopening once closed
        if (commitment.admissionClosed === true && req.body.admissionClosed === false) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reopen a closed admission - this action is irreversible',
            });
        }

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

// @desc    Delete commitment
// @route   DELETE /api/commitments/:id
// @access  Private (Admin only)
exports.deleteCommitment = async (req, res, next) => {
    try {
        // Only admin can delete
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete commitments. Only admins can delete.',
            });
        }

        const commitment = await Commitment.findById(req.params.id);

        if (!commitment) {
            return res.status(404).json({
                success: false,
                message: 'Commitment not found',
            });
        }

        await commitment.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Commitment deleted successfully',
            data: {}
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

        if (!canAccessDoc(req.user, commitment)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this commitment',
            });
        }

        const { closedDate, closedAmount } = req.body;

        commitment.admissionClosed = true;
        commitment.admissionClosedDate = new Date();
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

        if (!canAccessDoc(req.user, commitment)) {
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

        const query = {
            ...buildScopeFilter(req),
            weekNumber: parseInt(weekNumber),
            year: parseInt(year),
        };

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

        const query = {
            ...buildScopeFilter(req),
            weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
        };

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
        const { months = 3, startDate: startParam, endDate: endParam } = req.query;

        // Use explicit date range when provided, otherwise fall back to months-based calculation
        let startDate, endDate;
        if (startParam && endParam) {
            startDate = new Date(startParam);
            endDate = new Date(endParam);
        } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - parseInt(months));
        }

        const query = {
            ...buildScopeFilter(req),
            consultantName: consultantName,
            weekStartDate: { $gte: startDate, $lte: endDate },
        };

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
