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
exports.getUsageStats = async (req, res, next) => {
    try {
        const records = await AIUsage.find()
            .populate('user', 'name role')
            .sort('-createdAt')
            .lean();

        const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
        const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
        const totalCalls = records.length;

        // Per-user breakdown
        const userMap = {};
        records.forEach((r) => {
            const name = r.user?.name || 'Unknown';
            if (!userMap[name]) {
                userMap[name] = { name, role: r.role, calls: 0, tokens: 0, cost: 0 };
            }
            userMap[name].calls++;
            userMap[name].tokens += r.totalTokens;
            userMap[name].cost += r.cost;
        });

        // Daily breakdown (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyMap = {};
        records
            .filter((r) => new Date(r.createdAt) >= thirtyDaysAgo)
            .forEach((r) => {
                const day = new Date(r.createdAt).toISOString().split('T')[0];
                if (!dailyMap[day]) {
                    dailyMap[day] = { date: day, calls: 0, tokens: 0, cost: 0 };
                }
                dailyMap[day].calls++;
                dailyMap[day].tokens += r.totalTokens;
                dailyMap[day].cost += r.cost;
            });

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalCalls,
                    totalTokens,
                    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
                },
                byUser: Object.values(userMap).sort((a, b) => b.cost - a.cost),
                daily: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
                recentCalls: records.slice(0, 50).map((r) => ({
                    user: r.user?.name || 'Unknown',
                    role: r.role,
                    promptTokens: r.promptTokens,
                    completionTokens: r.completionTokens,
                    totalTokens: r.totalTokens,
                    cost: r.cost,
                    dateRange: r.dateRangeQueried,
                    createdAt: r.createdAt,
                })),
            },
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
