const {
    aggregateAdminData,
    aggregateTeamLeadData,
    aggregateStudentData,
    buildAdminPrompt,
    buildTeamLeadPrompt,
    buildStudentPrompt,
    generateAnalysis,
} = require('../services/aiService');
const AIUsage = require('../models/AIUsage');
const { resolveOrganization } = require('../middleware/auth');

// @desc    Generate AI analysis for dashboard
// @route   POST /api/ai/analysis
// @access  Private (Admin/Team Lead)
exports.generateDashboardAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        let data;
        let messages;

        if (req.user.role === 'admin') {
            data = await aggregateAdminData(startDate, endDate);
            if (!data) {
                return res.status(200).json({
                    success: true,
                    analysis: 'No commitment or student data found for the selected date range. Please select a different period.',
                });
            }
            messages = buildAdminPrompt(data);
        } else if (req.user.role === 'team_lead' && req.user.organization === 'luc') {
            // LUC team leads see org-wide analysis (LUC-only) — same aggregation
            // as admin, scoped to the LUC tenant. They can compare how their
            // team is performing against the rest of the organization.
            data = await aggregateAdminData(startDate, endDate, 'luc');
            if (!data) {
                return res.status(200).json({
                    success: true,
                    analysis: 'No commitment or student data found for the selected date range. Please select a different period.',
                });
            }
            messages = buildAdminPrompt(data);
        } else if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            // Skillhub branch logins stay scoped to their own branch via
            // teamLead FK. (LUC team_leads are handled in the branch above.)
            data = await aggregateTeamLeadData(req.user.id, startDate, endDate);
            if (!data) {
                return res.status(200).json({
                    success: true,
                    analysis: 'No commitment or student data found for the selected date range. Please select a different period.',
                });
            }
            messages = buildTeamLeadPrompt(data);
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access AI analysis',
            });
        }

        const result = await generateAnalysis(messages);

        // Log usage asynchronously (don't block response)
        AIUsage.create({
            user: req.user.id,
            role: req.user.role,
            type: 'analysis',
            teamName: req.user.teamName || '',
            organization: req.user.organization || '',
            model: result.usage.model,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            cost: result.usage.cost,
            dateRangeQueried: { startDate, endDate },
        }).catch((err) => console.error('Failed to log AI usage:', err.message));

        res.status(200).json({
            success: true,
            analysis: result.content,
        });
    } catch (error) {
        if (error.message === 'OPENAI_API_KEY is not configured on the server') {
            return res.status(503).json({
                success: false,
                message: 'AI analysis is not available. The OpenAI API key has not been configured.',
            });
        }

        if (error.status === 429) {
            return res.status(502).json({
                success: false,
                message: 'AI service is temporarily rate-limited. Please try again in a moment.',
            });
        }

        next(error);
    }
};

