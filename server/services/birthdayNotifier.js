// Student birthday reminders for the Skillhub Institute.
//
// Counselors enter each student's date of birth but had no way to be reminded
// of it, so birthdays were being missed. A daily job posts two in-app
// notifications: a heads-up the day before, and one on the morning itself.
//
// Matching is on month + day only (the year is the birth year), evaluated
// against the Asia/Dubai calendar date so the reminder lands on the branch's
// own "today" rather than UTC's.
const Student = require('../models/Student');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { ORG_SKILLHUB_INSTITUTE } = require('../config/organizations');

const TIMEZONE = 'Asia/Dubai';
const ORG = ORG_SKILLHUB_INSTITUTE;

// Calendar date in the branch's timezone, as {year, month, day}. Using
// formatToParts avoids the off-by-one you get from comparing a UTC-midnight
// Date against local time.
function localDateParts(now = new Date(), timeZone = TIMEZONE) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    return { year: get('year'), month: get('month'), day: get('day') };
}

function addDays({ year, month, day }, n) {
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + n);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Students in `organization` whose birthday falls on the given month/day.
// dob is a date-only value stored at UTC midnight, so $month/$dayOfMonth in
// UTC read back exactly what was entered.
async function findBirthdays({ month, day }, organization = ORG) {
    return Student.aggregate([
        {
            $match: {
                organization,
                dob: { $ne: null, $exists: true },
                $expr: {
                    $and: [
                        { $eq: [{ $month: '$dob' }, month] },
                        { $eq: [{ $dayOfMonth: '$dob' }, day] },
                    ],
                },
            },
        },
        { $project: { studentName: 1, dob: 1, yearOrGrade: 1, curriculum: 1 } },
        { $sort: { studentName: 1 } },
    ]);
}

// Birthdays falling in the next `days` days (0 = today), soonest first.
// One query plus JS rather than a query per day — the roster is small and this
// keeps it to a single round trip. Backs the "Upcoming birthdays" panel, which
// is what makes the reminder visible before the day itself arrives.
async function upcomingBirthdays({ now = new Date(), days = 45, organization = ORG } = {}) {
    const today = localDateParts(now);
    const todayUTC = Date.UTC(today.year, today.month - 1, today.day);

    const students = await Student.find({
        organization,
        dob: { $ne: null, $exists: true },
    }).select('studentName dob yearOrGrade curriculum').lean();

    const out = [];
    for (const s of students) {
        const dob = new Date(s.dob);
        if (Number.isNaN(dob.getTime())) continue;
        const month = dob.getUTCMonth() + 1;
        const day = dob.getUTCDate();
        // This year's occurrence; if it has passed, roll to next year. A 29 Feb
        // birthday lands on 1 Mar in a non-leap year, which is how Date rolls it.
        let next = Date.UTC(today.year, month - 1, day);
        if (next < todayUTC) next = Date.UTC(today.year + 1, month - 1, day);
        const daysAway = Math.round((next - todayUTC) / 86400000);
        if (daysAway > days) continue;
        const on = new Date(next);
        out.push({
            studentName: s.studentName,
            yearOrGrade: s.yearOrGrade || '',
            curriculum: s.curriculum || '',
            date: on.toISOString().slice(0, 10),
            daysAway,
            turning: ageTurning(s.dob, { year: on.getUTCFullYear() }),
        });
    }
    out.sort((a, b) => a.daysAway - b.daysAway || a.studentName.localeCompare(b.studentName));
    return out;
}

// A handful of records were entered with the CURRENT year as the birth year
// (a Grade 11 student "born" in 2025), which would otherwise render as
// "turns 0". No school student is under 3, so treat anything below that as a
// mistyped year and simply omit the age — the birthday itself still shows, and
// a missing age reads far better than an obviously wrong one.
const MIN_PLAUSIBLE_STUDENT_AGE = 3;

// Age they turn on that date (null when the birth year is missing/implausible).
function ageTurning(dob, { year }) {
    const born = new Date(dob).getUTCFullYear();
    if (!born || born < 1900) return null;
    const age = year - born;
    return age >= MIN_PLAUSIBLE_STUDENT_AGE && age < 120 ? age : null;
}

function describe(students, target) {
    return students
        .map((s) => {
            const age = ageTurning(s.dob, target);
            const bits = [s.yearOrGrade, age ? `turns ${age}` : null].filter(Boolean);
            return bits.length ? `${s.studentName} (${bits.join(', ')})` : s.studentName;
        })
        .join(', ');
}

// Everyone who should see the reminder: the branch's own logins plus admins.
async function recipients(organization = ORG) {
    return User.find({
        isActive: true,
        $or: [{ organization }, { role: 'admin' }],
    }).select('_id').lean();
}

/**
 * Post the birthday notifications for one run.
 * Idempotent: a notification with the same title for the same user on the same
 * local day is never posted twice, so a retry or a double-scheduled run is safe.
 */
async function runBirthdayNotifications({ now = new Date(), organization = ORG } = {}) {
    const today = localDateParts(now);
    const tomorrow = addDays(today, 1);

    const [todayStudents, tomorrowStudents] = await Promise.all([
        findBirthdays(today, organization),
        findBirthdays(tomorrow, organization),
    ]);

    const batches = [
        {
            students: todayStudents,
            target: today,
            title: todayStudents.length === 1
                ? `🎂 Birthday today — ${todayStudents[0].studentName}`
                : `🎂 ${todayStudents.length} birthdays today`,
            priority: 'high',
        },
        {
            students: tomorrowStudents,
            target: tomorrow,
            title: tomorrowStudents.length === 1
                ? `🎂 Birthday tomorrow — ${tomorrowStudents[0].studentName}`
                : `🎂 ${tomorrowStudents.length} birthdays tomorrow`,
            priority: 'low',
        },
    ].filter((b) => b.students.length > 0);

    if (!batches.length) return { created: 0, today: 0, tomorrow: 0 };

    const users = await recipients(organization);
    if (!users.length) return { created: 0, today: todayStudents.length, tomorrow: tomorrowStudents.length };

    // Anything already posted for this local day, so a re-run is a no-op.
    const dayStart = new Date(Date.UTC(today.year, today.month - 1, today.day));
    const existing = await Notification.find({
        type: 'student_birthday',
        createdAt: { $gte: dayStart },
    }).select('user title').lean();
    const seen = new Set(existing.map((n) => `${n.user}|${n.title}`));

    const docs = [];
    for (const batch of batches) {
        const message = describe(batch.students, batch.target);
        for (const u of users) {
            if (seen.has(`${u._id}|${batch.title}`)) continue;
            docs.push({
                user: u._id,
                type: 'student_birthday',
                title: batch.title,
                message,
                priority: batch.priority,
            });
        }
    }
    if (docs.length) await Notification.insertMany(docs);
    return { created: docs.length, today: todayStudents.length, tomorrow: tomorrowStudents.length };
}

module.exports = {
    runBirthdayNotifications,
    findBirthdays,
    upcomingBirthdays,
    localDateParts,
    addDays,
    ageTurning,
    TIMEZONE,
};
