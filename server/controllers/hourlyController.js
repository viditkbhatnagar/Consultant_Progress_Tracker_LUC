const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const DailyReference = require('../models/DailyReference');
const Consultant = require('../models/Consultant');
const AIUsage = require('../models/AIUsage');
const {
    SLOTS,
    getContinuationSlots,
    getSlotsForOrg,
    SKILLHUB_ACTIVITY_TYPES,
} = require('../utils/hourlyConstants');
const { buildScopeFilter } = require('../middleware/auth');
const { isSkillhub } = require('../config/organizations');
const OpenAI = require('openai');

// Hourly activity docs don't have teamLead FK, so strip it before using the
// generic scope filter (keep only organization-level scoping for these collections).
function hourlyScopeFilter(req) {
    const { teamLead, ...rest } = buildScopeFilter(req);
    return rest;
}

let openai;
const getOpenAIClient = () => {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
};

// Helper: parse YYYY-MM-DD string to Date at midnight UTC
function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

// Helper: check if a YYYY-MM-DD string is today or in the future (rejects only backdated entries)
// Uses the date sent by the client (their local laptop time) — only rejects past dates
function isTodayOrFutureStr(dateStr) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dateStr >= todayStr;
}

// LUC activity types that are locked once saved (cannot be edited or deleted).
// Skillhub has no locked types for now — all 7 Skillhub activities stay editable.
const LOCKED_TYPES = ['call', 'followup', 'call_followup'];

// Helper: true if this activity slug is a Skillhub activity (sh_* prefix).
function isSkillhubActivity(activityType) {
    return SKILLHUB_ACTIVITY_TYPES.includes(activityType);
}

// Helper: check if date is exactly today (for strict validation)
function isTodayStr(dateStr) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
}

// @desc    Get active consultants (admin sees all, team_lead sees own team only)
// @route   GET /api/hourly/consultants
// @access  Private
exports.getConsultants = async (req, res, next) => {
    try {
        const filter = { ...buildScopeFilter(req), isActive: true };
        // team_lead may opt out of ownership filter via scope=org (legacy)
        if (req.user.role === 'team_lead' && req.query.scope === 'org') {
            delete filter.teamLead;
        }

        const consultants = await Consultant.find(filter)
            .populate('teamLead', 'name teamName')
            .sort('name');

        res.status(200).json({ success: true, data: consultants });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all activities for a given date
// @route   GET /api/hourly/day?date=YYYY-MM-DD
// @access  Private
exports.getDayActivities = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res
                .status(400)
                .json({ success: false, message: 'Date is required' });
        }

        const dateObj = parseDate(date);
        const activities = await HourlyActivity.find({
            ...hourlyScopeFilter(req),
            date: dateObj,
        });

        res.status(200).json({ success: true, data: activities });
    } catch (error) {
        next(error);
    }
};

