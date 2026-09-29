
/**
 * Screen care, with two settings buttons:
 *   Brightness  Bright, Dim, or Auto (dim during the sleep time)
 *   Screen      Always on, Off when idle, or Auto (off when idle during the sleep time);
 *               while the screen may go black, the button's border counts down to it
 * Also moves the whole page by a pixel or two every so often, so nothing burns in.
 * The sleep time is set in Settings.
 *
 * Where the server can control the screen's backlight (a Pi touch display), dimming
 * turns the backlight down and "off" switches it off. Elsewhere, or if that fails,
 * the page darkens itself with the night shade. Either way the shade goes black
 * when the screen is off, so it catches the waking tap.
 */

import { isInTimeRange } from '../core/dates.js';
import { backlightSupported, setBacklight } from '../models/api.js';
import { choiceLabel, nextChoice } from '../models/settings.js';

const LOWEST_BACKLIGHT = 0.05; // the server's lowest brightness

// Where the page sits, in turn (multiplied by `px`): the middle, then around it.
const SHIFTS = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export class ScreenController {
	#store;
	#stage;
	#shade;
	#buttons;
	#toast;
	#idle;
	#config;
	#shift = null;
	#backlight = false; // true while the backlight is used for dimming and "off"
	#sentBacklight = null; // the last state sent, so it's only sent when it changes

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.js').HabitStore} options.store Holds the settings and the sleep time.
	 * @param {HTMLElement} options.stage The element that is moved.
	 * @param {import('../views/overlays/night_shade/night_shade.js').NightShade} options.shade
	 * @param {{brightness: import('../views/controls/cycle_button/cycle_button.js').CycleButton,
	 *          screen: import('../views/controls/screen_button/screen_button.js').ScreenButton}} options.buttons
	 * @param {import('../views/overlays/toast/toast.js').Toast} options.toast
	 * @param {import('../core/idle_timer.js').IdleTimer} options.idle
	 * @param {typeof import('../config.js').config} options.config Uses `screen` and `toastMs`.
	 */
	constructor({ store, stage, shade, buttons, toast, idle, config }) {
		this.#store = store;
		this.#stage = stage;
		this.#shade = shade;
		this.#buttons = buttons;
		this.#toast = toast;
		this.#idle = idle;
		this.#config = config;
		this.#idle.addEventListener('activity', () => this.apply()); // wake at once
	}

	/** Asks the server whether the backlight can be used, and uses it if so. */
	async useBacklight() {
		this.#backlight = await backlightSupported();
		this.apply();
	}

	/** Called every second (and on every touch, and when the sleep time changes). */
	apply(now = new Date()) {
		const { brightness, screen, sleepTime } = this.#store.settings;
		const sleeping = isInTimeRange(now, sleepTime.from, sleepTime.until);
		const dimmed = brightness === 'dim' || (brightness === 'auto' && sleeping);
		const mayBlank = screen === 'idle' || (screen === 'auto' && sleeping);
		const { offAfterMs, dimLevel } = this.#config.screen;
		const blank = mayBlank && this.#idle.idleMs > offAfterMs;
		if (this.#backlight) {
			this.#sendBacklight({ brightness: Math.max(LOWEST_BACKLIGHT, dimmed ? 1 - dimLevel : 1), on: !blank });
		}
		this.#shade.show({ dim: dimmed && !this.#backlight ? dimLevel : 0, blank });
		this.#buttons.brightness.show(brightness, choiceLabel('brightness', brightness));
		this.#buttons.screen.show(screen, choiceLabel('screen', screen));
		// The screen button's border counts down to going black (only while it may).
		this.#buttons.screen.setTimeLeft(mayBlank && !blank ? this.#idle.fractionLeft(offAfterMs) : null);
		this.#moveStage(now);
	}

	/** The brightness button: the next setting, and a toast saying which. */
	nextBrightness() {
		const setting = this.#next('brightness');
		const note = setting === 'auto' ? ` (dim ${this.#sleepTimeText()})` : '';
		this.#toast.show(`Brightness: ${choiceLabel('brightness', setting)}${note}`, { duration: this.#config.toastMs.short });
	}

	/** The screen button: the next setting, and a toast saying which. */
	nextScreen() {
		const setting = this.#next('screen');
		const idle = `off after ${Math.round(this.#config.screen.offAfterMs / 60000)} min without a touch`;
		const note = setting === 'idle' ? ` (${idle})` : setting === 'auto' ? ` (${idle}, ${this.#sleepTimeText()})` : '';
		this.#toast.show(`Screen: ${choiceLabel('screen', setting)}${note}`, { duration: this.#config.toastMs.normal });
	}

	/** Sends the backlight's state if it changed; if that fails, the page darkens itself from then on. */
	async #sendBacklight(state) {
		const key = `${state.brightness}/${state.on}`;
		if (key === this.#sentBacklight) return;
		this.#sentBacklight = key;
		const result = await setBacklight(state);
		if (result.ok || !this.#backlight) return;
		console.warn(`Can't control the backlight (${result.reason}); darkening the page instead.`);
		this.#backlight = false;
		this.#sentBacklight = null;
		this.apply();
	}

	/** Moves setting `key` on to its next choice, applies and saves it. @returns the new choice. */
	#next(key) {
		const setting = nextChoice(this.#store.settings, key);
		this.apply();
		this.#store.save();
		return setting;
	}

	/** "22:00–07:00" */
	#sleepTimeText() {
		const { from, until } = this.#store.settings.sleepTime;
		return `${from}–${until}`;
	}

	/** Picks the page's position from the time, so it changes every `shiftEveryMinutes`. */
	#moveStage(now) {
		const { shiftPx, shiftEveryMinutes } = this.#config.screen;
		const step = Math.floor(now.getTime() / (shiftEveryMinutes * 60 * 1000)) % SHIFTS.length;
		if (step === this.#shift) return;
		this.#shift = step;
		const [x, y] = SHIFTS[step];
		this.#stage.style.translate = `${x * shiftPx}px ${y * shiftPx}px`;
	}
}
