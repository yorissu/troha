
/**
 * Text field, typed into with the on-screen keyboard (the system keyboard stays
 * hidden; a physical keyboard works too). Something missing or wrong is marked in
 * the field itself: it turns red and shakes, and its placeholder can say what's
 * needed, so nothing else on the page moves. (Styles: .text-input in styles/controls.css.)
 */

import { clearInvalid, h, markInvalid } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class TextField extends Component {
	#placeholder;

	/**
	 * @param {object} options
	 * @param {import('../../overlays/on_screen_keyboard/on_screen_keyboard.js').OnScreenKeyboard} options.keyboard
	 * @param {string} options.placeholder
	 * @param {number} options.maxLength
	 * @param {string} [options.id] For a <label> to point at.
	 * @param {string} [options.ariaLabel] Spoken name, when there's no <label>.
	 * @param {() => void} [options.onInput] The text changed.
	 * @param {() => void} [options.onFocus]
	 */
	constructor({ keyboard, placeholder, maxLength, id, ariaLabel, onInput, onFocus }) {
		super(h('input', {
			className: 'text-input',
			maxLength,
			placeholder,
			attrs: { id, inputmode: 'none', 'aria-label': ariaLabel }, // inputmode: not the system keyboard
			on: { input: () => onInput?.(), focus: () => onFocus?.() },
		}));
		this.#placeholder = placeholder;
		keyboard.attach(this.element);
	}

	get value() {
		return this.element.value;
	}

	set value(text) {
		this.element.value = text;
	}

	/** Marks the field red, with a shake; `hint` (if any) replaces the placeholder until clearMarks(). */
	markInvalid(hint) {
		if (hint) this.element.placeholder = hint;
		markInvalid(this.element);
	}

	/** Undoes markInvalid(). */
	clearMarks() {
		clearInvalid(this.element);
		this.element.placeholder = this.#placeholder;
	}
}