// @desc    Upsert a slot activity (and handle continuations)
// @route   PUT /api/hourly/slot
// @access  Private
exports.upsertSlot = async (req, res, next) => {
    try {
        const {
            consultantId,
            consultantName,
            date,
            slotId,
            activityType,
            count,
            followupCount,
            duration,
            note,
        } = req.body;

        if (!consultantId || !date || !slotId || !activityType) {
            return res.status(400).json({
                success: false,
                message:
                    'consultantId, date, slotId, and activityType are required',
            });
        }

        if (req.user.role !== 'admin' && !isTodayStr(date)) {
            return res.status(403).json({
                success: false,
                message: 'Entries can only be made for today',
            });
        }

        const dateObj = parseDate(date);

        // Resolve organization from the target consultant (authoritative)
        const consultantDoc = await Consultant.findById(consultantId);
        if (!consultantDoc) {
            return res.status(404).json({ success: false, message: 'Consultant not found' });
        }
        if (req.user.role !== 'admin' && consultantDoc.organization !== req.user.organization) {
            return res.status(403).json({ success: false, message: 'Not authorized for this consultant' });
        }
        const organization = consultantDoc.organization;

        // LUC: some activity types are locked once saved. Skillhub has no locks.
        if (req.user.role !== 'admin' && !isSkillhub(organization)) {
            const existing = await HourlyActivity.findOne({
                consultant: consultantId,
                date: dateObj,
                slotId,
            });
            if (existing && LOCKED_TYPES.includes(existing.activityType) && !existing.isContinuation) {
                return res.status(403).json({
                    success: false,
                    message: 'Call and Follow-up entries cannot be modified once logged',
                });
            }
        }

        // Clear old continuations from this slot first
        await HourlyActivity.deleteMany({
            consultant: consultantId,
            date: dateObj,
            isContinuation: true,
            parentSlotId: slotId,
        });

        // Upsert the main slot — use the org's slot list so continuation math
        // correctly skips each org's lunch gap (LUC 1-2 PM, Skillhub 2-3 PM).
        const orgSlots = getSlotsForOrg(organization);
        const slotDef = orgSlots.find((s) => s.id === slotId);
        const dur = duration || (slotDef ? slotDef.mins : 60);

        const activity = await HourlyActivity.findOneAndUpdate(
            { consultant: consultantId, date: dateObj, slotId },
            {
                organization,
                consultant: consultantId,
                consultantName: consultantName || '',
                date: dateObj,
                slotId,
                activityType,
                count: count || 1,
                followupCount: followupCount || 0,
                duration: dur,
                note: note || '',
                isContinuation: false,
                parentSlotId: null,
                loggedBy: req.user.id,
            },
            { upsert: true, new: true, runValidators: true }
        );

        // Create continuation slots if duration exceeds slot time
        if (slotDef && dur > slotDef.mins) {
            const contSlots = getContinuationSlots(slotId, dur, organization);
            for (const csid of contSlots) {
                await HourlyActivity.findOneAndUpdate(
                    { consultant: consultantId, date: dateObj, slotId: csid },
                    {
                        organization,
                        consultant: consultantId,
                        consultantName: consultantName || '',
                        date: dateObj,
                        slotId: csid,
                        activityType,
                        count: 0,
                        duration: 0,
                        note: '',
                        isContinuation: true,
                        parentSlotId: slotId,
                        loggedBy: req.user.id,
                    },
                    { upsert: true, new: true, runValidators: true }
                );
            }
        }

        res.status(200).json({ success: true, data: activity });
    } catch (error) {
        next(error);
    }
};

// @desc    Clear a slot and its continuations
// @route   DELETE /api/hourly/slot
// @access  Private
exports.clearSlot = async (req, res, next) => {
    try {
        const { consultantId, date, slotId } = req.body;

        if (!consultantId || !date || !slotId) {
            return res.status(400).json({
                success: false,
                message: 'consultantId, date, and slotId are required',
            });
        }

        if (req.user.role !== 'admin' && !isTodayStr(date)) {
            return res.status(403).json({
                success: false,
                message: 'Can only modify today\'s entries',
            });
        }

        const dateObj = parseDate(date);

        // Check if existing entry is locked (admin can override)
        if (req.user.role !== 'admin') {
            const existing = await HourlyActivity.findOne({
                consultant: consultantId,
                date: dateObj,
                slotId,
            });
            if (existing && LOCKED_TYPES.includes(existing.activityType) && !existing.isContinuation) {
                return res.status(403).json({
                    success: false,
                    message: 'Call and Follow-up entries cannot be deleted once logged',
                });
            }
        }

        // Delete the slot itself
        await HourlyActivity.deleteOne({
            consultant: consultantId,
            date: dateObj,
            slotId,
        });

        // Delete any continuations from this slot
        await HourlyActivity.deleteMany({
            consultant: consultantId,
            date: dateObj,
            isContinuation: true,
            parentSlotId: slotId,
        });

        res.status(200).json({ success: true, message: 'Slot cleared' });
    } catch (error) {
        next(error);
    }
};

// @desc    Clear all activities for a day
// @route   DELETE /api/hourly/day?date=YYYY-MM-DD
// @access  Private
exports.clearDay = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res
                .status(400)
                .json({ success: false, message: 'Date is required' });
        }

        if (req.user.role !== 'admin' && !isTodayStr(date)) {
            return res.status(403).json({
                success: false,
                message: 'Can only clear today\'s data',
            });
        }

        const dateObj = parseDate(date);
        const scope = hourlyScopeFilter(req);
        // Admin can clear everything; others skip locked entries
        if (req.user.role === 'admin') {
            await HourlyActivity.deleteMany({ ...scope, date: dateObj });
        } else {
            await HourlyActivity.deleteMany({
                ...scope,
                date: dateObj,
                activityType: { $nin: LOCKED_TYPES },
            });
        }

        res.status(200).json({ success: true, message: 'Day cleared' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all activities for a month
// @route   GET /api/hourly/month?year=YYYY&month=MM
// @access  Private
exports.getMonthActivities = async (req, res, next) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({
                success: false,
                message: 'year and month are required',
            });
        }

        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = new Date(Date.UTC(y, m, 1));
        const endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

        const activities = await HourlyActivity.find({
            ...hourlyScopeFilter(req),
            date: { $gte: startDate, $lte: endDate },
        });

        res.status(200).json({ success: true, data: activities });
    } catch (error) {
        next(error);
    }
};

