
/**
 * Toast: a short message at the bottom that pops in, then hops away.
 * It can carry one action, e.g. "Undo".
 */

import { h, replayAnimation } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';
import { Button } from '../../base/button/button.js';

const LEAVE_MS = 700; // length of the .toast.leaving animation

export class Toast extends Component {
	#timer;
	#message = h('span', { className: 'toast-message' });
	#action = new Button({ className: 'toast-action', label: '', onTap: () => this.#tapAction() });
	#onAction = null;

	constructor() {
		super(h('div', { className: 'toast', hidden: true, attrs: { role: 'status' } }));
		this.element.append(this.#message, this.#action.element);
		this.#action.hidden = true;
	}

	/** True while an action (e.g. "Undo") is on offer. */
	get hasAction() {
		return this.#onAction !== null;
	}

	/**
	 * @param {string} message
	 * @param {object} [options]
	 * @param {number} [options.duration] How long it stays, in ms.
	 * @param {boolean} [options.sticky] Stay until hide() is called.
	 * @param {{label: string, onTap: () => void}} [options.action] A button in the toast; tapping it closes the toast.
	 */
	show(message, { duration = 5000, sticky = false, action = null } = {}) {
		clearTimeout(this.#timer);
		this.#message.textContent = message;
		this.#onAction = action?.onTap ?? null;
		this.#action.hidden = !action;
		if (action) this.#action.setLabel(action.label);
		this.element.hidden = false;
		replayAnimation(this.element, 'showing', ['showing', 'leaving']); // restart the pop-in
		if (!sticky) this.#timer = setTimeout(() => this.hide(), duration);
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
