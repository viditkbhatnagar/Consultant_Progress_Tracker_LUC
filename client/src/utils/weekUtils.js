import { startOfWeek, endOfWeek, getWeek, getYear, format } from 'date-fns';

/**
 * Get the current week number (1-52/53)
 */
export const getCurrentWeekNumber = () => {
    return getWeek(new Date(), { weekStartsOn: 1 }); // Monday is start of week
};

/**
 * Get the current year
 */
export const getCurrentYear = () => {
    return getYear(new Date());
};

/**
 * Get the start date of a week (Monday)
 */
export const getWeekStartDate = (date = new Date()) => {
    return startOfWeek(date, { weekStartsOn: 1 });
};

/**
 * Get the end date of a week (Sunday)
 */
export const getWeekEndDate = (date = new Date()) => {
    return endOfWeek(date, { weekStartsOn: 1 });
};

/**
 * Format week display: e.g., "Week 48: Dec 2 - Dec 8, 2024"
 */
export const formatWeekDisplay = (weekNumber, year, startDate, endDate) => {
    const start = format(new Date(startDate), 'MMM d');
    const end = format(new Date(endDate), 'MMM d, yyyy');
    return `Week ${weekNumber}: ${start} - ${end}`;
};

/**
 * Check if a date is in the current week
 */
export const isCurrentWeek = (date) => {
    const currentWeekNum = getCurrentWeekNumber();
    const currentYr = getCurrentYear();
    const dateWeekNum = getWeek(new Date(date), { weekStartsOn: 1 });
    const dateYear = getYear(new Date(date));

    return currentWeekNum === dateWeekNum && currentYr === dateYear;
};

/**
 * Check if a week is in the past
 */
export const isPastWeek = (weekNumber, year) => {
    const currentWeekNum = getCurrentWeekNumber();
    const currentYr = getCurrentYear();

    if (year < currentYr) return true;
    if (year > currentYr) return false;
    return weekNumber < currentWeekNum;
};

/**
 * Format a date as "<Month> W<n>" where n is the 1-indexed week of the month
 * (Apr 1-7 → W1, 8-14 → W2, etc.). Falls back to weekStartDate when the
 * primary date is missing.
 */
export const formatWeekOfMonth = (primary, fallback) => {
    // Anchor to the week-start (Monday) when available and attribute by the
    // week's Thursday (ISO 8601), so a month-straddling week lands in the
    // month that holds most of it (e.g. Apr 27–May 3 → April), instead of
    // following a stray commitmentDate. Keep `primary` as the fallback for
    // callers that only pass a single date.
    const anchor = fallback || primary;
    if (!anchor) return '';
    const d = new Date(anchor);
    if (Number.isNaN(d.getTime())) return '';
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    const thu = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 3);
    const weekOfMonth = Math.ceil(thu.getDate() / 7);
    return `${format(thu, 'MMMM')} W${weekOfMonth}`;
};

/**
 * Get week info for a date
 */
export const getWeekInfo = (date = new Date()) => {
    const weekNumber = getWeek(date, { weekStartsOn: 1 });
    const year = getYear(date);
    const weekStartDate = getWeekStartDate(date);
    const weekEndDate = getWeekEndDate(date);

    return {
        weekNumber,
        year,
        weekStartDate,
        weekEndDate,
    };
};
