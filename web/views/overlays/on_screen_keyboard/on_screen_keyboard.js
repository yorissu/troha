
/**
 * On-screen keyboard (US English QWERTY, plus a 123 layer).
 *
 * attach(input) makes it slide up whenever that text field is focused, and type
 * into it. Give the field inputmode="none" so the system keyboard stays hidden;
 * a physical keyboard still works.
 *
 * Shift: one tap capitalises the next letter; a quick double tap is caps lock.
 * Holding backspace keeps deleting.
 */

import { h, icon } from '../../../core/dom.js';
import { listenForKeyPresses } from '../../../core/taps.js';
import { Component } from '../../base/component/component.js';

// Special keys are written in {braces}. The bottom row is: switch layer, space, done.
const LAYOUTS = {
	letters: [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{back}'],
		['{numbers}', '{space}', '{done}'],
	],
	numbers: [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
		['-', '/', ':', ';', '(', ')', '&', '@', '"'],
		['.', ',', '?', '!', "'", '+', '{back}'],
		['{letters}', '{space}', '{done}'],
	],
};

const LABELS = { '{numbers}': '123', '{letters}': 'abc', '{space}': 'space', '{done}': 'Done' };

const REPEAT_DELAY_MS = 450; // hold backspace this long...
const REPEAT_EVERY_MS = 70;  // ...then it repeats this often
const DOUBLE_TAP_MS = 350;   // two shift taps within this time turn on caps lock
const BLUR_GRACE_MS = 120;   // taps on the keyboard don't count as leaving the field

export class OnScreenKeyboard extends Component {
	#target = null;
	#layout = 'letters';
	#shift = false;
	#capsLock = false;
	#lastShiftTap = 0;
	#holdTimer;
	#repeatTimer;

	constructor() {
		super(h('div', { className: 'keyboard' }));

		// Keep focus (and the caret) in the text field while keys are pressed.
		this.element.addEventListener('pointerdown', (event) => event.preventDefault());
		// Keys count when pressed, once per touch (see core/taps.js).
		listenForKeyPresses(this.element, '.key', ({ dataset }) => {
			if (dataset.key === '{back}') this.#holdBackspace();
			else this.#press(dataset.key);
		});
		this.#setUpBackspaceRepeat();
	}

	/** Opens the keyboard for `input` whenever it's focused or tapped. */
	attach(input) {
		input.addEventListener('focus', () => this.#show(input));
		input.addEventListener('click', () => { if (this.#target !== input) this.#show(input); });
		input.addEventListener('blur', () => {
			setTimeout(() => { if (document.activeElement !== input) this.hide(); }, BLUR_GRACE_MS);
		});
	}

	hide() {
		if (!this.element.classList.contains('open')) return;
		this.element.classList.remove('open');
		document.body.classList.remove('keyboard-open');
		this.#target = null;
	}

	#show(input) {
		this.#target = input;
		this.#layout = 'letters';
		this.#capsLock = false;
		this.#autoShift();
		this.#render();
		this.element.classList.add('open');
		document.body.classList.add('keyboard-open');
		input.scrollIntoView({ block: 'nearest' });
	}

	#render() {
		this.element.replaceChildren(...LAYOUTS[this.#layout].map((row) => h('div', { className: 'key-row' },
			...row.map((key) => this.#keyButton(key)))));
	}

	#keyButton(key) {
		const button = h('button', { type: 'button', tabIndex: -1, dataset: { key } });
		if (!key.startsWith('{')) {
			button.className = 'key';
			button.textContent = this.#shift ? key.toLocaleUpperCase() : key;
			return button;
		}
		const name = key.slice(1, -1);
		button.className = `key special key-${name}`;
		button.setAttribute('aria-label', name);
		if (key === '{shift}') {
			button.append(icon(this.#capsLock ? 'caps_lock' : 'shift'));
			button.classList.toggle('selected', this.#shift);
		} else if (key === '{back}') {
			button.append(icon('backspace'));
		} else {
			button.textContent = LABELS[key];
		}
		return button;
	}

	#press(key) {
		if (!this.#target) return;
		switch (key) {
			case '{shift}': this.#tapShift(); break;
			case '{numbers}': this.#layout = 'numbers'; this.#render(); break;
			case '{letters}': this.#layout = 'letters'; this.#autoShift(); this.#render(); break;
			case '{space}': this.#type(' '); break;
			case '{done}': this.#target.blur(); this.hide(); break;
			default: this.#type(this.#shift ? key.toLocaleUpperCase() : key);
		}
		if (this.#target && document.activeElement !== this.#target) this.#target.focus({ preventScroll: true });
	}

	#type(text) {
		const target = this.#target;
		if (target.maxLength > 0 && target.value.length >= target.maxLength) return;
		target.setRangeText(text, target.selectionStart, target.selectionEnd, 'end');
		this.#changed();
	}

	#backspace() {
		const target = this.#target;
		if (!target) return;
		const { selectionStart: start, selectionEnd: end } = target;
		if (start !== end) target.setRangeText('', start, end, 'end');
		else if (start > 0) target.setRangeText('', start - 1, start, 'end');
		else return;
		this.#changed();
	}

	/** Tells the page the text changed (like real typing does), then updates shift. */
	#changed() {
		this.#target.dispatchEvent(new Event('input', { bubbles: true }));
		const wasShift = this.#shift;
		this.#autoShift();
		if (this.#shift !== wasShift) this.#render();
	}

	/** One tap: uppercase for the next letter. Double tap: caps lock. Tap again: off. */
	#tapShift() {
		const now = performance.now();
		if (this.#capsLock) {
			this.#capsLock = false;
			this.#shift = false;
			this.#lastShiftTap = 0;
		} else if (now - this.#lastShiftTap < DOUBLE_TAP_MS) {
			this.#capsLock = true;
			this.#shift = true;
			this.#lastShiftTap = 0; // so a third quick tap doesn't count as another double tap
		} else {
			this.#shift = !this.#shift;
			this.#lastShiftTap = now;
		}
		this.#render();
	}

	/** Capital letter at the start of the field, lowercase after that (unless caps lock is on). */
	#autoShift() {
		this.#shift = this.#capsLock || (this.#target.selectionStart === 0 && this.#layout !== 'numbers');
	}

	/** Backspace pressed: delete one now, and keep deleting while it's held. */
	#holdBackspace() {
		this.#stopBackspace();
		this.#backspace();
		this.#holdTimer = setTimeout(() => {
			this.#repeatTimer = setInterval(() => this.#backspace(), REPEAT_EVERY_MS);
		}, REPEAT_DELAY_MS);
	}

	#stopBackspace() {
		clearTimeout(this.#holdTimer);
		clearInterval(this.#repeatTimer);
	}

	/** Letting go (or sliding off the keyboard) stops the repeating backspace. */
	#setUpBackspaceRepeat() {
		for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
			this.element.addEventListener(type, () => this.#stopBackspace());
		}
	}
}
