
/**
 * Theme: Light, Dark, or Auto (dark during the night time set in Settings).
 * Sets data-theme on <html>; styles/tokens.css does the rest.
 */

import { onDestroy } from 'svelte';
import { isInTimeRange, timeRangeText } from '../core/dates.js';
import { rememberLook } from '../core/look_memory.js';
import { choiceLabel, nextChoice } from '../models/settings.js';
import { clock } from '../services/clock.svelte.js';
import { toast } from '../services/toast.svelte.js';

export class ThemeController {
	#store;

	/**
	 * Made while the board is set up; stops with it.
	 * @param {object} options
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store Holds the setting and the night time.
	 */
	constructor({ store }) {
		this.#store = store;
		onDestroy(clock.onTick((now) => this.apply(now)));
	}

	/** Applies the saved setting (for Auto, depending on the time of `now`). */
	apply(now = new Date()) {
		if (!this.#store.loaded) return;
		const { theme: setting, nightTime } = this.#store.settings;
		const night = isInTimeRange(now, nightTime.from, nightTime.until);
		const theme = setting === 'auto' ? (night ? 'dark' : 'light') : setting;
		if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
		rememberLook({ theme }); // for the next load's first look (first_look.js)
	}

	/** The theme button: moves to the next setting and says which one. */
	next() {
		const settings = this.#store.settings;
		const setting = nextChoice(settings, 'theme');
		this.apply();
		this.#store.save();

		const note = setting === 'auto' ? ` (dark ${timeRangeText(settings.nightTime)})` : '';
		toast.show(`Theme: ${choiceLabel('theme', setting)}${note}`, { duration: 'short' });
	}
}