// @desc    Get admissions for a day
// @route   GET /api/hourly/admissions?date=YYYY-MM-DD
// @access  Private
exports.getDayAdmissions = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res
                .status(400)
                .json({ success: false, message: 'Date is required' });
        }
        const dateObj = parseDate(date);
        const admissions = await DailyAdmission.find({
            ...hourlyScopeFilter(req),
            date: dateObj,
        }).populate('consultant', 'name');
        res.status(200).json({ success: true, data: admissions });
    } catch (error) {
        next(error);
    }
};

// @desc    Upsert admission count for a consultant on a day
// @route   PUT /api/hourly/admissions
// @access  Private
exports.upsertAdmission = async (req, res, next) => {
    try {
        const { consultantId, date, count } = req.body;

        if (!consultantId || !date) {
            return res.status(400).json({
                success: false,
                message: 'consultantId and date are required',
            });
        }

        if (req.user.role !== 'admin' && !isTodayStr(date)) {
            return res.status(403).json({
                success: false,
                message: 'Admissions can only be entered for today',
            });
        }

        const dateObj = parseDate(date);
        const admCount = parseInt(count) || 0;

        const consultantDoc = await Consultant.findById(consultantId);
        if (!consultantDoc) {
            return res.status(404).json({ success: false, message: 'Consultant not found' });
        }
        if (req.user.role !== 'admin' && consultantDoc.organization !== req.user.organization) {
            return res.status(403).json({ success: false, message: 'Not authorized for this consultant' });
        }

        if (admCount === 0) {
            await DailyAdmission.deleteOne({
                consultant: consultantId,
                date: dateObj,
            });
        } else {
            await DailyAdmission.findOneAndUpdate(
                { consultant: consultantId, date: dateObj },
                {
                    organization: consultantDoc.organization,
                    consultant: consultantId,
                    date: dateObj,
                    count: admCount,
                    loggedBy: req.user.id,
                },
                { upsert: true, new: true, runValidators: true }
            );
        }

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

// @desc    Get admissions for a month
// @route   GET /api/hourly/admissions/month?year=YYYY&month=MM
// @access  Private
exports.getMonthAdmissions = async (req, res, next) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({
                success: false,
                message: 'year and month are required',
            });
        }
        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = new Date(Date.UTC(y, m, 1));
        const endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

        const admissions = await DailyAdmission.find({
            ...hourlyScopeFilter(req),
            date: { $gte: startDate, $lte: endDate },
        });
        res.status(200).json({ success: true, data: admissions });
    } catch (error) {
        next(error);
    }
};

// @desc    Get references for a day
// @route   GET /api/hourly/references?date=YYYY-MM-DD
// @access  Private
exports.getDayReferences = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }
        const dateObj = parseDate(date);
        const references = await DailyReference.find({
            ...hourlyScopeFilter(req),
            date: dateObj,
        }).populate('consultant', 'name');
        res.status(200).json({ success: true, data: references });
    } catch (error) {
        next(error);
    }
};

// @desc    Upsert reference count for a consultant on a day
// @route   PUT /api/hourly/references
// @access  Private
exports.upsertReference = async (req, res, next) => {
    try {
        const { consultantId, date, count } = req.body;

        if (!consultantId || !date) {
            return res.status(400).json({ success: false, message: 'consultantId and date are required' });
        }

        if (req.user.role !== 'admin' && !isTodayStr(date)) {
            return res.status(403).json({ success: false, message: 'References can only be entered for today' });
        }

        const dateObj = parseDate(date);
        const refCount = parseInt(count) || 0;

        const consultantDoc = await Consultant.findById(consultantId);
        if (!consultantDoc) {
            return res.status(404).json({ success: false, message: 'Consultant not found' });
        }
        if (req.user.role !== 'admin' && consultantDoc.organization !== req.user.organization) {
            return res.status(403).json({ success: false, message: 'Not authorized for this consultant' });
        }

        if (refCount === 0) {
            await DailyReference.deleteOne({ consultant: consultantId, date: dateObj });
        } else {
            await DailyReference.findOneAndUpdate(
                { consultant: consultantId, date: dateObj },
                {
                    organization: consultantDoc.organization,
                    consultant: consultantId,
                    date: dateObj,
                    count: refCount,
                    loggedBy: req.user.id,
                },
                { upsert: true, new: true, runValidators: true }
            );
        }

        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
};

// @desc    Get references for a month
// @route   GET /api/hourly/references/month?year=YYYY&month=MM
// @access  Private
exports.getMonthReferences = async (req, res, next) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({ success: false, message: 'year and month are required' });
        }
        const y = parseInt(year);
        const m = parseInt(month);
        const startDate = new Date(Date.UTC(y, m, 1));
        const endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

        const references = await DailyReference.find({
            ...hourlyScopeFilter(req),
            date: { $gte: startDate, $lte: endDate },
        });
        res.status(200).json({ success: true, data: references });
    } catch (error) {
        next(error);
    }
};

