const Meeting = require('../models/Meeting');
const Consultant = require('../models/Consultant');
const User = require('../models/User');
const AIUsage = require('../models/AIUsage');
const Commitment = require('../models/Commitment');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');
const { isLuc } = require('../config/organizations');
const OpenAI = require('openai');

let _openai;
const getOpenAIClient = () => {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not configured on the server');
        }
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openai;
};

// Resolve consultant + team lead display names so the Meeting doc carries
// a stable historical label even if the referenced entities are later
// deleted. Mirrors the denormalization pattern used by Commitment.
//
// `consultant` may be null when the TL themselves conducted the meeting;
// in that case we trust the consultantName the client sent, and the form
// sets it to the TL's name.
async function denormalizeNames(body) {
    if (body.consultant) {
        const consultant = await Consultant.findById(body.consultant);
        if (!consultant) {
            return { ok: false, error: 'Consultant not found' };
        }
        body.consultantName = consultant.name;
    }
    if (body.teamLead) {
        const tl = await User.findById(body.teamLead);
        if (!tl) {
            return { ok: false, error: 'Team lead not found' };
        }
        body.teamLeadName = tl.name;
        // If the TL is also the one who conducted the meeting (no consultant
        // ref), default consultantName to the TL's name when the client
        // didn't supply one.
        if (!body.consultant && !body.consultantName) {
            body.consultantName = tl.name;
        }
    }
    return { ok: true };
}

