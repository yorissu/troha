
/**
 * Hidden habits: the lock button, the PIN pad, "Forgot PIN?" (a new PIN with the
 * account password; the hidden habits stay), and asking "Lock them?".
 *
 * How long they stay unlocked is the server's to decide (server/troha_server/pin.py):
 * while someone touches the screen, this tells the server so (at most every
 * timing.unlockTouchMs), and the server gives them more time. Without a touch, the
 * time runs out: timing.lockConfirmMs before it does, this asks "Lock them?" (Not yet
 * gives them more time), and then they lock, here as on the server.
 */

import { onDestroy } from 'svelte';
import { say } from '../core/text.js';
import { messages } from '../messages.js';
import { clock } from '../services/clock.svelte.js';
import { idle } from '../services/idle.js';
import { toast } from '../services/toast.svelte.js';
import { problemText } from './problems.js';

export class HiddenController {
	/** The lock button's countdown to the server locking them (1 to 0) while unlocked, else null. */
	timeLeft = $state(null);

	#lock;
	#account;
	#views;
	#timing;
	#touched = false; // touched (or kept awake) since the server was last told

	/**
	 * Made while the board is set up; stops with it.
	 * @param {object} options
	 * @param {import('../models/hidden_lock.svelte.js').HiddenLock} options.lock
	 * @param {import('../models/account.svelte.js').Account} options.account For "Forgot PIN?" (the password).
	 * @param {object} options.views pinPad, lockConfirm, form
	 * @param {{lockConfirmMs: number, unlockTouchMs: number}} options.timing
	 */
	constructor({ lock, account, views, timing }) {
		this.#lock = lock;
		this.#account = account;
		this.#views = views;
		this.#timing = timing;
		onDestroy(idle.onActivity(() => { this.#touched = true; }));
		onDestroy(clock.onTick(() => this.#tick()));
	}

	/** The lock button's look: 'set' (no PIN yet), 'locked' or 'open'. */
	get buttonState() {
		return !this.#lock.hasPin ? 'set' : this.#lock.unlocked ? 'open' : 'locked';
	}

	/**
	 * Runs `then` once unlocked, asking for the PIN (or setting one up) first if needed.
	 * `onCancel` runs if the PIN pad is cancelled instead (e.g. to go back where it was asked).
	 */
	requireUnlock(origin, then, onCancel) {
		this.#views.pinPad.ask({ origin, then, onCancel });
	}

	/** The lock button: unlock, or ask to lock. */
	tapLockButton(element) {
		if (this.#lock.unlocked) this.#askLock(element);
		else this.requireUnlock(element);
	}

	/** After the PIN pad unlocked or set a PIN. */
	padDone(how) {
		toast.show(say(how === 'set' ? messages.pinSet : messages.unlocked), { duration: 'short' });
	}

	/** "Forgot PIN?" on the PIN pad: a new one, with the account password. */
	forgot(origin) {
		this.changePin(origin, {
			title: 'Forgot your PIN?',
			onCancel: () => this.#views.pinPad.reopen(origin),
		});
	}

	/** A new PIN (Account, or "Forgot PIN?"): the account password first, then the PIN pad. */
	changePin(origin, { title = this.#lock.hasPin ? 'Change your PIN' : 'Set a PIN', onCancel } = {}) {
		const { form, pinPad } = this.#views;
		form.ask({
			title,
			note: 'Type your account password, then choose the new PIN. Your hidden habits stay as they are.',
			fields: [{ name: 'password', label: 'Password', kind: 'password', autocomplete: 'current-password' }],
			submitLabel: 'Next',
			origin,
			onCancel: onCancel ? () => { form.close(); onCancel(); } : undefined,
			onSubmit: async ({ password }) => {
				const answer = await this.#account.checkPassword(password);
				if (!answer.ok) return problemText(answer, { passwordField: 'password' });
				pinPad.askNew({
					origin,
					title: 'Choose a new PIN',
					save: async (pin) => ((await this.#lock.changePin(password, pin)).ok ? 'ok' : 'error'),
				});
				return true;
			},
		});
	}

	/** Every second: tells the server if the page is in use, the border timer, and "Lock them?" near the end. */
	#tick() {
		const lock = this.#lock;
		if (lock.unlocked && (this.#touched || idle.keptAwake) && lock.touchDue(this.#timing.unlockTouchMs)) {
			this.#touched = false;
			lock.touch();
		}
		this.#showTimeLeft();
		if (!lock.unlocked || lock.locking || lock.touching || this.#views.lockConfirm.isOpen()) return;
		if (lock.msLeft === 0) lock.lock(); // ran out unasked (e.g. the page was in the background)
		else if (lock.msLeft <= this.#timing.lockConfirmMs) this.#askLock();
	}

	#askLock(origin) {
		this.#views.lockConfirm.ask({
			title: 'Lock hidden habits?',
			noLabel: 'Not yet',
			yesLabel: 'Lock',
			yesStyle: 'primary',
			countdownMs: origin ? this.#timing.lockConfirmMs : this.#lock.msLeft, // asked unasked: when the server locks them
			countdownNote: (seconds) => `Locking in ${seconds}s`,
			origin,
			onNo: () => {
				this.#views.lockConfirm.close();
				this.#lock.touch(); // "Not yet": more time, from the server
			},
			onYes: async () => {
				await this.#lock.lock();
				toast.show(say(messages.locked), { duration: 'short' });
			},
		});
	}

	#showTimeLeft() {
		this.timeLeft = this.#lock.unlocked ? this.#lock.fractionLeft : null;
	}
}
