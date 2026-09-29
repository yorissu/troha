
/**
 * When does a habit happen?
 *
 * A habit looks like:
 *   { days: [1, 4], everyWeeks: 2, startDate: "2026-10-05", ... }
 * meaning: on Mondays and Thursdays, from 5 October on, every 2nd week
 * (weeks are counted from the week that contains startDate).
 */

import { toKey, fromKey, isoWeekday, weeksBetween } from './dates.js';

/** True if `habit` is due on `date`. */
function isScheduled(habit, date) {
	if (toKey(date) < habit.startDate) return false; // hasn't started yet
	if (!habit.days.includes(isoWeekday(date))) return false;
	const weeks = weeksBetween(fromKey(habit.startDate), date);
	return weeks >= 0 && weeks % habit.everyWeeks === 0;
}

/** The habits due on `date`, in their stored order. */
export function habitsOn(habits, date) {
	return habits.filter((habit) => isScheduled(habit, date));
}

/**
 * Short human text, e.g. "Mon, Thu · every 2 weeks".
 * @param {object} habit
 * @param {string[]} dayNames Short weekday names, Monday first.
 */
export function describeSchedule(habit, dayNames) {
	const days = [...habit.days].sort((a, b) => a - b);
	const pattern = days.join('');

	let text;
	if (pattern === '1234567') text = habit.everyWeeks === 1 ? 'Every day' : 'All week';
	else if (pattern === '12345') text = 'Weekdays';
	else if (pattern === '67') text = 'Weekends';
	else text = days.map((day) => dayNames[day - 1]).join(', ');

	const repeat = repeatText(habit);
	return repeat ? `${text} · ${repeat}` : text;
}

/** "every 2 weeks" for a habit that skips weeks; null for a weekly one. */
export function repeatText(habit) {
	return habit.everyWeeks > 1 ? `every ${habit.everyWeeks} weeks` : null;
}
