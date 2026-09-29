
/**
 * The settings kept in the data file: their choices (in the order their round
 * buttons step through them), how each is called on screen, and the defaults.
 * The one place these are listed; data_format.js and the controllers use it.
 */

import { isWithin, minutesAfter, minutesOf } from '../core/dates.js';

export const CHOICES = {
	theme: {
		order: ['light', 'dark', 'auto'],
		labels: { light: 'Light', dark: 'Dark', auto: 'Auto' },
		fallback: 'light',
	},
	brightness: {
		order: ['bright', 'dim', 'auto'],
		labels: { bright: 'Bright', dim: 'Dim', auto: 'Auto' },
		fallback: 'auto',
	},
	screen: {
		order: ['never', 'idle', 'auto'],
		labels: { never: 'Always on', idle: 'Off when idle', auto: 'Auto' },
		fallback: 'auto',
	},
	motion: {
		order: ['bouncy', 'calm'],
		labels: { bouncy: 'Bouncy', calm: 'Calm' },
		fallback: 'bouncy',
	},
};

/**
 * The time ranges set in Settings, and their defaults: the night time for the
 * Auto theme, the sleep time for Auto brightness and the Auto screen.
 */
export const TIME_RANGES = Object.freeze({
	nightTime: Object.freeze({ from: '20:00', until: '07:00' }),
	sleepTime: Object.freeze({ from: '22:00', until: '07:00' }),
});

/**
 * The sleep time moved inside the night time (it must never reach beyond it): an
 * end outside the night moves to the night's matching end, and a sleep time
 * that would run backwards ends when the night does.
 * @param {{from: string, until: string}} night
 * @param {{from: string, until: string}} sleep
 * @returns {{from: string, until: string}}
 */
export function fitSleepIntoNight(night, sleep) {
	const inside = (time) => isWithin(time, night.from, night.until);
	const from = inside(sleep.from) ? sleep.from : night.from;
	let until = inside(sleep.until) ? sleep.until : night.until;
	const start = minutesOf(night.from);
	if (minutesAfter(start, minutesOf(from)) > minutesAfter(start, minutesOf(until))) until = night.until;
	return { from, until };
}

/**
 * `value` if it is one of setting `key`'s choices, else the fallback.
 * @param {keyof CHOICES} key
 */
export function validChoice(key, value) {
	return CHOICES[key].order.includes(value) ? value : CHOICES[key].fallback;
}

/**
 * Moves setting `key` on to its next choice (after the last comes the first).
 * @param {object} settings The data's settings.
 * @param {keyof CHOICES} key
 * @returns {string} The new choice.
 */
export function nextChoice(settings, key) {
	const { order } = CHOICES[key];
	settings[key] = order[(order.indexOf(settings[key]) + 1) % order.length];
	return settings[key];
}

/** How choice `value` of setting `key` is called, e.g. "Off when idle". */
export function choiceLabel(key, value) {
	return CHOICES[key].labels[value] ?? value;
}
