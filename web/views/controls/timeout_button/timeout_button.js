
/**
 * Timeout button: a button whose own border doubles as a countdown (see TimeoutRing).
 * The base of the Lock and Clear buttons.
 */

import { Button } from '../../base/button/button.js';
import { TimeoutRing } from '../timeout_ring/timeout_ring.js';

export class TimeoutButton extends Button {
	#ring;

	/** @param {object} options Same as Button. */
	constructor(options) {
		super(options);
		this.#ring = new TimeoutRing(this.element);
	}

	/**
	 * The countdown: 1 = full, 0 = empty. `null` hides it.
	 * @param {number|null} fraction
	 */
	setTimeLeft(fraction) {
		this.#ring.setTimeLeft(fraction);
	}
}
