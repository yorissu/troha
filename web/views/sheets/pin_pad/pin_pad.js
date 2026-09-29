
/**
 * PIN pad: sets up a new PIN (entered twice) or logs in.
 *
 * Logging in needs no OK: the PIN is checked by itself as soon as it has as many
 * digits as the PIN does, and the key in the corner is Cancel. (A PIN set before
 * its length was kept still has an OK key until its next login teaches the length.)
 * Setting a PIN: its length is up to you, so Next confirms it; repeating it is
 * checked as soon as it's as long as the first.
 *
 * Wrong PINs shake the dots; after too many, the pad waits with a countdown (the
 * Session decides; the pad shows it). A physical keyboard works too.
 *
 * Easter egg: 0000 can't be set as a PIN; tried at login (as the whole PIN), the dots
 * wobble and say something cheeky (and it doesn't count as a wrong try). A longer PIN
 * that starts with 0000 is typed like any other.
 */

import { h, icon, replayAnimation } from '../../../core/dom.js';
import { say } from '../../../core/text.js';
import { listenForKeyPresses } from '../../../core/taps.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DOT_ANIMATIONS = ['shake', 'nice-try'];

export class PinPad extends Sheet {
	#session;
	#limits;
	#remarks;
	#onDone;
	#onForgot;
	#title = h('h2');
	#note = h('p', { className: 'note' });
	#dots = h('div', { className: 'pin-dots' });
	#keypad = h('div', { className: 'keypad' });
	#cornerKey; // bottom right: Cancel, or OK / Next / Set when the PIN needs confirming
	#forgot;
	#cancel;    // under the keypad, while the corner key isn't Cancel
	#mode = 'login'; // 'set' or 'login'
	#step = 1;       // setting a PIN: 1 = enter it, 2 = repeat it
	#entry = '';
	#first = '';
	#checking = false;
	#then = null;     // after logging in
	#onCancel = null; // if cancelled instead

	/**
	 * @param {import('../../base/sheet/sheet.js').SheetHost} host
	 * @param {object} options
	 * @param {import('../../../models/session.js').Session} options.session
	 * @param {{minLength: number, maxLength: number}} options.limits
	 * @param {{wrongPin: string[], niceTry: string[]}} options.remarks What the note says after a wrong PIN, and after 0000.
	 * @param {(how: 'login'|'set') => void} options.onDone Called after logging in, or after setting a PIN.
	 * @param {(element: HTMLElement) => void} options.onForgot "Forgot PIN?" tapped.
	 */
	constructor(host, { session, limits, remarks, onDone, onForgot }) {
		super(host, { className: 'sheet-pin' });
		this.#session = session;
		this.#limits = limits;
		this.#remarks = remarks;
		this.#onDone = onDone;
		this.#onForgot = onForgot;

		// Keys count when pressed, once per touch (see core/taps.js).
		const key = (name, label, ariaLabel = null) => h('button', {
			className: 'pin-key squish',
			type: 'button',
			dataset: { key: name },
			attrs: { 'aria-label': ariaLabel },
		}, label);
		this.#cornerKey = key('corner', '');
		this.#keypad.append(
			...DIGITS.map((digit) => key(digit, digit)),
			key('back', icon('backspace'), 'Delete'),
			key('0', '0'),
			this.#cornerKey);
		listenForKeyPresses(this.#keypad, '.pin-key', ({ dataset }) => {
			if (dataset.key === 'corner') this.#tapCorner();
			else if (dataset.key === 'back') this.#backspace();
			else this.#type(dataset.key);
		});

		this.#forgot = new Button({ className: 'button link', label: 'Forgot PIN?', onTap: (element) => this.#onForgot(element) });
		this.#cancel = new Button({ className: 'button', label: 'Cancel', onTap: () => this.#dismiss() });
		this.element.append(this.#title, this.#note, this.#dots, this.#keypad,
			h('div', { className: 'sheet-actions pin-actions' }, this.#forgot.element, this.#cancel.element));

		document.addEventListener('keydown', (event) => {
			if (!this.isOpen) return;
			if (/^[0-9]$/.test(event.key)) this.#type(event.key);
			else if (event.key === 'Backspace') this.#backspace();
			else if (event.key === 'Enter' && this.#needsConfirming) this.#submit();
			else if (event.key === 'Escape') this.#dismiss();
		});
	}

	/**
	 * Makes sure the user is logged in, then runs `then`.
	 * Asks for the PIN (or to set one up) if needed.
	 * @param {{origin?: Element, then?: () => void, onCancel?: () => void}} [options]
	 *   onCancel: the pad was cancelled instead (Cancel, Escape, or a tap beside it).
	 */
	ask({ origin, then, onCancel } = {}) {
		if (this.#session.loggedIn) {
			then?.();
			return;
		}
		this.#mode = this.#session.hasPin ? 'login' : 'set';
		this.#startOver();
		this.#then = then ?? null;
		this.#onCancel = onCancel ?? null;
		this.#render();
		this.open(origin);
	}

	/** Comes back to the pad as it was (e.g. after "Keep them" on the reset question). */
	reopen(origin) {
		this.#render();
		this.open(origin);
	}

	/** Called every second: keeps the lockout countdown up to date. */
	tick() {
		if (this.isOpen && this.#session.lockoutCountingDown) this.#render();
	}

	onOutsideTap() {
		this.#dismiss();
	}

	onHide() {
		this.#startOver();
		this.#then = null;
		this.#onCancel = null;
	}

	/** Cancelled: closes, then lets whoever asked go back (onCancel). */
	#dismiss() {
		const onCancel = this.#onCancel;
		this.close();
		onCancel?.();
	}

	/** Back to an empty first step (nothing typed, nothing to repeat). */
	#startOver() {
		this.#step = 1;
		this.#entry = '';
		this.#first = '';
	}

	/** True while typing must wait: a PIN is being checked or saved, or during a lockout. */
	get #busy() {
		return this.#checking || this.#session.lockoutSecondsLeft > 0;
	}

