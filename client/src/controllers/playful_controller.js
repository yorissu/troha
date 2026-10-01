
/**
 * Easter eggs that go by the clock (config.playful):
 *   Make a wish  at 11:11 and 22:22 the sidebar clock shimmers and a toast says so,
 *                once a day at each.
 *   Night owl    a habit ticked in the small hours gets a sleepy remark, once a night.
 *   Early bird   everything done early in the morning: HabitController celebrates
 *                with a sunrise instead (see isEarlyBird).
 * The ones you tap live in their components: the tickled date in the sidebar and the
 * 0000 PIN in the PIN pad.
 */

import { onDestroy } from 'svelte';
import { clockText, isInTimeRange, toKey } from '../core/dates.js';
import { say } from '../core/text.js';
import { messages } from '../messages.js';
import { clock } from '../services/clock.svelte.js';
import { toast } from '../services/toast.svelte.js';

export class PlayfulController {
	#playful;
	#views;
	#wishedAt = null; // the last wish, as "YYYY-MM-DD HH:MM"
	#sleepyOn = null; // the day (key) of the last sleepy remark

	/**
	 * Made while the board is set up; stops with it.
	 * @param {object} options
	 * @param {{wishTimes: string[], nightOwl: {from: string, until: string}, earlyBird: {from: string, until: string}}} options.playful
	 * @param {{sidebar}} options.views
	 */
	constructor({ playful, views }) {
		this.#playful = playful;
		this.#views = views;
		onDestroy(clock.onTick((now) => this.#makeAWish(now)));
	}

	/** A habit was just ticked: a sleepy remark if it's the small hours (once a night), else null. */
	sleepyRemark(now) {
		const { from, until } = this.#playful.nightOwl;
		const day = toKey(now);
		if (!isInTimeRange(now, from, until) || this.#sleepyOn === day) return null;
		this.#sleepyOn = day;
		return say(messages.nightOwl);
	}

	/** True early in the morning, when finishing everything earns the sunrise celebration. */
	isEarlyBird(now) {
		const { from, until } = this.#playful.earlyBird;
		return isInTimeRange(now, from, until);
	}

	/** Every second: time to make a wish? (Not over an "Undo", which matters more.) */
	#makeAWish(now) {
		const time = clockText(now);
		const moment = `${toKey(now)} ${time}`;
		if (!this.#playful.wishTimes.includes(time) || moment === this.#wishedAt || toast.hasAction()) return;
		this.#wishedAt = moment;
		this.#views.sidebar.shimmerClock();
		toast.show(say(messages.wish, time), { duration: 'long' });
	}
}