// @desc    List meetings (paginated)
// @route   GET /api/meetings
// @access  Private (admin, team_lead)
exports.getMeetings = async (req, res, next) => {
    try {
        const {
            page: pageParam,
            limit: limitParam,
            startDate,
            endDate,
            teamLead,
            consultant,
            status,
            mode,
            search,
        } = req.query;

        const page = Math.max(parseInt(pageParam, 10) || 1, 1);
        // Meeting Tracker now defaults to "show all" — callers can pass a
        // large limit when they want every matching row. Cap at 20,000 so
        // a malicious/mistaken query can't eat the server.
        const limit = Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 20000);

        const filter = buildScopeFilter(req);

        if (startDate || endDate) {
            filter.meetingDate = {};
            if (startDate) filter.meetingDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.meetingDate.$lte = end;
            }
        }

        // Admin-only filter by specific TL; non-admin is already scoped by
        // buildScopeFilter so this would be a no-op (or collide with their
        // own teamLead filter). Guard to admin to keep it predictable.
        if (teamLead && req.user.role === 'admin') {
            filter.teamLead = teamLead;
        }
        if (consultant) filter.consultant = consultant;
        if (status) filter.status = status;
        if (mode) filter.mode = mode;
        if (search) {
            filter.studentName = { $regex: search, $options: 'i' };
        }

        const [total, data] = await Promise.all([
            Meeting.countDocuments(filter),
            Meeting.find(filter)
                .populate('teamLead', 'name email teamName')
                .populate('consultant', 'name')
                .sort({ meetingDate: -1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                pages: Math.max(Math.ceil(total / limit), 1),
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Lean rows across the full filter window — no pagination.
//          Powers the KPI strip so numbers reflect all matching meetings
//          (not just the current page). Projects only the fields the
//          KPIs need so the payload stays small even with thousands
//          of rows.
// @route   GET /api/meetings/stats
// @access  Private (admin, team_lead)
exports.getMeetingStats = async (req, res, next) => {
    try {
        const { startDate, endDate, teamLead, consultant, status, mode } = req.query;

        const filter = buildScopeFilter(req);

        if (startDate || endDate) {
            filter.meetingDate = {};
            if (startDate) filter.meetingDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.meetingDate.$lte = end;
            }
        }
        if (teamLead && req.user.role === 'admin') filter.teamLead = teamLead;
        if (consultant) filter.consultant = consultant;
        if (status) filter.status = status;
        if (mode) filter.mode = mode;

        const rows = await Meeting.find(filter)
            .select('meetingDate status')
            .sort({ meetingDate: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
exports.getMeeting = async (req, res, next) => {
    try {
        const meeting = await Meeting.findById(req.params.id)
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name');

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        if (!canAccessDoc(req.user, meeting)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this meeting',
            });
        }

        res.status(200).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Create meeting
// @route   POST /api/meetings
// @access  Private (admin, team_lead)
exports.createMeeting = async (req, res, next) => {
    try {
        if (req.user.role === 'team_lead') {
            req.body.teamLead = req.user.id;
            req.body.organization = req.user.organization;
        } else if (req.user.role === 'admin') {
            if (!req.body.teamLead) {
                return res.status(400).json({
                    success: false,
                    message: 'Team lead is required',
                });
            }
            req.body.organization = resolveOrganization(req);
        }

        req.body.createdBy = req.user.id;
        req.body.lastUpdatedBy = req.user.id;

        const resolved = await denormalizeNames(req.body);
        if (!resolved.ok) {
            return res.status(400).json({ success: false, message: resolved.error });
        }

        // LUC + status='Admission' must reference a closed Commitment so
        // Meeting Tracker admissions stay in lockstep with Commitment
        // Tracker admissions (plan invariant 2). Skillhub bypasses this.
        if (
            isLuc(req.body.organization) &&
            req.body.status === 'Admission'
        ) {
            if (!req.body.commitmentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Pick a linked commitment when marking a meeting as Admission',
                });
            }
            const commit = await Commitment.findById(req.body.commitmentId);
            if (!commit) {
                return res.status(400).json({
                    success: false,
                    message: 'Linked commitment not found',
                });
            }
        }

        const meeting = await Meeting.create(req.body);

        res.status(201).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private (admin, team_lead)
exports.updateMeeting = async (req, res, next) => {
    try {
        let meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        if (!canAccessDoc(req.user, meeting)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this meeting',
            });
        }

        // Non-admins cannot reassign ownership.
        if (req.user.role !== 'admin') {
            delete req.body.teamLead;
            delete req.body.organization;
        }

        req.body.lastUpdatedBy = req.user.id;

        const resolved = await denormalizeNames(req.body);
        if (!resolved.ok) {
            return res.status(400).json({ success: false, message: resolved.error });
        }

        meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        })
            .populate('teamLead', 'name email teamName')
            .populate('consultant', 'name');

        res.status(200).json({ success: true, data: meeting });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private (Admin only)
exports.deleteMeeting = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete meetings. Only admins can delete.',
            });
        }

        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                message: 'Meeting not found',
            });
        }

        await meeting.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
            data: {},
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate AI analysis of the meetings in the current filter window.
// @route   GET /api/meetings/ai-analysis
// @access  Private (admin, team_lead)
//
// Scope rules mirror the Hourly Tracker / dashboard AI analysis:
//   - admin: whatever `organization` query param they pass (defaults to luc)
//   - team_lead on LUC: org-wide (drops teamLead filter so they can see the
//     whole LUC picture, same pattern as the leaderboard endpoints)
//   - skillhub: scoped to their branch (but this page is LUC-only so skillhub
//     won't normally reach here — guarded by the route authorize list)
exports.getAIAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate, teamLead, consultant, status, mode } = req.query;

        const filter = buildScopeFilter(req);
        // LUC team_lead org-wide on cross-team analysis views.
        if (
            req.user.role === 'team_lead' &&
            req.user.organization === 'luc'
        ) {
            delete filter.teamLead;
        }

        if (startDate || endDate) {
            filter.meetingDate = {};
            if (startDate) filter.meetingDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.meetingDate.$lte = end;
            }
        }
        if (teamLead && req.user.role === 'admin') filter.teamLead = teamLead;
        if (consultant) filter.consultant = consultant;
        if (status) filter.status = status;
        if (mode) filter.mode = mode;

        const meetings = await Meeting.find(filter)
            .populate('teamLead', 'name teamName')
            .limit(1000)
            .lean();

        if (meetings.length === 0) {
            return res.status(200).json({
                success: true,
                analysis: 'No meetings match the current filters. Widen the date range or clear filters to run an analysis.',
            });
        }

        // Aggregate: by status, by mode, by team, by consultant.
        const byStatus = {};
        const byMode = {};
        const byTeam = {};
        const byConsultant = {};
        for (const m of meetings) {
            byStatus[m.status] = (byStatus[m.status] || 0) + 1;
            byMode[m.mode] = (byMode[m.mode] || 0) + 1;
            const team = m.teamLead?.teamName || m.teamLeadName || 'Unknown';
            byTeam[team] = (byTeam[team] || 0) + 1;
            const cons = m.consultantName || 'Unknown';
            byConsultant[cons] = (byConsultant[cons] || 0) + 1;
        }

        const admissions = (byStatus.Admission || 0) + (byStatus.CIF || 0);
        const lost = (byStatus.Lost || 0) + (byStatus.Dead || 0);
        const conversionPct = meetings.length
            ? Math.round((admissions / meetings.length) * 100)
            : 0;

        const dateRange =
            startDate && endDate
                ? `${new Date(startDate).toISOString().slice(0, 10)} → ${new Date(endDate).toISOString().slice(0, 10)}`
                : 'the current view';

        const topStatuses = Object.entries(byStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([s, c]) => `${s}: ${c}`)
            .join(', ');
        const topModes = Object.entries(byMode)
            .sort((a, b) => b[1] - a[1])
            .map(([m, c]) => `${m}: ${c}`)
            .join(', ');
        const topTeams = Object.entries(byTeam)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([t, c]) => `${t}: ${c}`)
            .join(', ');
        const topConsultants = Object.entries(byConsultant)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([n, c]) => `${n}: ${c}`)
            .join(', ');

        const prompt = `You are analyzing student-admissions meetings for an education consultancy for ${dateRange}.

Totals
- Total meetings: ${meetings.length}
- Admissions (Admission + CIF): ${admissions}
- Lost (Lost + Dead): ${lost}
- Conversion rate: ${conversionPct}%

Status distribution: ${topStatuses}
Mode distribution: ${topModes}
Meetings by team: ${topTeams}
Top consultants (by meeting count): ${topConsultants}

Write a concise, actionable markdown analysis for the team. Follow this exact shape:

## 📊 Meeting Tracker Analysis

### Snapshot
One paragraph (3–4 lines) summarising volume, conversion, and the shape of the pipeline.

### What's working
- 2–4 bullets highlighting strongest status/mode/team/consultant signals with concrete numbers.

### Watch-outs
- 2–4 bullets flagging stalled states (Awaiting Confirmation, Offer Sent, No Answer, Unresponsive), high Lost rate, or mode imbalance.

### Next actions
- 3 crisp recommendations. Each must name what to do, who it targets (team/consultant/stage), and why.

Rules: keep total output under 250 words, use tabular-looking numbers when helpful, do not invent consultants or teams not listed above, and do not repeat the raw numbers block.`;

        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a pragmatic sales-ops analyst for an education consultancy. You read aggregated meeting stats and produce short, useful markdown. Never fabricate names or numbers.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 800,
        });

        const analysis =
            completion.choices[0]?.message?.content ||
            'No analysis was generated. Please try again.';

        const usage = completion.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const cost =
            promptTokens * 0.00000015 + completionTokens * 0.0000006;

        AIUsage.create({
            user: req.user.id,
            role: req.user.role,
            model: 'gpt-4o-mini',
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cost,
            dateRangeQueried: {
                startDate: startDate || 'all',
                endDate: endDate || 'all',
            },
        }).catch((err) => console.error('Failed to log AI usage:', err.message));

        res.status(200).json({ success: true, analysis });
    } catch (error) {
        if (error.message === 'OPENAI_API_KEY is not configured on the server') {
            return res.status(503).json({
                success: false,
                message:
                    'AI analysis is not available. The OpenAI API key has not been configured.',
            });
        }
        if (error.status === 429) {
            return res.status(502).json({
                success: false,
                message:
                    'AI service is temporarily rate-limited. Please try again in a moment.',
            });
        }
        next(error);
    }
};
