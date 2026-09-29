
/**
 * Measures how long nobody has touched the screen (or pressed a key).
 *
 * It uses the browser's steady timer (performance.now), not the clock: setting the
 * clock (by hand, or from the network) must not make the screen look idle for
 * hours, nor busy for hours if the clock goes back.
 *
 * Events:
 *   'activity'  on every touch or key press
 */

export class IdleTimer extends EventTarget {
	#lastActivity = performance.now();
	#awake = false;

	constructor() {
		super();
		for (const type of ['pointerdown', 'keydown']) {
			document.addEventListener(type, () => this.touch(), { passive: true });
		}
	}

	/** Counts as activity, e.g. right after logging in. */
	touch() {
		this.#lastActivity = performance.now();
		this.dispatchEvent(new Event('activity'));
	}

	/**
	 * While kept awake (e.g. during the tour), it never counts as idle: nothing goes back
	 * to Today, asks "Log out?" or turns the screen off. Letting go starts afresh.
	 */
	keepAwake(awake) {
		this.#awake = awake;
		this.touch();
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
