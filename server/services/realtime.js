// Real-time sync layer (Socket.IO). Attaches to the existing HTTP server,
// authenticates each socket with the SAME JWT used by `protect`, and lets
// controllers broadcast lightweight "something changed" events so open
// dashboards re-fetch. Events carry thin identifiers (ids + year/month),
// not computed rows — clients re-run their normal aggregate fetch.
//
// Degrades gracefully: if init fails or IO is absent (e.g. test mode), the
// emit helpers are no-ops and the REST API is unaffected.

const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

// Attach Socket.IO to the http.Server. Safe to skip in test mode.
function initRealtime(server) {
    if (process.env.NODE_ENV === 'test') return null;
    let Server;
    try {
        ({ Server } = require('socket.io'));
    } catch (e) {
        console.warn('[realtime] socket.io not installed — real-time sync disabled');
        return null;
    }

    io = new Server(server, {
        // Reflect the request origin (covers dev 3001→5001 and same-origin
        // prod). Mirrors the permissive cors() already used by the API.
        cors: { origin: true, credentials: true },
        path: '/socket.io',
    });

    // Authenticate every socket with the same JWT as the REST API.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth && socket.handshake.auth.token;
            if (!token) return next(new Error('No auth token'));
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('role organization isActive name');
            if (!user || !user.isActive) return next(new Error('Invalid or inactive user'));
            socket.data.user = {
                id: String(user._id),
                role: user.role,
                organization: user.organization,
            };
            return next();
        } catch (err) {
            return next(new Error('Socket auth failed'));
        }
    });

    io.on('connection', (socket) => {
        const u = socket.data.user;
        // Org room — every tracker/dashboard consumer for this org.
        socket.join(`org:${u.organization}`);
        // Admin-only dashboard room (forward-compatible; admin dashboards
        // are the only consumers today).
        if (u.role === 'admin') socket.join(`org:${u.organization}:admin`);
        // Team-lead room for the future read-only TL unlock.
        if (u.role === 'team_lead') socket.join(`org:${u.organization}:team:${u.id}`);
    });

    console.log('[realtime] socket.io attached');
    return io;
}

// Generic org broadcast. No-op when IO is unavailable.
function emitToOrg(organization, event, payload) {
    if (!io || !organization) return;
    io.to(`org:${organization}`).emit(event, payload || {});
}

// Convenience wrappers used by controllers.
function emitTeamEntry(organization, type, payload) {
    emitToOrg(organization, `teamEntry:${type}`, payload);
}
function emitConsultant(organization, type, payload) {
    emitToOrg(organization, `consultant:${type}`, payload);
}
function emitUser(organization, type, payload) {
    emitToOrg(organization, `user:${type}`, payload);
}

module.exports = {
    initRealtime,
    emitToOrg,
    emitTeamEntry,
    emitConsultant,
    emitUser,
    // exposed for tests / introspection
    _getIo: () => io,
};
