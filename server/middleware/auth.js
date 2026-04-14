const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route',
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id);

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        if (!req.user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User account is deactivated',
            });
        }

        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route',
        });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role '${req.user.role}' is not authorized to access this route`,
            });
        }
        next();
    };
};

// Build a Mongoose filter that scopes a query to the requesting user's
// organization and ownership. Admin sees all orgs unless they opt into
// ?organization=X. team_lead and skillhub roles are scoped to docs they own
// via teamLead FK. manager is scoped to its own organization.
exports.buildScopeFilter = (req) => {
    const user = req.user;
    const filter = {};

    if (user.role === 'admin') {
        if (req.query && req.query.organization) {
            filter.organization = req.query.organization;
        }
    } else {
        filter.organization = user.organization;
    }

    if (user.role === 'team_lead' || user.role === 'skillhub') {
        filter.teamLead = user._id;
    }

    return filter;
};

// Check whether a user is allowed to read/write a given document.
// Admin always allowed. Others must match org; team_lead/skillhub must also
// match ownership (teamLead FK).
exports.canAccessDoc = (user, doc) => {
    if (!doc) return false;
    if (user.role === 'admin') return true;
    if (doc.organization && doc.organization !== user.organization) return false;
    if (user.role === 'team_lead' || user.role === 'skillhub') {
        const ownerId = doc.teamLead?._id || doc.teamLead;
        if (!ownerId || ownerId.toString() !== user._id.toString()) return false;
    }
    return true;
};

// Resolve the organization to set on a new document.
// Non-admin: uses user.organization (ignores body).
// Admin: uses body.organization or defaults to 'luc'.
exports.resolveOrganization = (req) => {
    if (req.user.role === 'admin') {
        return req.body.organization || 'luc';
    }
    return req.user.organization;
};
