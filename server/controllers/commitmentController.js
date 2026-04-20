const Commitment = require('../models/Commitment');
const User = require('../models/User');
const { buildScopeFilter, canAccessDoc, resolveOrganization } = require('../middleware/auth');
const { isSkillhub } = require('../config/organizations');

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
        // Team leads and skillhub branch logins create commitments owned by themselves
        if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            req.body.teamLead = req.user.id;
            req.body.teamName = req.user.teamName;
            req.body.organization = req.user.organization;
            req.body.createdBy = req.user.id;
            req.body.lastUpdatedBy = req.user.id;

            const err = validateCommitmentDateInWeek(req.body);
            if (err) {
                return res.status(400).json({ success: false, message: err });
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

        // Non-admin edits must keep commitmentDate inside the (possibly
        // updated) week range. Fall back to the stored week bounds when the
        // client didn't resend them.
        if (req.user.role !== 'admin' && req.body.commitmentDate) {
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

        const query = {
            ...buildScopeFilter(req),
            weekStartDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
        };

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email')
            .sort('-weekStartDate');

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

        // Use explicit date range when provided, otherwise fall back to months-based calculation
        let startDate, endDate;
        if (startParam && endParam) {
            startDate = new Date(startParam);
            endDate = new Date(endParam);
        } else {
            endDate = new Date();
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - parseInt(months));
        }

        const query = {
            ...buildScopeFilter(req),
            consultantName: consultantName,
            weekStartDate: { $gte: startDate, $lte: endDate },
        };

        const commitments = await Commitment.find(query)
            .populate('teamLead', 'name email teamName')
            .sort('weekStartDate');

        // Calculate monthly aggregates
        const monthlyStats = {};
        commitments.forEach(c => {
            const monthKey = `${c.year}-${String(c.weekStartDate.getMonth() + 1).padStart(2, '0')}`;
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
