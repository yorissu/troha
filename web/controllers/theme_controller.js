
/**
 * Theme: Light, Dark, or Auto (dark during the night time set in Settings).
 * Sets data-theme on <html>; styles/tokens.css does the rest.
 */

import { isInTimeRange, timeRangeText } from '../core/dates.js';
import { rememberLook } from '../core/look_memory.js';
import { choiceLabel, nextChoice } from '../models/settings.js';

export class ThemeController {
	#store;
	#button;
	#toast;

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.js').HabitStore} options.store Holds the setting and the night time.
	 * @param {import('../views/controls/theme_button/theme_button.js').ThemeButton} options.button
	 * @param {import('../views/overlays/toast/toast.js').Toast} options.toast
	 */
	constructor({ store, button, toast }) {
		this.#store = store;
		this.#button = button;
		this.#toast = toast;
	}

	/** Applies the saved setting (for Auto, depending on the time of `now`). */
	apply(now = new Date()) {
		const { theme: setting, nightTime } = this.#store.settings;
		const night = isInTimeRange(now, nightTime.from, nightTime.until);
		const theme = setting === 'auto' ? (night ? 'dark' : 'light') : setting;
		if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme;
		rememberLook({ theme }); // for the next load's first look (first_look.js)
		this.#button.show(setting, choiceLabel('theme', setting));
	}

	/** The theme button: moves to the next setting and says which one. */
	next() {
		const settings = this.#store.settings;
		const setting = nextChoice(settings, 'theme');
		this.apply();
		this.#store.save();

		const note = setting === 'auto' ? ` (dark ${timeRangeText(settings.nightTime)})` : '';
		this.#toast.show(`Theme: ${choiceLabel('theme', setting)}${note}`, { duration: 'short' });
	}
}
