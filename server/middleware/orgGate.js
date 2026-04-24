// Gate a route to a specific organization. Must run after `protect`, which
// sets req.user. Returns 403 for any user whose organization doesn't match.
// Usage: app.use('/program-docs', protect, orgGate('luc'), express.static(...))
module.exports = (org) => (req, res, next) => {
    if (req.user && req.user.organization === org) return next();
    return res.status(403).json({
        success: false,
        message: `This resource is restricted to ${org} users.`,
    });
};
