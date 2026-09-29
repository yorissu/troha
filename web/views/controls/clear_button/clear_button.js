
/**
 * Clear button (Calendar): an eraser that turns clear mode on and off. While it's on,
 * its border shows how long until clear mode turns itself off (see TimeoutButton).
 */

import { TimeoutButton } from '../timeout_button/timeout_button.js';

export class ClearButton extends TimeoutButton {
	/** @param {{onTap: (element: HTMLElement) => void}} options */
	constructor({ onTap }) {
		super({ className: 'icon-button small c-plain clear-button', icon: 'eraser', ariaLabel: 'Clear days', onTap });
		this.setActive(false);
	}
}