// Determine the org whose data is being viewed (admin with ?organization=X
// overrides their own role's org; non-admin uses their own org).
function resolveViewOrg(req) {
    if (req.user.role === 'admin') {
        return req.query.organization || 'luc';
    }
    return req.user.organization || 'luc';
}

// Skillhub-specific AI analysis: aggregates the 7 Skillhub activity types
// (sh_call, sh_followup_admission, sh_schedule, sh_break, sh_demo_meeting,
// sh_payment_followup, sh_operations) and uses a coaching-institute-specific
// prompt instead of the LUC one.
async function runSkillhubAnalysis(req, res, { date, activities, dayAdmissions, consultants }) {
    const stats = {};
    for (const c of consultants) {
        stats[c._id.toString()] = {
            name: c.name,
            team: c.teamLead?.teamName || 'Unknown',
            calls: 0,
            followupAdmissions: 0,
            schedules: 0,
            breaks: 0,
            demoMeetings: 0,
            demoMinutes: 0,
            paymentFollowups: 0,
            operations: [],
            activeSlots: 0,
            admissions: 0,
        };
    }

    for (const act of activities) {
        const s = stats[act.consultant.toString()];
        if (!s) continue;
        s.activeSlots++;
        switch (act.activityType) {
            case 'sh_call':
                s.calls += act.count || 1;
                break;
            case 'sh_followup_admission':
                s.followupAdmissions += act.count || 1;
                break;
            case 'sh_schedule':
                s.schedules++;
                break;
            case 'sh_break':
                s.breaks++;
                break;
            case 'sh_demo_meeting':
                s.demoMeetings++;
                s.demoMinutes += act.duration || 60;
                break;
            case 'sh_payment_followup':
                s.paymentFollowups += act.count || 1;
                break;
            case 'sh_operations':
                s.operations.push(act.note || 'No note');
                break;
            default:
                break;
        }
    }

    for (const adm of dayAdmissions) {
        const s = stats[adm.consultant.toString()];
        if (s) s.admissions += adm.count || 0;
    }

    const totals = {
        calls: 0, followupAdmissions: 0, schedules: 0, demoMeetings: 0,
        demoMinutes: 0, paymentFollowups: 0, operations: 0,
        admissions: 0, active: 0,
    };
    const summaries = [];
    for (const s of Object.values(stats)) {
        if (s.activeSlots === 0 && s.admissions === 0) continue;
        totals.active++;
        totals.calls += s.calls;
        totals.followupAdmissions += s.followupAdmissions;
        totals.schedules += s.schedules;
        totals.demoMeetings += s.demoMeetings;
        totals.demoMinutes += s.demoMinutes;
        totals.paymentFollowups += s.paymentFollowups;
        totals.operations += s.operations.length;
        totals.admissions += s.admissions;
        summaries.push(s);
    }

    if (summaries.length === 0) {
        return res.status(200).json({ success: true, data: 'No activity data found for this date.' });
    }

    // Weight: admissions >> demo meetings >> follow-up admissions >
    // payment follow-ups > calling > schedule; break/operations don't score.
    summaries.sort((a, b) => {
        const score = (s) =>
            s.admissions * 15 + s.demoMeetings * 6 + s.followupAdmissions * 4 +
            s.paymentFollowups * 3 + s.calls * 1 + s.schedules * 0.5;
        return score(a) - score(b);
    });

    const prompt = `Analyze the following Skillhub counselor daily performance data for ${date}.

TEAM TOTALS:
- Active counselors: ${totals.active} out of ${consultants.length}
- Calling sessions: ${totals.calls}
- Follow up — Admission: ${totals.followupAdmissions}
- Schedule slots: ${totals.schedules}
- Demo Meetings: ${totals.demoMeetings} (${(totals.demoMinutes / 60).toFixed(1)} hours)
- Payment follow-ups: ${totals.paymentFollowups}
- Operations (non-productive): ${totals.operations}
- Admissions closed: ${totals.admissions}

PER-COUNSELOR BREAKDOWN (worst to best):
${summaries.map(s => `- ${s.name} (${s.team}): ${s.calls} calling, ${s.followupAdmissions} follow-up admissions, ${s.schedules} schedules, ${s.demoMeetings} demos (${(s.demoMinutes/60).toFixed(1)}h), ${s.paymentFollowups} payment follow-ups, ${s.operations.length} operations${s.operations.length > 0 ? ' [Notes: ' + s.operations.join('; ') + ']' : ''}, ${s.admissions} admissions`).join('\n')}

INACTIVE COUNSELORS:
${consultants.filter(c => !summaries.find(s => s.name === c.name)).map(c => `- ${c.name}`).join('\n') || 'None'}

Structure your response EXACTLY as follows using markdown:

## Daily Performance Overview
Brief 2-3 line team summary with key metrics.

## Personalised Counselor Recommendations
Go through EACH counselor from WORST to BEST. For each:
### [Counselor Name] — [Rating: Needs Improvement / Average / Good / Excellent]
- What they did today (1 line summary)
- Specific recommendation for them (actionable, tailored to coaching-institute workflow)

## Operations Issues
List any operations entries with their notes and what action should be taken.

## Top 3 Action Items for Tomorrow
Numbered list of the most impactful things the team should focus on — prioritize demo meetings, follow-up admissions, and payment collection.`;

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a senior performance analyst for a coaching institute (Skillhub) handling IGCSE/CBSE student admissions. Provide structured, data-driven analysis with personalised recommendations for each counselor. Use markdown formatting with headers, bold, and bullet points.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
    });

    const analysis = completion.choices[0]?.message?.content || 'No analysis generated';
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const cost = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);

    await AIUsage.create({
        user: req.user.id,
        role: req.user.role,
        model: 'gpt-4o-mini',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost,
        dateRangeQueried: { startDate: date, endDate: date },
    });

    return res.status(200).json({ success: true, data: analysis });
}

