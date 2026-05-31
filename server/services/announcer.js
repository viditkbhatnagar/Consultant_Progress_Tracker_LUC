const Announcement = require('../models/Announcement');
const { emitToOrg } = require('./realtime');
const { isLuc } = require('../config/organizations');

const ANNOUNCEMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // banners auto-expire after 7 days

// Shape sent over the wire (socket payload + REST list rows). Keeps the
// acknowledgedBy array and other internals off the client.
function toPayload(ann) {
    return {
        _id: ann._id,
        type: ann.type,
        priority: ann.priority,
        title: ann.title,
        message: ann.message,
        meta: ann.meta || {},
        createdAt: ann.createdAt,
    };
}

// Fire a high-priority "new admission" announcement when the admin logs
// admission counts on the All Teams (Executive Overview) grid. `courses` is a
// list of { name, delta } for the program/course buckets that INCREASED in
// that edit, so the alert carries the real new admissions (not a re-save).
// Org-wide, best-effort. LUC-only.
async function announceTeamAdmission({ organization = 'luc', teamName, consultantName, monthName, year, courses, actorName } = {}) {
    if (!isLuc(organization)) return null;
    const added = (courses || []).filter((c) => c && c.name && c.delta > 0);
    if (added.length === 0) return null;

    const total = added.reduce((sum, c) => sum + c.delta, 0);
    const detail = added.map((c) => `${c.delta} ${c.name}`).join(', ');
    const who = consultantName ? ` · ${consultantName}` : '';
    const when = monthName ? ` (${monthName}${year ? ` ${year}` : ''})` : '';

    const ann = await Announcement.create({
        organization,
        type: 'admission',
        priority: 'high',
        title: total > 1 ? '🎉 New Admissions' : '🎉 New Admission',
        message: `${teamName || 'A team'}${who} — ${detail}${when}`,
        meta: { teamName, consultantName, monthName, year, courses: added, total, actorName },
        expiresAt: new Date(Date.now() + ANNOUNCEMENT_TTL_MS),
    });
    emitToOrg(organization, 'announcement', toPayload(ann));
    return ann;
}

// Fire an org-wide announcement when the admin posts fresh tier standings.
// Everyone in the org (admin, team leads, managers) gets the dismissable banner
// no matter what page they're on — not just the Tier Fight tab. LUC-only.
async function announceTierImage({ organization = 'luc', tiers = [], monthName, year, actorName, headline, message, includeTiers = true } = {}) {
    if (!isLuc(organization)) return null;

    // The banner reflects whatever poster the admin made — a custom headline /
    // message, or the default tier-standings copy when none is given.
    const title = headline && headline.trim() ? `📣 ${headline.trim().slice(0, 60)}` : '🥊 Tier Fight';
    let body;
    if (message && message.trim()) {
        body = `${message.trim().slice(0, 160)} — open Tier Fight to see the poster.`;
    } else if (includeTiers) {
        const leader = [...tiers].sort((a, b) => (b.mtdAchieved || 0) - (a.mtdAchieved || 0))[0];
        const when = monthName ? ` (${monthName}${year ? ` ${year}` : ''})` : '';
        const lead = leader ? ` Tier ${leader.tier} is leading${when}.` : '';
        body = `New tier standings just posted!${lead} Open Tier Fight to see who's ahead.`;
    } else {
        body = 'A new poster was just posted — open Tier Fight to see it.';
    }

    const ann = await Announcement.create({
        organization,
        type: 'tier',
        priority: 'high',
        title,
        message: body,
        meta: { kind: 'tier-image', link: '/tiers', tiers: includeTiers ? tiers : [], monthName, year, actorName },
        expiresAt: new Date(Date.now() + ANNOUNCEMENT_TTL_MS),
    });
    emitToOrg(organization, 'announcement', toPayload(ann));
    return ann;
}

module.exports = { announceTeamAdmission, announceTierImage, toPayload };
