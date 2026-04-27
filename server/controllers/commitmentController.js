const Commitment = require('../models/Commitment');
const User = require('../models/User');
const AIUsage = require('../models/AIUsage');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');
const { isSkillhub } = require('../config/organizations');
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

// Sanitize + validate Skillhub demo slots before save.
// Rules:
//   • `done: true` requires a `scheduledAt`.
//   • `doneAt` is server-set to `now` whenever `done` flips to true and no
//     doneAt is present (or existing doneAt was cleared).
//   • Clearing `done` also clears `doneAt`.
//   • Only 4 distinct slot labels allowed: Demo 1, Demo 2, Demo 3, Demo 4.
function normalizeDemos(input, existing = []) {
    if (!Array.isArray(input)) return { ok: true, demos: [] };
    const byLabel = new Map();
    for (const e of existing) byLabel.set(e.slot, e);

    const cleaned = [];
    const seen = new Set();
    for (const raw of input) {
        if (!raw || !raw.slot) continue;
        if (!['Demo 1', 'Demo 2', 'Demo 3', 'Demo 4'].includes(raw.slot)) continue;
        if (seen.has(raw.slot)) continue;
        seen.add(raw.slot);

        const prev = byLabel.get(raw.slot) || {};
        const scheduledAt = raw.scheduledAt || null;
        const done = !!raw.done;

        if (done && !scheduledAt) {
            return {
                ok: false,
                error: `${raw.slot}: cannot be marked Done without a scheduled time.`,
            };
        }

        let doneAt = null;
        if (done) {
            // Preserve prior doneAt if still done; else stamp now.
            doneAt = prev.done && prev.doneAt ? prev.doneAt : new Date();
            if (doneAt > new Date()) doneAt = new Date();
        }

        cleaned.push({
            slot: raw.slot,
            scheduledAt,
            done,
            doneAt,
            notes: (raw.notes || '').toString().trim(),
        });
    }
    // Stable sort by slot number so the stored order matches the UI
    cleaned.sort((a, b) => a.slot.localeCompare(b.slot));
    return { ok: true, demos: cleaned };
}

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

// Defensive backfill: if the caller didn't send a commitmentDate (typically a
// stale client bundle from before the field was added, or a misbehaving CDN
// cache), fall back to weekStartDate. Mirrors scripts/backfillCommitmentDate.js
// so old and new payloads produce the same semantic row. Mutates req.body.
function ensureCommitmentDate(body) {
    if (body.commitmentDate) return;
    if (body.weekStartDate) {
        body.commitmentDate = body.weekStartDate;
    }
}

// Non-admin users (team_lead, skillhub) cannot backdate a commitment into
// a different week — the commitmentDate must fall inside [weekStartDate,
// weekEndDate]. Admins bypass this.
function validateCommitmentDateInWeek(body) {
    if (!body.commitmentDate || !body.weekStartDate || !body.weekEndDate) return null;
    const d = new Date(body.commitmentDate);
    const s = new Date(body.weekStartDate);
    const e = new Date(body.weekEndDate);
    if (Number.isNaN(d.getTime()) || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
        return 'Invalid date provided';
    }
    // Compare by yyyy-mm-dd to ignore time-of-day.
    const toDay = (x) => x.toISOString().slice(0, 10);
    if (toDay(d) < toDay(s) || toDay(d) > toDay(e)) {
        return 'Commitment date must fall within the selected week';
    }
    return null;
}

