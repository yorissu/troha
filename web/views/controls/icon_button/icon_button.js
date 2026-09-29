
/**
 * Icon button: a square button with an icon, in the theme's own colours (or in a
 * habit colour). Styles: .icon-button in styles/controls.css.
 */

import { Button } from '../../base/button/button.js';

export class IconButton extends Button {
	/**
	 * @param {object} options
	 * @param {string} options.icon Icon name.
	 * @param {string} [options.color] 'plain' (the theme's colours, the default), or a habit colour like 'mint'.
	 * @param {string} options.ariaLabel
	 * @param {boolean} [options.small] The smaller size (month arrows).
	 * @param {string} [options.className] Extra classes.
	 * @param {(element: HTMLElement) => void} [options.onTap]
	 */
	constructor({ icon, color = 'plain', ariaLabel, small = false, className = '', onTap }) {
		super({
			className: `icon-button c-${color}${small ? ' small' : ''} ${className}`.trim(),
			icon,
			ariaLabel,
			onTap,
		});
	}
}
