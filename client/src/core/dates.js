
/**
 * Date helpers.
 *
 * Days are passed around as local-time keys like "2026-09-28" ("day keys").
 * Weekdays use ISO numbers: 1 = Monday ... 7 = Sunday.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Date -> "YYYY-MM-DD" in local time. */
export function toKey(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date at local midnight. */
export function fromKey(key) {
	const [year, month, day] = key.split('-').map(Number);
	return new Date(year, month - 1, day);
}

/** A new date `days` after `date` (negative goes back). */
export function addDays(date, days) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The day key `days` after `key`. */
export function addDaysToKey(key, days) {
	return toKey(addDays(fromKey(key), days));
}

/** The first day of the month that contains `date`. */
export function firstOfMonth(date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The first day of the month `step` months after `month`. */
export function shiftMonth(month, step) {
	return new Date(month.getFullYear(), month.getMonth() + step, 1);
}

/** 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date) {
	return date.getDay() || 7;
}

/** The Monday of the week that contains `date`. */
function mondayOf(date) {
	return addDays(date, 1 - isoWeekday(date));
}

/** How many weeks (rows) the month of `date` needs in a calendar that starts on Mondays: 4 to 6. */
export function weeksInMonth(date) {
	const month = firstOfMonth(date);
	const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
	return Math.ceil((isoWeekday(month) - 1 + days) / 7);
}

/**
 * The days a calendar shows for the month of `date`: whole weeks, Monday first,
 * starting with the week of the 1st (so a few days of the months around it too).
 * @param {Date} date
 * @param {number} [weeks] How many weeks: the month's own (weeksInMonth) unless given.
 * @returns {Date[]}
 */
export function calendarDays(date, weeks = weeksInMonth(date)) {
	const first = mondayOf(firstOfMonth(date));
	return Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
}

/** Calendar days from `from`'s day to `to`'s (0: the same day; negative when `to` is earlier). */
export function daysBetween(from, to) {
	return Math.round((fromKey(toKey(to)) - fromKey(toKey(from))) / DAY_MS);
}

/** Whole weeks from the week of `a` to the week of `b` (negative when `b` is earlier). */
export function weeksBetween(a, b) {
	// Rounding absorbs the one-hour difference around daylight-saving changes.
	return Math.round((mondayOf(b) - mondayOf(a)) / WEEK_MS);
}

/** Weekday names in the given language, Monday first. */
export function weekdayNames(locale, style = 'short') {
	const format = new Intl.DateTimeFormat(locale, { weekday: style });
	const aMonday = new Date(2024, 0, 1);
	return Array.from({ length: 7 }, (_, i) => format.format(addDays(aMonday, i)));
}

/** How dates are written on screen, by name (see formatDate). */
const DATE_STYLES = {
	weekday: { weekday: 'long' },                                           // "Tuesday"
	month: { month: 'long' },                                               // "September"
	monthYear: { month: 'long', year: 'numeric' },                          // "September 2026"
	short: { weekday: 'short', day: 'numeric', month: 'short' },            // "Tue, Sep 29"
	date: { day: 'numeric', month: 'short', year: 'numeric' },              // "Sep 29, 2026"
	full: { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, // "Tue, Sep 29, 2026"
};

/**
 * A date written for the screen, in the given language.
 * @param {Date} date
 * @param {string} locale e.g. 'en-US'
 * @param {keyof DATE_STYLES} style
 */
export function formatDate(date, locale, style) {
	return date.toLocaleDateString(locale, DATE_STYLES[style]);
}

/** "08:05" style 24-hour time. */
export function clockText(date) {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Minutes since midnight of an "HH:MM" time. */
export function minutesOf(time) {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

/** Minutes from `from` to `to` (both minutes since midnight), going forward round the clock: 0–1439. */
export function minutesAfter(from, to) {
	return (((to - from) % 1440) + 1440) % 1440;
}

/**
 * True if `time` is within `from`..`until`, both included, wrapping past midnight
 * (all "HH:MM"). E.g. 23:30 is within 20:00..07:00.
 */
export function isWithin(time, from, until) {
	const start = minutesOf(from);
	return minutesAfter(start, minutesOf(time)) <= minutesAfter(start, minutesOf(until));
}

/**
 * True if `date`'s time of day is from `from` up to (not including) `until`, both
 * "HH:MM", wrapping past midnight (e.g. 22:00 to 07:00). Equal times mean never.
 */
export function isInTimeRange(date, from, until) {
	const start = minutesOf(from);
	const now = date.getHours() * 60 + date.getMinutes();
	return minutesAfter(start, now) < minutesAfter(start, minutesOf(until));
}

/** A time range as text, e.g. "22:00–07:00". @param {{from: string, until: string}} range */
export function timeRangeText({ from, until }) {
	return `${from}–${until}`;
}

/** Two-digit number, e.g. 7 -> "07". */
export function pad(number) {
	return String(number).padStart(2, '0');
}
