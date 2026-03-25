const HourlyActivity = require('../models/HourlyActivity');
const DailyAdmission = require('../models/DailyAdmission');
const Consultant = require('../models/Consultant');
const { SLOTS, getContinuationSlots } = require('../utils/hourlyConstants');

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