// @desc    Create new commitment
// @route   POST /api/commitments
// @access  Private/Consultant
exports.createCommitment = async (req, res, next) => {
    try {
        // Run defensively BEFORE role branching so every role gets the fallback.
        ensureCommitmentDate(req.body);

        // Team leads and skillhub branch logins create commitments owned by themselves
        if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            req.body.teamLead = req.user.id;
            req.body.teamName = req.user.teamName;
            req.body.organization = req.user.organization;
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;

            // Skillhub branch logins are the admin of their branch (per
            // CLAUDE.md) — let them backdate freely so they can fill in
            // historical entries that predate the app rollout. The
            // commitment-date-in-week guardrail still applies to LUC
            // team leads (they should be entering for the current week).
            if (req.user.role !== 'skillhub') {
                const err = validateCommitmentDateInWeek(req.body);
                if (err) {
                    return res.status(400).json({ success: false, message: err });
                }
            }
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

        // Auto-close: when a commitment lands at leadStage=Admission and
        // status=achieved we treat it as a closed admission, even if the
        // client didn't tick admissionClosed itself. closedAmount is left
        // for the team lead/admin to fill via edit — Revenue won't reflect
        // the auto-closed row until that's done.
        if (
            req.body.leadStage === 'Admission' &&
            req.body.status === 'achieved' &&
            req.body.admissionClosed !== true
        ) {
            req.body.admissionClosed = true;
        }

        // Auto-set fields when admission is being closed
        if (req.body.admissionClosed === true) {
            req.body.admissionClosedDate = new Date();
            req.body.status = 'achieved';
            req.body.achievementPercentage = 100;
        }

        // Skillhub-only: validate + normalize demo slots
        if (isSkillhub(req.body.organization) && req.body.demos !== undefined) {
            const result = normalizeDemos(req.body.demos);
            if (!result.ok) {
                return res.status(400).json({ success: false, message: result.error });
            }
            req.body.demos = result.demos;
        } else if (!isSkillhub(req.body.organization)) {
            // Never store demos on LUC commitments
            delete req.body.demos;
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

        // Auto-close: if the post-update row would be leadStage=Admission and
        // status=achieved, flip admissionClosed=true even if the client didn't.
        // We merge the existing doc with the incoming patch so a partial
        // update (e.g. only flipping status to 'achieved' on a row already at
        // leadStage='Admission') still triggers the close. closedAmount stays
        // empty — has to be filled via edit before Revenue picks it up.
        const nextLeadStage =
            req.body.leadStage !== undefined ? req.body.leadStage : commitment.leadStage;
        const nextStatus =
            req.body.status !== undefined ? req.body.status : commitment.status;
        if (
            nextLeadStage === 'Admission' &&
            nextStatus === 'achieved' &&
            !commitment.admissionClosed &&
            req.body.admissionClosed !== true
        ) {
            req.body.admissionClosed = true;
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

        // Same defensive fallback as create — an old client that doesn't send
        // commitmentDate but does resend weekStartDate would otherwise erase
        // the field on save with runValidators. When the client sends neither,
        // leave the stored value alone (don't touch req.body).
        if (!req.body.commitmentDate && req.body.weekStartDate) {
            req.body.commitmentDate = req.body.weekStartDate;
        }

        // Non-admin edits must keep commitmentDate inside the (possibly
        // updated) week range. Skillhub branch logins (branch admins) and
        // platform admins both bypass — they can re-date freely.
        if (
            req.user.role !== 'admin' &&
            req.user.role !== 'skillhub' &&
            req.body.commitmentDate
        ) {
            const err = validateCommitmentDateInWeek({
                commitmentDate: req.body.commitmentDate,
                weekStartDate: req.body.weekStartDate || commitment.weekStartDate,
                weekEndDate: req.body.weekEndDate || commitment.weekEndDate,
            });
            if (err) {
                return res.status(400).json({ success: false, message: err });
            }
        }

        // Skillhub-only: validate + normalize demo slots (preserves prior doneAt).
        if (isSkillhub(commitment.organization) && req.body.demos !== undefined) {
            const result = normalizeDemos(req.body.demos, commitment.demos || []);
            if (!result.ok) {
                return res.status(400).json({ success: false, message: result.error });
            }
            req.body.demos = result.demos;
        } else if (!isSkillhub(commitment.organization)) {
            // Never mutate demos on LUC commitments — strip if client sent any.
            delete req.body.demos;
        }

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

// @desc    Get LUC commitments that can be linked to a Student record.
//          Backs the "Linked Commitment" picker in StudentFormDialog and
//          the "Pair with commitment" picker in the reconciliation page.
// @route   GET /api/commitments/linkable
// @access  Private (admin, team_lead). Skillhub callers get an empty list.
exports.getLinkableCommitments = async (req, res, next) => {
    try {
        const { consultantName, search, limit } = req.query;

        const filter = {
            ...buildScopeFilter(req),
            organization: 'luc',
            // Eligible to link: any unlinked LUC commit in scope. We used
            // to restrict to leadStage='Admission' but that hid older
            // commits the TL/admin actually wanted to pair (the deal
            // sometimes closes before the leadStage was bumped). The
            // server still flips leadStage/admissionClosed on link.
            studentId: null,
        };

        if (consultantName) {
            filter.consultantName = consultantName;
        }
        if (search) {
            filter.studentName = { $regex: String(search).trim(), $options: 'i' };
        }

        const cap = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
        const rows = await Commitment.find(filter)
            .select(
                'studentName consultantName teamName commitmentDate ' +
                'admissionClosed admissionClosedDate leadStage status'
            )
            .sort('-commitmentDate')
            .limit(cap)
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

        // Filter by the actual commitmentDate (the calendar day the row is
        // logged for), not weekStartDate. weekStartDate is always a Monday,
        // so a Mar-ending range would otherwise sweep in the first few April
        // days of a Mon-30 / Sun-Apr-5 week.
        const rangeStart = new Date(startDate);
        const rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);

        const query = {
            ...buildScopeFilter(req),
            commitmentDate: { $gte: rangeStart, $lte: rangeEnd },
        };

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email')
            .sort('-commitmentDate');

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

        // Use explicit date range when provided, otherwise fall back to months-based calculation.
        // We push endDate to end-of-day so a same-day filter still includes
        // commitments logged later that day. Matches the date-range endpoint.
        let startDate, endDate;
        if (startParam && endParam) {
            startDate = new Date(startParam);
            endDate = new Date(endParam);
        } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - parseInt(months));
        }
        endDate.setHours(23, 59, 59, 999);

        // Filter by commitmentDate (the calendar day the commitment is for),
        // matching the team-level /date-range endpoint. weekStartDate is
        // always a Monday, so filtering by it makes a Mon-30/Sun-Apr-5 week
        // disappear from an "April" range and pulls a week-of-Apr-27 into
        // it (sweeping in commitments dated up to May 3).
        const query = {
            ...buildScopeFilter(req),
            consultantName: consultantName,
            commitmentDate: { $gte: startDate, $lte: endDate },
        };

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email teamName')
            .sort('commitmentDate');

        // Calculate monthly aggregates, keyed off commitmentDate so the
        // monthly trend matches the date-range filter above.
        const monthlyStats = {};
        commitments.forEach(c => {
            const d = c.commitmentDate || c.weekStartDate;
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

// @desc    Focused AI analysis of commitments in the current filter window.
// @route   GET /api/commitments/ai-analysis
// @access  Private (admin, team_lead)
//
// Mirrors meetingController.getAIAnalysis. LUC team leads get org-wide scope
// on this view (benchmark their team against the rest of the org).
exports.getAIAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate, teamLead, consultantName, leadStage, status } = req.query;

        const filter = buildScopeFilter(req);
        if (req.user.role === 'team_lead' && req.user.organization === 'luc') {
            delete filter.teamLead;
        }

        if (startDate || endDate) {
            filter.commitmentDate = {};
            if (startDate) filter.commitmentDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.commitmentDate.$lte = end;
            }
        }
        if (teamLead && req.user.role === 'admin') filter.teamLead = teamLead;
        if (consultantName) filter.consultantName = consultantName;
        if (leadStage) filter.leadStage = leadStage;
        if (status) filter.status = status;

        const commitments = await Commitment.find(filter)
            .populate('teamLead', 'name teamName')
            .limit(1000)
            .lean();

        if (commitments.length === 0) {
            return res.status(200).json({
                success: true,
                analysis: 'No commitments match the current filters. Widen the date range or clear filters to run an analysis.',
            });
        }

        const byStage = {};
        const byStatus = {};
        const byTeam = {};
        const byConsultant = {};
        let totalMeetings = 0;
        let totalClosed = 0;
        let totalRevenue = 0;
        let probSum = 0;
        for (const c of commitments) {
            byStage[c.leadStage] = (byStage[c.leadStage] || 0) + 1;
            byStatus[c.status] = (byStatus[c.status] || 0) + 1;
            const team = c.teamLead?.teamName || c.teamName || 'Unknown';
            byTeam[team] = (byTeam[team] || 0) + 1;
            const cons = c.consultantName || 'Unknown';
            byConsultant[cons] = (byConsultant[cons] || 0) + 1;
            totalMeetings += c.meetingsDone || 0;
            if (c.admissionClosed) {
                totalClosed++;
                totalRevenue += c.closedAmount || 0;
            }
            probSum += c.conversionProbability || 0;
        }

        const avgProb = commitments.length
            ? Math.round(probSum / commitments.length)
            : 0;
        const achievementRate = commitments.length
            ? Math.round(
                  (commitments.filter((c) => c.status === 'achieved' || c.admissionClosed)
                      .length /
                      commitments.length) *
                      100
              )
            : 0;

        const dateRange =
            startDate && endDate
                ? `${new Date(startDate).toISOString().slice(0, 10)} → ${new Date(endDate).toISOString().slice(0, 10)}`
                : 'the current view';

        const fmtMap = (m, n = 8) =>
            Object.entries(m)
                .sort((a, b) => b[1] - a[1])
                .slice(0, n)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');

        const prompt = `You are analyzing sales commitments for an education consultancy for ${dateRange}.

Totals
- Total commitments: ${commitments.length}
- Achievement rate (achieved + admissions closed): ${achievementRate}%
- Admissions closed: ${totalClosed} (₹${Math.round(totalRevenue).toLocaleString()})
- Avg conversion probability: ${avgProb}%
- Total meetings done across commitments: ${totalMeetings}

Lead-stage distribution: ${fmtMap(byStage)}
Workflow status: ${fmtMap(byStatus)}
Commitments by team: ${fmtMap(byTeam)}
Top consultants (by commitment count): ${fmtMap(byConsultant, 10)}

Write a concise, actionable markdown analysis for the team. Follow this exact shape:

## 📈 Commitment Tracker Analysis

### Snapshot
One paragraph (3–4 lines) summarising volume, achievement rate, and the shape of the pipeline (Admission vs Warm/Awaiting vs Lost/Dead).

### What's working
- 2–4 bullets highlighting strongest stage/team/consultant signals with concrete numbers.

### Watch-outs
- 2–4 bullets flagging stalled states (Awaiting Confirmation, Offer Sent, Unresponsive, No Answer), high Missed/Lost rate, or teams with low conversion.

### Next actions
- 3 crisp recommendations. Each must name what to do, who it targets, and why.

Rules: keep total output under 280 words, use tabular-looking numbers when helpful, do not invent consultants or teams not listed above, and do not repeat the raw numbers block.`;

        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a pragmatic sales-ops analyst for an education consultancy. You read aggregated commitment stats and produce short, useful markdown. Never fabricate names or numbers.',
                },
                { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 900,
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