// @desc    Get AI usage statistics
// @route   GET /api/ai/usage
// @access  Private (Admin only)
//
// Response shape (post-chatbot):
// {
//   summary: { analysis: {...}, chat: {...}, totalCalls, totalTokens, totalCost },
//   byTeam:  [{ team, org, analysisCalls, analysisCost, chatCalls, chatCost, ... }],
//   byUser:  [{ name, role, team, analysisCalls, chatCalls, ... }],
//   daily:   [{ date, analysisCalls, chatCalls, tokens, cost }],
//   recentCalls: [{ type, user, team, role, tokens, cost, dateRange, createdAt }],
// }
//
// `type` is back-filled in this endpoint for legacy rows that were
// written before the chatbot shipped — everything without a type defaults
// to 'analysis' via the schema default, but the old rows in the DB have
// no type field at all, so we coerce here too.
exports.getUsageStats = async (req, res, next) => {
    try {
        const records = await AIUsage.find()
            .populate('user', 'name role teamName organization')
            .sort('-createdAt')
            .lean();

        // Normalize legacy rows: no `type` field → treat as 'analysis'.
        // Prefer the cached teamName/organization on the row; fall back to
        // the current populated user doc; final fallback '—'.
        const norm = records.map((r) => ({
            ...r,
            type: r.type || 'analysis',
            teamName: r.teamName || r.user?.teamName || '',
            organization: r.organization || r.user?.organization || '',
            userName: r.user?.name || 'Unknown',
        }));

        const bucket = () => ({ calls: 0, tokens: 0, cost: 0 });

        // Totals + per-type totals
        const analysis = bucket();
        const chat = bucket();
        for (const r of norm) {
            const b = r.type === 'chat' ? chat : analysis;
            b.calls += 1;
            b.tokens += r.totalTokens || 0;
            b.cost += r.cost || 0;
        }
        const summary = {
            analysis: {
                ...analysis,
                cost: Math.round(analysis.cost * 1_000_000) / 1_000_000,
            },
            chat: {
                ...chat,
                cost: Math.round(chat.cost * 1_000_000) / 1_000_000,
            },
            totalCalls: analysis.calls + chat.calls,
            totalTokens: analysis.tokens + chat.tokens,
            totalCost:
                Math.round((analysis.cost + chat.cost) * 1_000_000) / 1_000_000,
        };

        // --- By Team ---
        const teamMap = new Map();
        for (const r of norm) {
            const key = r.teamName || '— (no team)';
            const row = teamMap.get(key) || {
                team: key,
                organization: r.organization || '',
                analysisCalls: 0,
                analysisTokens: 0,
                analysisCost: 0,
                chatCalls: 0,
                chatTokens: 0,
                chatCost: 0,
            };
            if (r.type === 'chat') {
                row.chatCalls += 1;
                row.chatTokens += r.totalTokens || 0;
                row.chatCost += r.cost || 0;
            } else {
                row.analysisCalls += 1;
                row.analysisTokens += r.totalTokens || 0;
                row.analysisCost += r.cost || 0;
            }
            teamMap.set(key, row);
        }
        const byTeam = [...teamMap.values()]
            .map((r) => ({
                ...r,
                totalCalls: r.analysisCalls + r.chatCalls,
                totalCost: r.analysisCost + r.chatCost,
            }))
            .sort((a, b) => b.totalCost - a.totalCost);

        // --- By User ---
        const userMap = new Map();
        for (const r of norm) {
            const key = r.userName;
            const row = userMap.get(key) || {
                name: key,
                role: r.role,
                team: r.teamName || '—',
                analysisCalls: 0,
                chatCalls: 0,
                tokens: 0,
                cost: 0,
            };
            if (r.type === 'chat') row.chatCalls += 1;
            else row.analysisCalls += 1;
            row.tokens += r.totalTokens || 0;
            row.cost += r.cost || 0;
            userMap.set(key, row);
        }
        const byUser = [...userMap.values()].sort((a, b) => b.cost - a.cost);

        // --- Daily (last 30 days) — now split by type ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyMap = new Map();
        for (const r of norm) {
            if (new Date(r.createdAt) < thirtyDaysAgo) continue;
            const day = new Date(r.createdAt).toISOString().split('T')[0];
            const row = dailyMap.get(day) || {
                date: day,
                analysisCalls: 0,
                chatCalls: 0,
                tokens: 0,
                cost: 0,
            };
            if (r.type === 'chat') row.chatCalls += 1;
            else row.analysisCalls += 1;
            row.tokens += r.totalTokens || 0;
            row.cost += r.cost || 0;
            dailyMap.set(day, row);
        }
        const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

        // --- Recent ---
        const recentCalls = norm.slice(0, 50).map((r) => ({
            type: r.type,
            user: r.userName,
            team: r.teamName || '—',
            role: r.role,
            promptTokens: r.promptTokens,
            completionTokens: r.completionTokens,
            totalTokens: r.totalTokens,
            cost: r.cost,
            dateRange: r.dateRangeQueried,
            createdAt: r.createdAt,
        }));

        res.status(200).json({
            success: true,
            data: { summary, byTeam, byUser, daily, recentCalls },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate AI analysis for the Student Database view.
//          Scopes by the same filter the user sees on the page:
//          admin -> org selector (body.organization) + optional curriculumSlug;
//          team_lead / skillhub -> their own teamLead + their user.organization.
// @route   POST /api/ai/student-analysis
// @access  Private (Admin/Team Lead/Skillhub)
exports.generateStudentAnalysis = async (req, res, next) => {
    try {
        const { startDate, endDate, curriculumSlug } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        let organization;
        let teamLeadId;

        if (req.user.role === 'admin') {
            organization = resolveOrganization(req);
        } else if (req.user.role === 'team_lead' || req.user.role === 'skillhub') {
            organization = req.user.organization;
            teamLeadId = req.user.id;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access AI analysis',
            });
        }

        const data = await aggregateStudentData({
            startDate,
            endDate,
            organization,
            teamLeadId,
            curriculumSlug,
        });

        if (!data) {
            return res.status(200).json({
                success: true,
                analysis:
                    'No student data found for the selected filter window. Please adjust the date range or filters.',
            });
        }

        const messages = buildStudentPrompt(data);
        const result = await generateAnalysis(messages);

        AIUsage.create({
            user: req.user.id,
            role: req.user.role,
            type: 'analysis',
            teamName: req.user.teamName || '',
            organization: req.user.organization || '',
            model: result.usage.model,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            cost: result.usage.cost,
            dateRangeQueried: { startDate, endDate },
        }).catch((err) => console.error('Failed to log AI usage:', err.message));

        res.status(200).json({
            success: true,
            analysis: result.content,
        });
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
