
/**
 * The settings kept with each account that have a round button in the sidebar:
 * their choices (in the order the button steps through them), and how each is
 * called and drawn on screen. The server checks the same choices and fills in the
 * defaults (server/troha_server/data_format.py).
 */

import { isWithin, minutesAfter, minutesOf } from '../core/dates.js';

export const CHOICES = {
	theme: {
		name: 'Theme',
		order: ['light', 'dark', 'auto'],
		labels: { light: 'Light', dark: 'Dark', auto: 'Auto' },
		icons: { light: 'sun', dark: 'moon', auto: 'auto' },
	},
	brightness: {
		name: 'Brightness',
		order: ['bright', 'dim', 'auto'],
		labels: { bright: 'Bright', dim: 'Dim', auto: 'Auto' },
		icons: { bright: 'bulb_bright', dim: 'bulb_dim', auto: 'bulb_auto' },
	},
	screen: {
		name: 'Screen',
		order: ['never', 'idle', 'auto'],
		labels: { never: 'Always on', idle: 'Off when idle', auto: 'Auto' },
		icons: { never: 'screen_on', idle: 'screen_sleep', auto: 'screen_auto' },
	},
};

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

/**
 * What setting `key`'s round button shows for choice `value` (its props, see
 * components/controls/cycle_button.svelte): { name, icons, choice, label }.
 */
export function choiceButton(key, value) {
	const { name, icons } = CHOICES[key];
	return { name, icons, choice: value, label: choiceLabel(key, value) };
}

/** How choice `value` of setting `key` is called, e.g. "Off when idle". */
export function choiceLabel(key, value) {
	return CHOICES[key].labels[value] ?? value;
}
