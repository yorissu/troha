
/**
 * Lock button: Set PIN / Log in / Log out. While logged in, its border shows how
 * long until "Log out?" is asked (see TimeoutButton).
 */

import { icon } from '../../../core/dom.js';
import { TimeoutButton } from '../timeout_button/timeout_button.js';

const LABELS = { set: 'Set PIN', locked: 'Log in', open: 'Log out' };

export class LockButton extends TimeoutButton {
	/** @param {{onTap: (element: HTMLElement) => void}} options */
	constructor({ onTap }) {
		super({ className: 'icon-button lock-button c-plain', onTap });
		this.element.prepend(
			icon('lock_set', 'lock-icon for-set'),
			icon('lock', 'lock-icon for-locked'),
			icon('lock_open', 'lock-icon for-open'));
	}

	/** @param {'set'|'locked'|'open'} state */
	setState(state) {
		this.element.dataset.state = state;
		this.element.setAttribute('aria-label', LABELS[state]);
	}
}
