
/**
 * Cycle button: a round button that steps through a few settings (e.g. Light,
 * Dark, Auto) and shows the current one's icon. What the settings mean is up to
 * its controller.
 */

import { icon } from '../../../core/dom.js';
import { Button } from '../../base/button/button.js';

export class CycleButton extends Button {
	#name;
	#icons = new Map();

	/**
	 * @param {object} options
	 * @param {string} options.name Spoken name, e.g. "Theme".
	 * @param {Object<string, string>} options.icons Setting -> icon name.
	 * @param {string} [options.className] Extra classes.
	 * @param {() => void} options.onTap
	 */
	constructor({ name, icons, className = '', onTap }) {
		super({ className: `cycle-button ${className}`.trim(), onTap });
		this.#name = name;
		for (const [setting, iconName] of Object.entries(icons)) {
			const element = icon(iconName, 'cycle-icon');
			this.#icons.set(setting, element);
			this.element.append(element);
		}
	}

	/**
	 * @param {string} setting One of the settings given to the constructor.
	 * @param {string} label Spoken name of the setting, e.g. "Auto".
	 */
	show(setting, label) {
		if (this.element.dataset.setting === setting) return;
		this.element.dataset.setting = setting;
		for (const [key, element] of this.#icons) element.classList.toggle('current', key === setting);
		this.element.setAttribute('aria-label', `${this.#name}: ${label}`);
	}
}
