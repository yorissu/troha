
/**
 * Screen button: Always on (lit screen), Off when idle (sleeping screen) or Auto
 * (half-lit screen). While the screen may go black, its border counts down to
 * when it will (see TimeoutRing).
 */

import { CycleButton } from '../cycle_button/cycle_button.js';
import { TimeoutRing } from '../timeout_ring/timeout_ring.js';

export class ScreenButton extends CycleButton {
	#ring;

	/** @param {{onTap: () => void}} options */
	constructor({ onTap }) {
		super({ name: 'Screen', className: 'screen-button', icons: { never: 'screen_on', idle: 'screen_sleep', auto: 'screen_auto' }, onTap });
		this.#ring = new TimeoutRing(this.element);
	}

	/**
	 * Time left until the screen goes black: 1 = full, 0 = now. `null` hides it.
	 * @param {number|null} fraction
	 */
	setTimeLeft(fraction) {
		this.#ring.setTimeLeft(fraction);
	}
}
