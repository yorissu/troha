
/**
 * The clock: the time now and today's day key, kept up to date every second.
 * Components read `now` and `day` (they're reactive); code that acts on time
 * subscribes with onTick() or onDayChange().
 */

import { toKey } from '../core/dates.js';

class Clock {
	/** The time now (updated every second). */
	now = $state(new Date());
	/** Today's day key. */
	day = $state(toKey(new Date()));

	#interval = null;
	#tickListeners = new Set();
	#dayListeners = new Set();

	start() {
		this.#tick();
		this.#interval ??= setInterval(() => this.#tick(), 1000);
	}

	/** Calls `listener(now)` every second. @returns {() => void} Stops it. */
	onTick(listener) {
		this.#tickListeners.add(listener);
		return () => this.#tickListeners.delete(listener);
	}

	/** Calls `listener(day)` when a new day starts. @returns {() => void} Stops it. */
	onDayChange(listener) {
		this.#dayListeners.add(listener);
		return () => this.#dayListeners.delete(listener);
	}

	#tick() {
		const now = new Date();
		const day = toKey(now);
		this.now = now;
		if (day !== this.day) {
			this.day = day;
			for (const listener of [...this.#dayListeners]) callSafely(listener, day);
		}
		for (const listener of [...this.#tickListeners]) callSafely(listener, now);
	}
}

/** One listener failing must not stop the others (or the clock). */
function callSafely(listener, value) {
	try {
		listener(value);
	} catch (error) {
		console.error(error);
	}
}

export const clock = new Clock();
