
/**
 * Logging in and out: the lock button, the PIN pad, "Forgot PIN?",
 * and asking "Log out?" after a minute without a touch.
 */

import { plural, say } from '../core/text.js';
import { messages } from '../messages.js';

export class SessionController {
	#session;
	#store;
	#idle;
	#sheets;
	#lockButton;
	#pinPad;
	#confirm;
	#logoutConfirm;
	#toast;
	#timing;
	#onChange;

	/**
	 * @param {object} options
	 * @param {import('../models/session.js').Session} options.session
	 * @param {import('../models/habit_store.js').HabitStore} options.store
	 * @param {import('../core/idle_timer.js').IdleTimer} options.idle
	 * @param {import('../views/base/sheet/sheet.js').SheetHost} options.sheets
	 * @param {import('../views/controls/lock_button/lock_button.js').LockButton} options.lockButton
	 * @param {import('../views/sheets/pin_pad/pin_pad.js').PinPad} options.pinPad
	 * @param {import('../views/sheets/confirm_sheet/confirm_sheet.js').ConfirmSheet} options.confirm For "Reset PIN?".
	 * @param {import('../views/sheets/confirm_sheet/confirm_sheet.js').ConfirmSheet} options.logoutConfirm For "Log out?".
	 * @param {import('../views/overlays/toast/toast.js').Toast} options.toast
	 * @param {{logoutAfterMs: number, logoutConfirmMs: number}} options.timing
	 * @param {(loggedIn: boolean) => void} options.onChange After logging in or out (and after a PIN reset).
	 */
	constructor(options) {
		this.#session = options.session;
		this.#store = options.store;
		this.#idle = options.idle;
		this.#sheets = options.sheets;
		this.#lockButton = options.lockButton;
		this.#pinPad = options.pinPad;
		this.#confirm = options.confirm;
		this.#logoutConfirm = options.logoutConfirm;
		this.#toast = options.toast;
		this.#timing = options.timing;
		this.#onChange = options.onChange;

		this.#session.addEventListener('change', () => this.#sessionChanged());
		this.#idle.addEventListener('activity', () => this.#showIdleTimer());
	}

	/** Shows the lock button's state. Call once after loading. */
	start() {
		this.#showLockState();
	}

	/**
	 * Runs `then` once logged in, asking for the PIN (or setting one up) first if needed.
	 * `onCancel` runs if the PIN pad is cancelled instead (e.g. to go back where it was asked).
	 */
	requireLogin(origin, then, onCancel) {
		this.#pinPad.ask({ origin, then, onCancel });
	}

	/** The lock button: log in, or ask to log out. */
	tapLockButton(element) {
		if (this.#session.loggedIn) this.#askLogout(element);
		else this.requireLogin(element);
	}

	/** "Forgot PIN?" on the PIN pad: offer the reset, which deletes private habits. */
	forgot(origin) {
		const count = this.#store.habits.filter((habit) => habit.private).length;
		this.#confirm.ask({
			title: 'Reset PIN?',
			note: count
				? `This permanently deletes your ${plural(count, 'private habit')}. You can set a new PIN and add them again.`
				: 'You have no private habits, so nothing will be deleted. You can set a new PIN afterwards.',
			noLabel: 'Keep them',
			yesLabel: 'Reset and delete',
			poof: true,
			origin,
			onNo: () => this.#pinPad.reopen(origin),
			onYes: () => {
				const removed = this.#session.resetPin();
				this.#store.save();
				this.#toast.show(removed ? `PIN reset. ${plural(removed, 'private habit')} deleted` : 'PIN reset', { duration: 'long' });
			},
		});
	}

	/** Called every second: the border timer, and "Log out?" after a minute without a touch. */
	tick() {
		this.#showIdleTimer();
		this.#pinPad.tick();
		const idleTooLong = this.#idle.idleMs > this.#timing.logoutAfterMs;
		if (this.#session.loggedIn && !this.#session.loggingOut && idleTooLong && !this.#logoutConfirm.isOpen) {
			this.#askLogout();
		}
	}

	#askLogout(origin) {
		this.#logoutConfirm.ask({
			title: 'Log out?',
			noLabel: 'No',
			yesLabel: 'Yes',
			yesStyle: 'primary',
			countdownMs: this.#timing.logoutConfirmMs,
			countdownNote: (seconds) => `Logging out in ${seconds}s`,
			origin,
			onYes: async () => {
				await this.#session.logout();
				this.#toast.show(say(messages.loggedOut), { duration: 'short' });
			},
		});
	}

	#sessionChanged() {
		if (this.#session.loggedIn) this.#idle.touch(); // a fresh minute after logging in
		else this.#sheets.close(); // nothing private stays open
		this.#showLockState();
		this.#onChange(this.#session.loggedIn);
	}

	#showLockState() {
		this.#lockButton.setState(!this.#session.hasPin ? 'set' : this.#session.loggedIn ? 'open' : 'locked');
		this.#showIdleTimer();
	}

	#showIdleTimer() {
		this.#lockButton.setTimeLeft(this.#session.loggedIn ? this.#idle.fractionLeft(this.#timing.logoutAfterMs) : null);
	}
}
