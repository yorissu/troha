
/**
 * Screen care, with two settings buttons:
 *   Brightness  Bright, Dim, or Auto (dim during the sleep time)
 *   Screen      Always on, Off when idle, or Auto (off when idle during the sleep time);
 *               while the screen may go black, the button's border counts down to it
 * Also moves the whole page by a pixel or two every so often, so nothing burns in.
 * The sleep time is set in Settings.
 *
 * Dimming and "off" darken the page itself, with the night shade (`dim`, `blank`);
 * blank, it catches the waking tap.
 */

import { onDestroy } from 'svelte';
import { isInTimeRange, timeRangeText } from '../core/dates.js';
import { rememberLook } from '../core/look_memory.js';
import { choiceLabel, nextChoice } from '../models/settings.js';
import { clock } from '../services/clock.svelte.js';
import { idle } from '../services/idle.js';
import { toast } from '../services/toast.svelte.js';

// Where the page sits, in turn (multiplied by `px`): the middle, then around it.
const SHIFTS = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export class ScreenController {
	/** How much darker the page is: 0 to 1. */
	dim = $state(0);
	/** True while the screen is "off" (black, catching the waking tap). */
	blank = $state(false);
	/** The screen button's countdown to going black (1 to 0), or null. */
	timeLeft = $state(null);

	#store;
	#stage;
	#screen;
	#shift = null;

	/**
	 * Made while the board is set up; stops with it.
	 * @param {object} options
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store Holds the settings and the sleep time.
	 * @param {() => HTMLElement} options.stage The element that is moved.
	 * @param {typeof import('../config.js').config.screen} options.screen
	 */
	constructor({ store, stage, screen }) {
		this.#store = store;
		this.#stage = stage;
		this.#screen = screen;
		onDestroy(clock.onTick((now) => this.apply(now)));
		onDestroy(idle.onActivity(() => this.apply())); // wake at once
	}

	/** Every second, on every touch, and after a change. */
	apply(now = new Date()) {
		if (!this.#store.loaded) return;
		const { brightness, screen, sleepTime } = this.#store.settings;
		const sleeping = isInTimeRange(now, sleepTime.from, sleepTime.until);
		const dimmed = brightness === 'dim' || (brightness === 'auto' && sleeping);
		const mayBlank = screen === 'idle' || (screen === 'auto' && sleeping);
		const { offAfterMs, dimLevel } = this.#screen;
		this.blank = mayBlank && idle.idleMs > offAfterMs;
		this.dim = dimmed ? dimLevel : 0;
		rememberLook({ dim: this.dim }); // for the next load's first look (first_look.js)
		this.timeLeft = mayBlank && !this.blank ? idle.fractionLeft(offAfterMs) : null;
		this.#moveStage(now);
	}

	/** The brightness button: the next setting, and a toast saying which. */
	nextBrightness() {
		const setting = this.#next('brightness');
		const note = setting === 'auto' ? ` (dim ${timeRangeText(this.#store.settings.sleepTime)})` : '';
		toast.show(`Brightness: ${choiceLabel('brightness', setting)}${note}`, { duration: 'short' });
	}

	/** The screen button: the next setting, and a toast saying which. */
	nextScreen() {
		const setting = this.#next('screen');
		const off = `off after ${Math.round(this.#screen.offAfterMs / 60000)} min without a touch`;
		const sleep = timeRangeText(this.#store.settings.sleepTime);
		const note = setting === 'idle' ? ` (${off})` : setting === 'auto' ? ` (${off}, ${sleep})` : '';
		toast.show(`Screen: ${choiceLabel('screen', setting)}${note}`);
	}

	/** Moves setting `key` on to its next choice, applies and saves it. @returns the new choice. */
	#next(key) {
		const setting = nextChoice(this.#store.settings, key);
		this.apply();
		this.#store.save();
		return setting;
	}

	/** Picks the page's position from the time, so it changes every `shiftEveryMinutes`. */
	#moveStage(now) {
		const stage = this.#stage();
		if (!stage) return;
		const { shiftPx, shiftEveryMinutes } = this.#screen;
		const step = Math.floor(now.getTime() / (shiftEveryMinutes * 60 * 1000)) % SHIFTS.length;
		if (step === this.#shift) return;
		this.#shift = step;
		const [x, y] = SHIFTS[step];
		stage.style.translate = `${x * shiftPx}px ${y * shiftPx}px`;
	}
}
