const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const Consultant = require('../models/Consultant');
const AIUsage = require('../models/AIUsage');
const { SLOTS, getContinuationSlots } = require('../utils/hourlyConstants');
const OpenAI = require('openai');

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

// Helper: check if date is exactly today (for strict validation)
function isTodayStr(dateStr) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
}

// @desc    Get all active consultants (shared view, no role scoping)
// @route   GET /api/hourly/consultants
// @access  Private
exports.getConsultants = async (req, res, next) => {
    try {
        const consultants = await Consultant.find({ isActive: true })
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
        const activities = await HourlyActivity.find({ date: dateObj });

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

        // Clear old continuations from this slot first
        await HourlyActivity.deleteMany({
            consultant: consultantId,
            date: dateObj,
            isContinuation: true,
            parentSlotId: slotId,
        });

        // Upsert the main slot
        const slotDef = SLOTS.find((s) => s.id === slotId);
        const dur = duration || (slotDef ? slotDef.mins : 60);

        const activity = await HourlyActivity.findOneAndUpdate(
            { consultant: consultantId, date: dateObj, slotId },
            {
                consultant: consultantId,
                consultantName: consultantName || '',
                date: dateObj,
                slotId,
                activityType,
                count: count || 1,
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
            const contSlots = getContinuationSlots(slotId, dur);
            for (const csid of contSlots) {
                await HourlyActivity.findOneAndUpdate(
                    { consultant: consultantId, date: dateObj, slotId: csid },
                    {
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
        await HourlyActivity.deleteMany({ date: dateObj });

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
        const admissions = await DailyAdmission.find({ date: dateObj });
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

        if (admCount === 0) {
            await DailyAdmission.deleteOne({
                consultant: consultantId,
                date: dateObj,
            });
        } else {
            await DailyAdmission.findOneAndUpdate(
                { consultant: consultantId, date: dateObj },
                {
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
            date: { $gte: startDate, $lte: endDate },
        });
        res.status(200).json({ success: true, data: admissions });
    } catch (error) {
        next(error);
    }
};

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

        // Get all non-continuation activities for the date
        const activities = await HourlyActivity.find({ date: dateObj, isContinuation: { $ne: true } });

        // Get all admissions for the date
        const dayAdmissions = await DailyAdmission.find({ date: dateObj });

        // Get all active consultants
        const consultants = await Consultant.find({ isActive: true }).populate('teamLead', 'name teamName');

        // Build per-consultant stats
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
        const activities = await HourlyActivity.find({ date: dateObj, isContinuation: { $ne: true } });
        const dayAdmissions = await DailyAdmission.find({ date: dateObj });
        const consultants = await Consultant.find({ isActive: true }).populate('teamLead', 'name teamName');

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
