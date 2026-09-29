
/**
 * Small text helpers for messages on screen.
 */

const lastPicked = new WeakMap(); // list -> the item picked from it last time

/**
 * A random item from `list`, never the same one twice in a row (each list
 * remembers its own last pick), so repeated messages still feel fresh.
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
export function pickOne(list) {
	const last = lastPicked.get(list);
	const choices = list.length > 1 ? list.filter((item) => item !== last) : list;
	const item = choices[Math.floor(Math.random() * choices.length)] ?? list[0];
	lastPicked.set(list, item);
	return item;
}

/**
 * One of the remarks in `list` (see pickOne), ready to show. A remark is a text,
 * or a function that fills details into one, e.g. (name) => `Added “${name}”`.
 * @param {Array<string|((...values: any[]) => string)>} list
 * @param {...any} values Handed to a function remark.
 */
export function say(list, ...values) {
	const remark = pickOne(list);
	return typeof remark === 'function' ? remark(...values) : remark;
}

/** "1 habit", "3 habits". */
export function plural(count, word) {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}
