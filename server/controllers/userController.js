const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        let query;

        // Role-based filtering
        if (req.user.role === 'team_lead') {
            // Team lead can only see their consultants
            query = User.find({ teamLead: req.user.id });
        } else if (req.user.role === 'admin') {
            // Admin can see all users
            query = User.find();
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view users',
            });
        }

        const users = await query.populate('teamLead', 'name email').sort('-createdAt');

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).populate('teamLead', 'name email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user',
            });
        }

        if (req.user.role === 'team_lead' && user.teamLead?.toString() !== req.user.id && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this user',
            });
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = async (req, res, next) => {
    try {
        let user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Check authorization
        if (req.user.role === 'consultant' && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user',
            });
        }

        if (req.user.role === 'team_lead' && req.user.id !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Team leads can only update their own profile',
            });
        }

        // Fields that can be updated
        const fieldsToUpdate = {
            name: req.body.name,
            phone: req.body.phone,
        };

        // Admin can update more fields
        if (req.user.role === 'admin') {
            fieldsToUpdate.role = req.body.role;
            fieldsToUpdate.teamLead = req.body.teamLead;
            fieldsToUpdate.teamName = req.body.teamName;
            fieldsToUpdate.isActive = req.body.isActive;
        }

        user = await User.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Soft delete - just deactivate
        user.isActive = false;
        await user.save();

        res.status(200).json({
            success: true,
            data: {},
            message: 'User deactivated successfully',
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get consultants by team lead
// @route   GET /api/users/team/:teamLeadId
// @access  Private/Admin/TeamLead
exports.getConsultantsByTeamLead = async (req, res, next) => {
    try {
        // Check authorization
        if (req.user.role === 'team_lead' && req.user.id !== req.params.teamLeadId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this team',
            });
        }

        const consultants = await User.find({
            teamLead: req.params.teamLeadId,
            role: 'consultant',
        }).sort('name');

        res.status(200).json({
            success: true,
            count: consultants.length,
            data: consultants,
        });
    } catch (error) {
        next(error);
    }
};
