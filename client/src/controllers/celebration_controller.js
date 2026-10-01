
/**
 * Celebrations, when a habit is ticked done on Today:
 *   Halfway    half of today's habits done (4 or more of them): a toast, once a day.
 *   All done   the cards hop, the date bounces, confetti, and a toast (with the streak).
 *              Early in the morning (the early bird), a sunrise version.
 *   Night owl  ticked in the small hours instead: a sleepy remark, once a night.
 *
 * HabitController tells it about each habit done (done()); the rest is up to it.
 */

import { say } from '../core/text.js';
import { messages } from '../messages.js';
import { clock } from '../services/clock.svelte.js';
import { confetti } from '../services/confetti.js';
import { toast } from '../services/toast.svelte.js';

const SUNRISE_COLORS = ['butter', 'peach', 'blush']; // the early bird's confetti

export class CelebrationController {
	#store;
	#config;
	#views;
	#playful;
	#halfwayShownOn = null; // the day the "halfway" toast was shown (once a day)

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store
	 * @param {typeof import('../config.js').config} options.config Its colours, and timing.celebrateDelayMs.
	 * @param {{today, sidebar}} options.views The cards hop (today), the date bounces (sidebar).
	 * @param {import('./playful_controller.js').PlayfulController} options.playful The night owl and the early bird.
	 */
	constructor({ store, config, views, playful }) {
		this.#store = store;
		this.#config = config;
		this.#views = views;
		this.#playful = playful;
	}

	/** A habit was just ticked done today. */
	done() {
		if (this.#cheerIfDeserved()) return;
		// In the small hours, a sleepy remark (unless a cheer is on its way: then it waits for the next tick).
		const sleepy = this.#playful.sleepyRemark(new Date());
		if (sleepy) toast.show(sleepy);
	}

	/**
	 * All done: celebrate. Half done (once a day, 4+ habits): a toast.
	 * @returns {boolean} True if either.
	 */
	#cheerIfDeserved() {
		const day = clock.day;
		const { total, done } = this.#store.entry(day);
		if (total > 0 && done.length === total) {
			// After the last card's wiggle, and only if it's still all done (no untick meanwhile).
			setTimeout(() => {
				const entry = this.#store.entry(day);
				if (day === clock.day && entry && entry.total > 0 && entry.done.length === entry.total) this.#celebrate(day);
			}, this.#config.timing.celebrateDelayMs);
			return true;
		}
		if (total >= 4 && done.length === Math.ceil(total / 2) && this.#halfwayShownOn !== day) {
			this.#halfwayShownOn = day;
			toast.show(say(messages.halfway), { duration: 'short' });
			return true;
		}
		return false;
	}

	/** Everything done: the cards hop, the date bounces, confetti. Early in the morning, a sunrise version. */
	#celebrate(day) {
		const { today, sidebar } = this.#views;
		const earlyBird = this.#playful.isEarlyBird(new Date());
		today.cheer();
		if (earlyBird) sidebar.sunrise();
		else sidebar.cheer();
		const streak = this.#store.streak(day);
		const remark = say(earlyBird ? messages.earlyBird : messages.allDone);
		toast.show(remark + (streak > 1 ? ` ${say(messages.streak, streak)}` : ''), { duration: 'long' });
		const sunColors = SUNRISE_COLORS.filter((color) => this.#config.colors.includes(color));
		confetti.burst(earlyBird && sunColors.length ? sunColors : undefined);
	}
}
