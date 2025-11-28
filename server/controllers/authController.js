const User = require('../models/User');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Private/Admin
exports.register = async (req, res, next) => {
    try {
        const { email, password, name, role, teamLead, teamName, phone } = req.body;

        // Validation
        if (!email || !password || !name || !role) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields',
            });
        }

        // Team lead validation
        if (role === 'consultant' && !teamLead) {
            return res.status(400).json({
                success: false,
                message: 'Consultant must be assigned to a team lead',
            });
        }

        if (role === 'team_lead' && !teamName) {
            return res.status(400).json({
                success: false,
                message: 'Team lead must have a team name',
            });
        }

        // Create user
        const user = await User.create({
            email,
            password,
            name,
            role,
            teamLead: role === 'consultant' ? teamLead : null,
            teamName: role === 'team_lead' ? teamName : null,
            phone,
        });

        sendTokenResponse(user, 201, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password',
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
            });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
    res.status(200).json({
        success: true,
        data: {},
        message: 'Logged out successfully',
    });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).populate('teamLead', 'name email');

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        if (!(await user.matchPassword(req.body.currentPassword))) {
            return res.status(401).json({
                success: false,
                message: 'Password is incorrect',
            });
        }

        user.password = req.body.newPassword;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            teamName: user.teamName,
            teamLead: user.teamLead,
        },
    });
};