// Skillhub leaderboard: same weighting as the analysis scoring above.
async function runSkillhubLeaderboard(req, res, { date, activities, dayAdmissions, consultants }) {
    const stats = {};
    for (const c of consultants) {
        stats[c._id.toString()] = {
            name: c.name,
            team: c.teamLead?.teamName || 'Unknown',
            calls: 0, followupAdmissions: 0, schedules: 0,
            demoMeetings: 0, demoMinutes: 0,
            paymentFollowups: 0, operations: 0, admissions: 0, activeSlots: 0,
        };
    }
    for (const act of activities) {
        const s = stats[act.consultant.toString()];
        if (!s) continue;
        s.activeSlots++;
        switch (act.activityType) {
            case 'sh_call': s.calls += act.count || 1; break;
            case 'sh_followup_admission': s.followupAdmissions += act.count || 1; break;
            case 'sh_schedule': s.schedules++; break;
            case 'sh_demo_meeting':
                s.demoMeetings++;
                s.demoMinutes += act.duration || 60;
                break;
            case 'sh_payment_followup': s.paymentFollowups += act.count || 1; break;
            case 'sh_operations': s.operations++; break;
            default: break;
        }
    }
    for (const adm of dayAdmissions) {
        const s = stats[adm.consultant.toString()];
        if (s) s.admissions += adm.count || 0;
    }
    const active = Object.values(stats).filter(s => s.activeSlots > 0 || s.admissions > 0);
    if (active.length === 0) {
        return res.status(200).json({ success: true, data: 'No activity data found for this date.' });
    }

    const prompt = `You are ranking Skillhub counselors for a daily leaderboard on ${date}.

Here is each counselor's data for today:
${active.map(s => `- ${s.name} (${s.team}): ${s.calls} calling, ${s.followupAdmissions} follow-up admissions, ${s.schedules} schedules, ${s.demoMeetings} demos (${(s.demoMinutes/60).toFixed(1)}h), ${s.paymentFollowups} payment follow-ups, ${s.operations} operations, ${s.admissions} admissions, ${s.activeSlots} active slots`).join('\n')}

RANKING CRITERIA (weights):
- Admissions closed are the highest value — most weight
- Demo Meetings convert students — high weight
- Follow-up Admission pushes deals forward — medium-high weight
- Payment follow-up is important for cashflow — medium weight
- Calling drives pipeline volume — medium weight
- Schedule is lower weight (planning, not execution)
- Operations are non-productive — lowers rank
- Reward balance across activities over single-metric dominance

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

## 🏆 Daily Leaderboard

### 🥇 1st Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary in 1 line]
- [Why they earned 1st place]

### 🥈 2nd Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary]
- [Why they earned 2nd]

### 🥉 3rd Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary]
- [Why they earned 3rd]

## Full Rankings
4. **[Name]** — Score: [X]/100 — [brief reason]
5. **[Name]** — Score: [X]/100 — [brief reason]
(continue for all active counselors)

## Key Takeaway
One sentence about what the top performers did differently today.`;

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a fair and data-driven performance ranker for a coaching institute. Rank counselors based on their daily activity using weighted scoring. Be concise. Use markdown.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
    });

    const leaderboard = completion.choices[0]?.message?.content || 'No leaderboard generated';
    const usage = completion.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const cost = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);

    await AIUsage.create({
        user: req.user.id,
        role: req.user.role,
        model: 'gpt-4o-mini',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost,
        dateRangeQueried: { startDate: date, endDate: date },
    });

    return res.status(200).json({ success: true, data: leaderboard });
}

