
/**
 * Night shade: a dark layer over the whole stage. Dimmed, it lets taps through;
 * blank (fully black), it catches the first tap so waking the screen can't tick
 * a habit by accident.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

const WAKE_MS = 600; // length of the fade back in; taps stay caught until it's done

export class NightShade extends Component {
	#blank = false;
	#timer;

	/** @param {{onWake: () => void}} options Called when a tap wakes a blank screen. */
	constructor({ onWake }) {
		super(h('div', { className: 'night-shade', attrs: { 'aria-hidden': 'true' } }));
		this.element.addEventListener('pointerdown', (event) => {
			if (!this.#blank) return;
			event.preventDefault();
			onWake();
		});
	}

	/**
	 * @param {object} state
	 * @param {number} state.dim How much darker, from 0 (not at all) to 1 (black).
	 * @param {boolean} state.blank Fully black, catching taps.
	 */
	show({ dim, blank }) {
		if (this.#blank && !blank) {
			// Keep catching taps while it fades, so the rest of the waking tap lands here too.
			this.element.classList.add('waking');
			clearTimeout(this.#timer);
			this.#timer = setTimeout(() => this.element.classList.remove('waking'), WAKE_MS);
		}
		this.#blank = blank;
		this.element.style.opacity = String(blank ? 1 : dim);
		this.element.classList.toggle('blank', blank);
	}
}
