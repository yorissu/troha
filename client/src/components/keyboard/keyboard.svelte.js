
/**
 * The on-screen keyboard's state and typing (US English QWERTY, plus a 123 layer and
 * a symbols layer): Troha runs on touchscreens with no keyboard of their own, so it's
 * always on, and the device's own keyboard never shows (a physical one still types).
 * keyboard.svelte draws it; text fields (text_field.svelte) attach to it.
 *
 * attach(input) makes it slide up whenever that text field is focused, and type
 * into it. Shift: one tap capitalises the next letter; a quick double tap is caps
 * lock. Holding backspace keeps deleting. Fields for emails, passwords and codes
 * (data-keyboard="plain") don't start with a capital.
 */

// Special keys are written in {braces}.
export const LAYOUTS = {
	letters: [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '{back}'],
		['{numbers}', '{space}', '{done}'],
	],
	numbers: [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
		['-', '/', ':', ';', '(', ')', '&', '@', '"'],
		['{symbols}', '.', ',', '?', '!', "'", '+', '{back}'],
		['{letters}', '{space}', '{done}'],
	],
	symbols: [
		['[', ']', '{', '}', '#', '%', '^', '*', '+', '='],
		['_', '\\', '|', '~', '<', '>', '$', '€', '£'],
		['{numbers}', '.', ',', '?', '!', "'", '`', '{back}'],
		['{letters}', '{space}', '{done}'],
	],
};

const REPEAT_DELAY_MS = 450; // hold backspace this long...
const REPEAT_EVERY_MS = 70;  // ...then it repeats this often
const DOUBLE_TAP_MS = 350;   // two shift taps within this time turn on caps lock
const BLUR_GRACE_MS = 120;   // taps on the keyboard don't count as leaving the field

class Keyboard {
	open = $state(false);
	/** The text field being typed into (null while closed). */
	field = $state.raw(null);
	layout = $state('letters');
	shift = $state(false);
	capsLock = $state(false);

	#target = null;
	#lastShiftTap = 0;
	#holdTimer;
	#repeatTimer;

	/**
	 * Opens the keyboard for `input` whenever it's focused or tapped.
	 * @returns {() => void} Detaches it.
	 */
	attach(input) {
		const show = () => { if (this.#target !== input) this.#show(input); };
		const leave = () => {
			setTimeout(() => { if (document.activeElement !== input && this.#target === input) this.hide(); }, BLUR_GRACE_MS);
		};
		input.addEventListener('focus', show);
		input.addEventListener('click', show);
		input.addEventListener('blur', leave);
		return () => {
			input.removeEventListener('focus', show);
			input.removeEventListener('click', show);
			input.removeEventListener('blur', leave);
			if (this.#target === input) this.hide();
		};
	}

	hide() {
		if (!this.open) return;
		this.open = false;
		this.#target = null;
		this.field = null;
	}

	/** A key pressed (its name, e.g. 'q' or '{shift}'). */
	press(key) {
		if (!this.#target) return;
		if (key === '{back}') {
			this.#holdBackspace();
			return;
		}
		switch (key) {
			case '{shift}': this.#tapShift(); break;
			case '{numbers}': this.layout = 'numbers'; break;
			case '{symbols}': this.layout = 'symbols'; break;
			case '{letters}': this.layout = 'letters'; this.#autoShift(); break;
			case '{space}': this.#type(' '); break;
			case '{done}': this.#target.blur(); this.hide(); break;
			default: this.#type(this.shift ? key.toLocaleUpperCase() : key);
		}
		if (this.#target && document.activeElement !== this.#target) this.#target.focus({ preventScroll: true });
	}

	/** Letting go of backspace (or sliding off the keyboard) stops it repeating. */
	stopBackspace() {
		clearTimeout(this.#holdTimer);
		clearInterval(this.#repeatTimer);
	}

	#show(input) {
		this.#target = input;
		this.layout = 'letters';
		this.capsLock = false;
		this.#autoShift();
		this.open = true;
		this.field = input;
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
		this.#autoShift();
	}

	/** One tap: uppercase for the next letter. Double tap: caps lock. Tap again: off. */
	#tapShift() {
		const now = performance.now();
		if (this.capsLock) {
			this.capsLock = false;
			this.shift = false;
			this.#lastShiftTap = 0;
		} else if (now - this.#lastShiftTap < DOUBLE_TAP_MS) {
			this.capsLock = true;
			this.shift = true;
			this.#lastShiftTap = 0; // so a third quick tap doesn't count as another double tap
		} else {
			this.shift = !this.shift;
			this.#lastShiftTap = now;
		}
	}

	/** Capital letter at the start of a text field, lowercase after that (unless caps lock is on). */
	#autoShift() {
		const plain = this.#target.dataset.keyboard === 'plain';
		this.shift = this.capsLock || (!plain && this.#target.selectionStart === 0 && this.layout === 'letters');
	}

	/** Backspace pressed: delete one now, and keep deleting while it's held. */
	#holdBackspace() {
		this.stopBackspace();
		this.#backspace();
		this.#holdTimer = setTimeout(() => {
			this.#repeatTimer = setInterval(() => this.#backspace(), REPEAT_EVERY_MS);
		}, REPEAT_DELAY_MS);
	}
}

export const keyboard = new Keyboard();

