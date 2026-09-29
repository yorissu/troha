
/**
 * The shape of the data file, and conversion to and from it.
 *
 * In memory:
 *   {
 *     version: 1,
 *     habits: [{ id, name, nameEncrypted, days, everyWeeks, startDate, color, private }],
 *     log: { "YYYY-MM-DD": { total, done: [habit ids] } },
 *     settings: { theme, brightness, screen, motion, nightTime: { from, until }, sleepTime: { from, until } },   (times are "HH:MM")
 *     security: { pin: { salt, iterations, hash, length? }, keySalt, failedAttempts, lockedUntil },
 *   }
 * A private habit's `name` is null while locked; in the file it only has `nameEncrypted`.
 *
 * fromFile() never trusts the file: anything missing, malformed or impossible (e.g.
 * a hand-edited typo, or 31 February) is dropped or replaced by a safe default, so
 * the rest of the app can rely on this shape.
 */

import { CHOICES, TIME_RANGES, fitSleepIntoNight, validChoice } from './settings.js';

export const MAX_EVERY_WEEKS = 52;
const FALLBACK_START = '2000-01-03'; // a Monday, long ago: "has always been on"

/** Habit colours by their old names, from before the palette was reworked. */
const OLD_COLORS = {
	powder: 'sky', denim: 'periwinkle', sage: 'pistachio', oat: 'lilac',
	pebble: 'mint', apricot: 'peach', ochre: 'butter', rose: 'blush',
};

/** Fills in anything missing or malformed. */
export function fromFile(raw) {
	const file = isObject(raw) ? raw : {};
	const habits = uniqueById((Array.isArray(file.habits) ? file.habits : [])
		.filter((habit) => isObject(habit) && isId(habit.id) && !habit.deletedOn) // very old files kept deleted habits
		.filter((habit) => typeof habit.name === 'string' || isEncrypted(habit.nameEncrypted))
		.map(habitFromFile));

	return {
		version: 1,
		settings: settingsFromFile(file.settings),
		security: securityFromFile(file.security),
		habits,
		log: logFromFile(file.log),
	};
}

/** What goes into the file: private habits carry only their encrypted name. */
export function toFile(data) {
	return {
		version: data.version,
		settings: data.settings,
		security: data.security,
		habits: data.habits.map(({ name, nameEncrypted, ...habit }) =>
			habit.private && nameEncrypted ? { ...habit, nameEncrypted } : { ...habit, name }),
		log: data.log,
	};
}

/** An empty security section (no PIN). */
export function emptySecurity() {
	return { pin: null, keySalt: null, failedAttempts: 0, lockedUntil: null };
}

/** True for a real calendar day written as "YYYY-MM-DD" (not e.g. "2026-02-31"). */
export function isDayKey(value) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** True for a time of day written as "HH:MM" (00:00 to 23:59). */
export function isTime(value) {
	return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function settingsFromFile(raw) {
	const settings = isObject(raw) ? raw : {};
	const timeRange = (key) => {
		const raw = settings[key] ?? (key === 'nightTime' ? settings.eveningTime : undefined); // its old name
		const range = isObject(raw) ? raw : {};
		return isTime(range.from) && isTime(range.until) ? { from: range.from, until: range.until } : { ...TIME_RANGES[key] };
	};
	const nightTime = timeRange('nightTime');
	return {
		...Object.fromEntries(Object.keys(CHOICES).map((key) => [key, validChoice(key, settings[key])])),
		nightTime,
		sleepTime: fitSleepIntoNight(nightTime, timeRange('sleepTime')), // never beyond the night
	};
}

function habitFromFile(habit) {
	const days = Array.isArray(habit.days)
		? [...new Set(habit.days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b)
		: [];
	return {
		id: habit.id,
		name: typeof habit.name === 'string' ? habit.name : null, // null: private and still locked
		nameEncrypted: isEncrypted(habit.nameEncrypted) ? { iv: habit.nameEncrypted.iv, data: habit.nameEncrypted.data } : null,
		days,
		everyWeeks: Number.isInteger(habit.everyWeeks) && habit.everyWeeks >= 1 && habit.everyWeeks <= MAX_EVERY_WEEKS ? habit.everyWeeks : 1,
		startDate: isDayKey(habit.startDate) ? habit.startDate : FALLBACK_START,
		color: typeof habit.color === 'string' ? OLD_COLORS[habit.color] ?? habit.color : '',
		private: habit.private === true,
	};
}

function logFromFile(raw) {
	if (!isObject(raw)) return {};
	const log = {};
	for (const [day, entry] of Object.entries(raw)) {
		if (!isDayKey(day) || !isObject(entry)) continue;
		const done = [...new Set(idList(entry.done))];
		// Very old files listed the due habits in "scheduled"; only the count is kept now.
		const total = Number.isInteger(entry.total) && entry.total >= 0 ? entry.total : idList(entry.scheduled).length;
		log[day] = { total, done };
	}
	return log;
}

function securityFromFile(raw) {
	const security = isObject(raw) ? raw : {};
	const pin = security.pin;
	const validPin = isObject(pin) && isHex(pin.salt) && isHex(pin.hash) && Number.isInteger(pin.iterations) && pin.iterations > 0;
	return {
		pin: validPin ? { salt: pin.salt, iterations: pin.iterations, hash: pin.hash, length: isPinLength(pin.length) ? pin.length : null } : null,
		keySalt: isHex(security.keySalt) ? security.keySalt : null,
		failedAttempts: Number.isInteger(security.failedAttempts) && security.failedAttempts >= 0 ? security.failedAttempts : 0,
		lockedUntil: Number.isFinite(security.lockedUntil) ? security.lockedUntil : null,
	};
}

/** Keeps the first habit of each id (a copy-paste in the file can't make two). */
function uniqueById(habits) {
	const seen = new Set();
	return habits.filter((habit) => !seen.has(habit.id) && seen.add(habit.id));
}

function isObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isId(value) {
	return typeof value === 'string' && value.length > 0;
}

function isHex(value) {
	return typeof value === 'string' && value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

/** A PIN's number of digits (older files don't have it). */
function isPinLength(value) {
	return Number.isInteger(value) && value >= 1 && value <= 32;
}

function isEncrypted(box) {
	return isObject(box) && isHex(box.iv) && isHex(box.data);
}

function idList(value) {
	return Array.isArray(value) ? value.filter(isId) : [];
}
