
/**
 * Measures how long nobody has touched the screen (or pressed a key).
 *
 * It uses the browser's steady timer (performance.now), not the clock: the device's
 * clock changing (e.g. set from the network) must not make the screen look idle for
 * hours, nor busy for hours if the clock goes back.
 */

class IdleTimer {
	#lastActivity = performance.now();
	#awake = false;
	#listeners = new Set();

	constructor() {
		for (const type of ['pointerdown', 'keydown']) {
			document.addEventListener(type, () => this.touch(), { passive: true });
		}
	}

	/** Counts as activity, e.g. right after unlocking hidden habits. */
	touch() {
		this.#lastActivity = performance.now();
		for (const listener of [...this.#listeners]) listener();
	}

	/** Calls `listener()` on every touch or key press. @returns {() => void} Stops it. */
	onActivity(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/**
	 * While kept awake (e.g. during the tour), it never counts as idle: nothing goes back
	 * to Today, asks to lock hidden habits, or turns the screen off. Letting go starts afresh.
	 */
	keepAwake(awake) {
		this.#awake = awake;
		this.touch();
	}

	/** True while kept awake (see keepAwake). */
	get keptAwake() {
		return this.#awake;
	}

	/** Milliseconds since the last activity (0 while kept awake). */
	get idleMs() {
		return this.#awake ? 0 : performance.now() - this.#lastActivity;
	}

	/** How much of `limitMs` is left, from 1 (just touched) to 0. */
	fractionLeft(limitMs) {
		return Math.max(0, 1 - this.idleMs / limitMs);
	}
}

export const idle = new IdleTimer();
