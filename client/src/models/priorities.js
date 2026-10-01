
/**
 * A habit's priority. Today shows the most important first; the habit editor's
 * round button steps through them in this order. The server checks the same
 * (server/troha_server/data_format.py).
 */

/** From least to most important. */
export const PRIORITIES = ['low', 'medium', 'high'];
export const DEFAULT_PRIORITY = 'medium';

/** How each is called (spoken by the editor's button, and in Manage's tags). */
export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

/** The habits, most important first; within a priority they keep their order (sort is stable). */
export function byPriority(habits) {
	const rank = (habit) => PRIORITIES.indexOf(habit.priority);
	return [...habits].sort((a, b) => rank(b) - rank(a));
}
