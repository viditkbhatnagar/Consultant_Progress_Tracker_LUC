// Rate limiter for the Export Center's heavy endpoints. Plan §13.9.
// Keyed per authenticated user (falls back to IP if `req.user` isn't set —
// happens when the limiter runs before `protect`, e.g. inside a unit test).
const rateLimit = require('express-rate-limit');

function makeExportPivotLimiter(opts = {}) {
    return rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const id = req.user && req.user._id ? req.user._id.toString() : null;
            return id || req.ip || 'anon';
        },
        message: {
            success: false,
            message: 'Too many requests — limit is 5 per minute for this endpoint. Try again shortly.',
        },
        ...opts,
    });
}

const exportPivotLimiter = makeExportPivotLimiter();

module.exports = { exportPivotLimiter, makeExportPivotLimiter };
