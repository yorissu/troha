
/**
 * Theme button: Light (sun), Dark (moon) or Auto (half circle).
 */

import { CycleButton } from '../cycle_button/cycle_button.js';

export class ThemeButton extends CycleButton {
	/** @param {{onTap: () => void}} options */
	constructor({ onTap }) {
		super({ name: 'Theme', icons: { light: 'sun', dark: 'moon', auto: 'auto' }, onTap });
	}
}
