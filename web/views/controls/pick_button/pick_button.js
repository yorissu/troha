
/**
 * Pick button: a filled pill with an icon and a value, e.g. a date, a time or a
 * file name. Tapping it opens the pop-up where the value is picked. (Styles:
 * .pick-button in styles/controls.css.)
 */

import { Button } from '../../base/button/button.js';

export class PickButton extends Button {
	/**
	 * @param {object} options
	 * @param {string} options.icon Icon name, e.g. 'calendar', 'clock' or 'file'.
	 * @param {(element: HTMLElement) => void} options.onTap
	 */
	constructor({ icon, onTap }) {
		super({ className: 'pill pick-button', icon, label: '', onTap });
	}
}