// @desc    Get AI analysis of hourly tracker data for a given date
// @route   GET /api/hourly/ai-analysis
// @access  Private
exports.getAIAnalysis = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        const dateObj = parseDate(date);
        const scope = hourlyScopeFilter(req);
        const consultantScope = buildScopeFilter(req);
        const viewOrg = resolveViewOrg(req);

        const activities = await HourlyActivity.find({ ...scope, date: dateObj, isContinuation: { $ne: true } });
        const dayAdmissions = await DailyAdmission.find({ ...scope, date: dateObj });
        const consultants = await Consultant.find({ ...consultantScope, isActive: true }).populate('teamLead', 'name teamName');

        if (isSkillhub(viewOrg)) {
            return await runSkillhubAnalysis(req, res, {
                date,
                activities,
                dayAdmissions,
                consultants,
            });
        }

        // ── LUC flow (original) ──────────────────────────────────────
        const consultantStats = {};

        for (const c of consultants) {
            consultantStats[c._id.toString()] = {
                name: c.name,
                teamLead: c.teamLead?.name || 'Unknown',
                teamName: c.teamLead?.teamName || 'Unknown',
                calls: 0,
                followups: 0,
                operations: [],
                drips: 0,
                meetings: { offline: 0, zoom: 0, out: 0, team: 0 },
                activeSlots: 0,
                meetingMinutes: 0,
                admissions: 0,
            };
        }

        for (const act of activities) {
            const cid = act.consultant.toString();
            if (!consultantStats[cid]) continue;

            const stats = consultantStats[cid];
            stats.activeSlots++;

            switch (act.activityType) {
                case 'call':
                    stats.calls += act.count || 1;
                    break;
                case 'followup':
                    stats.followups += act.count || 1;
                    break;
                case 'noshow':
                    stats.operations.push(act.note || 'No note');
                    break;
                case 'drip':
                    stats.drips++;
                    break;
                case 'meeting':
                    stats.meetings.offline++;
                    stats.meetingMinutes += act.duration || 60;
                    break;
                case 'zoom':
                    stats.meetings.zoom++;
                    stats.meetingMinutes += act.duration || 60;
                    break;
                case 'outmeet':
                    stats.meetings.out++;
                    stats.meetingMinutes += act.duration || 60;
                    break;
                case 'teammeet':
                    stats.meetings.team++;
                    stats.meetingMinutes += act.duration || 60;
                    break;
                case 'call_followup':
                    stats.calls += act.count || 1;
                    break;
                default:
                    break;
            }
        }

        for (const adm of dayAdmissions) {
            const cid = adm.consultant.toString();
            if (consultantStats[cid]) {
                consultantStats[cid].admissions += adm.count || 0;
            }
        }

        // Build team totals
        const teamTotals = {
            totalCalls: 0,
            totalFollowups: 0,
            totalOperations: 0,
            totalDrips: 0,
            totalMeetings: 0,
            totalMeetingMinutes: 0,
            totalAdmissions: 0,
            activeConsultants: 0,
        };

        const consultantSummaries = [];
        for (const [, stats] of Object.entries(consultantStats)) {
            const totalMeetings = stats.meetings.offline + stats.meetings.zoom + stats.meetings.out + stats.meetings.team;
            if (stats.activeSlots > 0 || stats.admissions > 0) {
                teamTotals.activeConsultants++;
            }
            teamTotals.totalCalls += stats.calls;
            teamTotals.totalFollowups += stats.followups;
            teamTotals.totalOperations += stats.operations.length;
            teamTotals.totalDrips += stats.drips;
            teamTotals.totalMeetings += totalMeetings;
            teamTotals.totalMeetingMinutes += stats.meetingMinutes;
            teamTotals.totalAdmissions += stats.admissions;

            if (stats.activeSlots > 0 || stats.admissions > 0) {
                consultantSummaries.push({
                    name: stats.name,
                    team: stats.teamName,
                    calls: stats.calls,
                    followups: stats.followups,
                    operations: stats.operations,
                    drips: stats.drips,
                    meetings: totalMeetings,
                    meetingTypes: stats.meetings,
                    meetingHours: (stats.meetingMinutes / 60).toFixed(1),
                    activeSlots: stats.activeSlots,
                    admissions: stats.admissions,
                });
            }
        }

        if (consultantSummaries.length === 0) {
            return res.status(200).json({ success: true, data: 'No activity data found for this date.' });
        }

        // Sort consultants: lowest activity first (worst to best)
        consultantSummaries.sort((a, b) => {
            const scoreA = a.calls + a.followups + a.meetings + a.drips + (a.admissions * 10);
            const scoreB = b.calls + b.followups + b.meetings + b.drips + (b.admissions * 10);
            return scoreA - scoreB;
        });

        const prompt = `Analyze the following team daily performance data for ${date}.

TEAM TOTALS:
- Active Consultants: ${teamTotals.activeConsultants} out of ${consultants.length}
- Total Calls: ${teamTotals.totalCalls}
- Total Follow-ups: ${teamTotals.totalFollowups}
- Total Operations (non-productive): ${teamTotals.totalOperations}
- Total Drips: ${teamTotals.totalDrips}
- Total Meetings: ${teamTotals.totalMeetings} (${(teamTotals.totalMeetingMinutes / 60).toFixed(1)} hours)
- Total Admissions: ${teamTotals.totalAdmissions}

PER-CONSULTANT BREAKDOWN (sorted from lowest to highest activity):
${consultantSummaries.map(c => `- ${c.name} (${c.team}): ${c.calls} calls, ${c.followups} follow-ups, ${c.operations.length} operations${c.operations.length > 0 ? ' [Notes: ' + c.operations.join('; ') + ']' : ''}, ${c.drips} drips, ${c.meetings} meetings (${c.meetingHours}h - offline:${c.meetingTypes.offline} zoom:${c.meetingTypes.zoom} out:${c.meetingTypes.out} team:${c.meetingTypes.team}), ${c.activeSlots} active time slots, ${c.admissions} admissions`).join('\n')}

INACTIVE CONSULTANTS (no activity logged today):
${consultants.filter(c => !consultantSummaries.find(s => s.name === c.name)).map(c => `- ${c.name}`).join('\n') || 'None'}

Structure your response EXACTLY as follows using markdown:

## Daily Performance Overview
Brief 2-3 line team summary with key metrics.

## Personalised Consultant Recommendations
Go through EACH consultant from the WORST performer to the BEST. For each:
### [Consultant Name] — [Rating: Needs Improvement / Average / Good / Excellent]
- What they did today (1 line summary)
- Specific recommendation for them (actionable, personalised)

## Operations Issues
List any operations entries with their notes and what action should be taken.

## Top 3 Action Items for Tomorrow
Numbered list of the most impactful things the team should focus on.`;

        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a senior performance analyst for an education consultancy. Provide structured, data-driven analysis with personalised recommendations for each consultant. Use markdown formatting with headers, bold, and bullet points.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 3000,
        });

        const analysis = completion.choices[0]?.message?.content || 'No analysis generated';

        // Track AI usage cost
        const usage = completion.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        // gpt-4o-mini pricing: $0.15/1M input, $0.60/1M output
        const cost = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);

        await AIUsage.create({
            user: req.user.id,
            role: req.user.role,
            model: 'gpt-4o-mini',
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cost,
            dateRangeQueried: { startDate: date, endDate: date },
        });

        res.status(200).json({ success: true, data: analysis });
    } catch (error) {
        next(error);
    }
};

