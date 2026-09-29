
/**
 * Button: a tappable button with a text label and/or an icon. It squishes when
 * pressed (see styles/controls.css). The base of every button component.
 */

import { h, icon } from '../../../core/dom.js';
import { Component } from '../component/component.js';

export class Button extends Component {
	#label = null;

	/**
	 * @param {object} options
	 * @param {string} [options.className] e.g. 'button primary'.
	 * @param {string} [options.label] Text shown on the button.
	 * @param {string} [options.icon] Icon name from assets/icons/icons.svg.
	 * @param {string} [options.ariaLabel] Spoken name (for icon-only buttons).
	 * @param {'button'|'submit'} [options.type]
	 * @param {(element: HTMLElement) => void} [options.onTap] Gets the button element (pop-ups grow out of it).
	 */
	constructor({ className = '', label, icon: iconName, ariaLabel, type = 'button', onTap } = {}) {
		super(h('button', {
			className: `${className} squish`.trim(),
			type,
			attrs: { 'aria-label': ariaLabel },
			on: { click: () => onTap?.(this.element) },
		}));
		if (iconName) this.element.append(icon(iconName));
		if (label !== undefined) this.setLabel(label);
	}

	/** Changes the text label. */
	setLabel(text) {
		if (!this.#label) {
			this.#label = h('span', { className: 'button-label' });
			this.element.append(this.#label);
		}
		this.#label.textContent = text;
	}

	/** Highlighted (e.g. the current view, or a mode that's on). */
	setActive(active) {
		this.element.classList.toggle('active', active);
		this.element.setAttribute('aria-pressed', String(active));
	}

	set disabled(disabled) {
		this.element.disabled = disabled;
	}
}
