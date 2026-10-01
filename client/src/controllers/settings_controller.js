
/**
 * Settings: the night and sleep times (picked in the clock pop-up). Changes apply
 * right away and are saved with the account.
 */

import { fitSleepIntoNight } from '../models/settings.js';

export class SettingsController {
	#store;
	#views;
	#onTimeRangeChange;

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store
	 * @param {{timePicker}} options.views
	 * @param {() => void} options.onTimeRangeChange Re-applies whatever follows the night or sleep time.
	 */
	constructor({ store, views, onTimeRangeChange }) {
		this.#store = store;
		this.#views = views;
		this.#onTimeRangeChange = onTimeRangeChange;
	}

	/**
	 * A night or sleep time button: pick that time in the clock pop-up. Sleep times
	 * can only be picked inside the night (and never past each other); a new night
	 * pulls the sleep time inside it.
	 */
	pickRangeTime(range, which, origin) {
		const settings = this.#store.settings;
		const current = settings[range];
		const { nightTime: night, sleepTime: sleep } = settings;
		const limit = range === 'nightTime' ? null
			: which === 'from' ? { from: night.from, until: sleep.until } : { from: sleep.from, until: night.until };
		const { timePicker } = this.#views;
		timePicker.pick({
			value: current[which],
			title: `${range === 'nightTime' ? 'Night' : 'Sleep'} ${which}`,
			limit,
			origin,
			onPick: (time) => {
				timePicker.close();
				settings[range] = { ...current, [which]: time };
				settings.sleepTime = fitSleepIntoNight(settings.nightTime, settings.sleepTime);
				this.#onTimeRangeChange();
				this.#store.save();
			},
		});
	}
}