// @desc    Get AI-powered leaderboard for a given date
// @route   GET /api/hourly/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        const dateObj = parseDate(date);
        const scope = hourlyScopeFilter(req);
        const consultantScope = buildScopeFilter(req);
        const viewOrg = resolveViewOrg(req);
        const activities = await HourlyActivity.find({ ...scope, date: dateObj, isContinuation: { $ne: true } });
        const dayAdmissions = await DailyAdmission.find({ ...scope, date: dateObj });
        const consultants = await Consultant.find({ ...consultantScope, isActive: true }).populate('teamLead', 'name teamName');

        if (isSkillhub(viewOrg)) {
            return await runSkillhubLeaderboard(req, res, {
                date, activities, dayAdmissions, consultants,
            });
        }

        const consultantStats = {};
        for (const c of consultants) {
            consultantStats[c._id.toString()] = {
                name: c.name,
                team: c.teamLead?.teamName || 'Unknown',
                calls: 0, followups: 0, operations: 0, drips: 0,
                meetings: { offline: 0, zoom: 0, out: 0, team: 0 },
                activeSlots: 0, meetingMinutes: 0, admissions: 0,
            };
        }

        for (const act of activities) {
            const cid = act.consultant.toString();
            if (!consultantStats[cid]) continue;
            const s = consultantStats[cid];
            s.activeSlots++;
            if (act.activityType === 'call') s.calls += act.count || 1;
            else if (act.activityType === 'followup') s.followups += act.count || 1;
            else if (act.activityType === 'call_followup') { s.calls += act.count || 1; s.followups += act.count || 1; }
            else if (act.activityType === 'noshow') s.operations++;
            else if (act.activityType === 'drip') s.drips++;
            else if (act.activityType === 'meeting') { s.meetings.offline++; s.meetingMinutes += act.duration || 60; }
            else if (act.activityType === 'zoom') { s.meetings.zoom++; s.meetingMinutes += act.duration || 60; }
            else if (act.activityType === 'outmeet') { s.meetings.out++; s.meetingMinutes += act.duration || 60; }
            else if (act.activityType === 'teammeet') { s.meetings.team++; s.meetingMinutes += act.duration || 60; }
        }

        for (const adm of dayAdmissions) {
            const cid = adm.consultant.toString();
            if (consultantStats[cid]) consultantStats[cid].admissions += adm.count || 0;
        }

        const activeConsultants = Object.values(consultantStats).filter(s => s.activeSlots > 0 || s.admissions > 0);

        if (activeConsultants.length === 0) {
            return res.status(200).json({ success: true, data: 'No activity data found for this date.' });
        }

        const prompt = `You are ranking consultants for a daily leaderboard on ${date}.

Here is each consultant's data for today:
${activeConsultants.map(c => {
    const totalMtgs = c.meetings.offline + c.meetings.zoom + c.meetings.out + c.meetings.team;
    return `- ${c.name} (${c.team}): ${c.calls} calls, ${c.followups} follow-ups, ${c.drips} drips, ${totalMtgs} meetings (${(c.meetingMinutes/60).toFixed(1)}h), ${c.operations} operations, ${c.admissions} admissions, ${c.activeSlots} active slots`;
}).join('\n')}

RANKING CRITERIA (use your judgement with these weights):
- Admissions are the most valuable (actual conversions) — highest weight
- Meetings indicate direct client engagement — high weight
- Follow-ups show persistence and pipeline nurturing — medium weight
- Calls are important for volume but quality matters more — medium weight
- Drips show marketing effort — lower weight
- Operations are non-productive time — should lower rank
- Consider overall balance: a consultant with calls + meetings + follow-ups is better than one who only makes calls

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

## 🏆 Daily Leaderboard

### 🥇 1st Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary in 1 line]
- [Why they earned 1st place]

### 🥈 2nd Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary]
- [Why they earned 2nd]

### 🥉 3rd Place — [Name]
**Score: [X]/100** | Team: [Team Name]
- [Key stats summary]
- [Why they earned 3rd]

## Full Rankings
4. **[Name]** — Score: [X]/100 — [brief reason]
5. **[Name]** — Score: [X]/100 — [brief reason]
(continue for all active consultants)

## Key Takeaway
One sentence about what the top performers did differently today.`;

        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a fair and data-driven performance ranker for an education consultancy. Rank consultants based on their daily activity data using weighted scoring. Be concise. Use markdown.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 2000,
        });

        const leaderboard = completion.choices[0]?.message?.content || 'No leaderboard generated';

        const usage = completion.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const cost = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);

        await AIUsage.create({
            user: req.user.id,
            role: req.user.role,
            model: 'gpt-4o-mini',
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            cost,
            dateRangeQueried: { startDate: date, endDate: date },
        });

        res.status(200).json({ success: true, data: leaderboard });
    } catch (err) {
        next(err);
    }
};
