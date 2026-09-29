
/**
 * Brightness button: Bright (bulb with rays), Dim (plain bulb) or Auto (half-lit bulb).
 */

import { CycleButton } from '../cycle_button/cycle_button.js';

export class BrightnessButton extends CycleButton {
	/** @param {{onTap: () => void}} options */
	constructor({ onTap }) {
		super({ name: 'Brightness', icons: { bright: 'bulb_bright', dim: 'bulb_dim', auto: 'bulb_auto' }, onTap });
	}
}
