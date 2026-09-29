
/**
 * Ticks once a second and notices when a new day starts.
 *
 * Events:
 *   'tick'      detail: { now: Date }
 *   'daychange' detail: { day: "YYYY-MM-DD" }
 */

import { toKey } from './dates.js';

export class Clock extends EventTarget {
	/** The current day key. */
	day = toKey(new Date());

	#interval = null;

	start() {
		this.#tick();
		this.#interval ??= setInterval(() => this.#tick(), 1000);
	}

	#tick() {
		const now = new Date();
		const day = toKey(now);
		if (day !== this.day) {
			this.day = day;
			this.dispatchEvent(new CustomEvent('daychange', { detail: { day } }));
		}
		this.dispatchEvent(new CustomEvent('tick', { detail: { now } }));
	}
}
