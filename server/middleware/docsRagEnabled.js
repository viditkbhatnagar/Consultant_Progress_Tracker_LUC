// Emergency kill switch for the Docs RAG feature. Reads both the parsed
// config and the raw env var on every request — config.enabled is frozen
// at module load, but process.env is live, so either signal flips the
// feature off. In production the usual lever is flipping the Render env
// var and letting the service restart (~90 s), which updates both.
//
// Order is deliberate: mount this BEFORE `protect` on /program-docs so
// disabled means disabled — we don't want to reveal the 401/403 distinction
// while the feature is down.

const config = require('../config/docsRagConfig');

const isDisabled = () =>
    config.enabled === false || process.env.DOCS_RAG_ENABLED === 'false';

module.exports = (req, res, next) => {
    if (isDisabled()) {
        return res.status(503).json({
            success: false,
            message:
                'Program docs chatbot is temporarily disabled. Please check with your team lead.',
        });
    }
    next();
};

module.exports.isDisabled = isDisabled;
