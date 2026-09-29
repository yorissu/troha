
/**
 * Toast: a short message at the bottom that pops in, then hops away.
 * It can carry one action, e.g. "Undo". Its outline counts down to when it goes
 * (see TimeoutRing), so it's clear how long it (and its action) will stay.
 */

import { h, replayAnimation } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';
import { Button } from '../../base/button/button.js';
import { TimeoutRing } from '../../controls/timeout_ring/timeout_ring.js';

const LEAVE_MS = 700; // length of the .toast.leaving animation

export class Toast extends Component {
	#durations;
	#timer;
	#message = h('span', { className: 'toast-message' });
	#action = new Button({ className: 'toast-action', label: '', onTap: () => this.#tapAction() });
	#onAction = null;
	#ring;

	/** @param {{durations: {short: number, normal: number, long: number}}} options How long each kind of toast stays, in ms. */
	constructor({ durations }) {
		super(h('div', { className: 'toast', hidden: true, attrs: { role: 'status' } }));
		this.#durations = durations;
		this.element.append(this.#message, this.#action.element);
		this.#action.hidden = true;
		this.#ring = new TimeoutRing(this.element);
	}

	/** True while an action (e.g. "Undo") is on offer. */
	get hasAction() {
		return this.#onAction !== null;
	}

	/** True while `onTap` (an action given to show()) is the one on offer. */
	offers(onTap) {
		return this.#onAction !== null && this.#onAction === onTap;
	}

	/**
	 * @param {string} message
	 * @param {object} [options]
	 * @param {'short'|'normal'|'long'|number} [options.duration] How long it stays: one of the
	 *   durations given to the constructor (by how long the message is), or a time in ms.
	 * @param {boolean} [options.sticky] Stay until hide() is called.
	 * @param {{label: string, onTap: () => void}} [options.action] A button in the toast; tapping it closes the toast.
	 */
	show(message, { duration = 'normal', sticky = false, action = null } = {}) {
		clearTimeout(this.#timer);
		this.#message.textContent = message;
		this.#onAction = action?.onTap ?? null;
		this.#action.hidden = !action;
		if (action) this.#action.setLabel(action.label);
		this.element.hidden = false;
		replayAnimation(this.element, 'showing', ['showing', 'leaving']); // restart the pop-in
		if (sticky) {
			this.#ring.setTimeLeft(null); // stays until hidden: nothing to count down
			return;
		}
		const ms = this.#durations[duration] ?? duration;
		this.#ring.run(ms);
		this.#timer = setTimeout(() => this.hide(), ms);
	}

	hide() {
		clearTimeout(this.#timer);
		this.#onAction = null; // an action is only offered while it's on screen
		if (this.element.hidden) return;
		this.element.classList.remove('showing');
		this.element.classList.add('leaving');
		this.#timer = setTimeout(() => { this.element.hidden = true; }, LEAVE_MS);
	}

	#tapAction() {
		const onAction = this.#onAction;
		this.hide();
		onAction?.();
	}
}