	/** Clears what was typed and plays `animation` on the dots ('shake' or 'nice-try'). */
	#reject(animation) {
		this.#entry = '';
		replayAnimation(this.#dots, animation, DOT_ANIMATIONS);
	}

	/** True while the PIN needs a key to confirm it (setting one, or a PIN of unknown length). */
	get #needsConfirming() {
		return this.#mode === 'set' || !this.#session.pinLength;
	}

	/** How many digits the PIN will have, if known: the dots show that many. */
	get #expectedLength() {
		if (this.#mode === 'login') return this.#session.pinLength;
		return this.#step === 2 ? this.#first.length : null;
	}

	#render(message) {
		const waitSeconds = this.#session.lockoutSecondsLeft;
		const { minLength, maxLength } = this.#limits;
		const defaultNote = this.#mode === 'login' ? 'Private habits need your PIN'
			: this.#step === 1 ? `${minLength} to ${maxLength} digits, then Next` : 'Enter the same PIN again';

		this.#title.textContent = this.#mode === 'login' ? 'Enter your PIN' : this.#step === 1 ? 'Set a PIN' : 'Repeat your PIN';
		this.#note.textContent = waitSeconds ? `Too many tries. Try again in ${waitSeconds}s` : message ?? defaultNote;
		const dots = Math.max(this.#expectedLength ?? minLength, this.#entry.length);
		this.#dots.replaceChildren(...Array.from({ length: dots }, (_, i) =>
			h('span', { className: i < this.#entry.length ? 'pin-dot filled' : 'pin-dot' })));
		this.#dots.children[this.#entry.length - 1]?.classList.toggle('new', !message);
		this.#keypad.classList.toggle('disabled', waitSeconds > 0 || this.#checking);

		// The corner key: Cancel, or the key that confirms the PIN (then Cancel moves below).
		const confirm = this.#needsConfirming;
		this.#cornerKey.textContent = !confirm ? 'Cancel' : this.#mode === 'login' ? 'OK' : this.#step === 1 ? 'Next' : 'Set';
		this.#cornerKey.classList.toggle('ok', confirm);
		this.#cornerKey.classList.toggle('cancel', !confirm);
		this.#forgot.hidden = this.#mode !== 'login'; // Component.hidden
		this.#cancel.hidden = !confirm;
	}

	#tapCorner() {
		if (this.#needsConfirming) this.#submit();
		else this.#dismiss();
	}

	/** A digit. Once the PIN is long enough to check, it's checked by itself. */
	#type(digit) {
		if (this.#busy || this.#entry.length >= this.#limits.maxLength) return;
		this.#entry += digit;
		this.#render();
		if (this.#entry.length === this.#expectedLength) this.#submit();
	}

	#backspace() {
		if (this.#busy) return;
		this.#entry = this.#entry.slice(0, -1);
		this.#render();
	}

	async #submit() {
		if (this.#busy) return;
		if (this.#entry.length < this.#limits.minLength) {
			this.#render(`Use at least ${this.#limits.minLength} digits`);
			return;
		}
		if (this.#mode === 'set') {
			await this.#submitNewPin();
			return;
		}

		const result = await this.#whileChecking('Checking…', () => this.#session.login(this.#entry));
		if (result === 'ok') {
			this.#finish('login');
		} else if (result === 'nice-try') {
			this.#reject('nice-try');
			this.#render(say(this.#remarks.niceTry));
		} else if (result === 'wrong') {
			this.#reject('shake');
			this.#render(say(this.#remarks.wrongPin));
		} else {
			this.#entry = '';
			this.#render("Couldn't check the PIN. Try again");
		}
	}

	async #submitNewPin() {
		if (this.#step === 1) {
			if (!this.#session.isAllowedPin(this.#entry)) {
				this.#reject('shake');
				this.#render('Too easy to guess. Pick another PIN');
				return;
			}
			this.#first = this.#entry;
			this.#entry = '';
			this.#step = 2;
			this.#render();
			return;
		}
		if (this.#entry !== this.#first) {
			this.#startOver();
			this.#reject('shake');
			this.#render("PINs didn't match. Start again");
			return;
		}
		const result = await this.#whileChecking('Saving…', () => this.#session.setPin(this.#entry));
		if (result === 'error') {
			this.#startOver();
			this.#render("Couldn't set the PIN. Try again");
			return;
		}
		this.#finish('set');
	}

	/**
	 * Runs `work` (checking or saving a PIN) while the keypad waits and `message` shows.
	 * @returns {Promise<any>} What `work` returned, or 'error' if it failed.
	 */
	async #whileChecking(message, work) {
		this.#checking = true;
		this.#render(message);
		try {
			return await work();
		} catch (error) {
			console.error(error);
			return 'error';
		} finally {
			this.#checking = false; // before the caller shows the outcome, so the keypad is back
		}
	}

	#finish(how) {
		const then = this.#then;
		this.close();
		this.#onDone(how);
		then?.();
	}
}
