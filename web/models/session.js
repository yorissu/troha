
/**
 * Logging in with the PIN (for private habits).
 *
 * Events:
 *   'change'  when logging in or out
 */

import { createPinRecord, checkPin, newSalt } from '../core/crypto.js';
import { emptySecurity } from './data_format.js';

/** A PIN nobody may set (too easy to guess). Tried at login, it only gets a "nice try". */
const JOKE_PIN = '0000';

export class Session extends EventTarget {
	#store;
	#privateNames;
	#pinConfig;
	#loggedIn = false;

	/**
	 * @param {object} options
	 * @param {import('./habit_store.js').HabitStore} options.store
	 * @param {import('./private_names.js').PrivateNames} options.privateNames
	 * @param {{freeTries: number, lockoutMs: number}} options.pinConfig
	 */
	constructor({ store, privateNames, pinConfig }) {
		super();
		this.#store = store;
		this.#privateNames = privateNames;
		this.#pinConfig = pinConfig;
	}

	get loggedIn() { return this.#loggedIn; }
	get hasPin() { return this.#store.security.pin !== null; }

	/**
	 * Seconds until another PIN may be tried (0 when not locked out). Never more than
	 * one lockout, even if the clock was set back since.
	 */
	get lockoutSecondsLeft() {
		const until = this.#store.security.lockedUntil;
		if (!until || until <= Date.now()) return 0;
		return Math.ceil(Math.min(until - Date.now(), this.#pinConfig.lockoutMs) / 1000);
	}

	/** True during a lockout and for a moment after, so a PIN pad can re-enable itself. */
	get lockoutCountingDown() {
		const until = this.#store.security.lockedUntil;
		return Boolean(until) && until > Date.now() - 1500;
	}

	/** False for a PIN that may not be set (see JOKE_PIN). */
	isAllowedPin(pin) {
		return pin !== JOKE_PIN;
	}

	/**
	 * How many digits the PIN has, so the PIN pad can check it as soon as that many
	 * are typed; null if not known yet (PINs set before the length was kept learn it
	 * at their next login).
	 */
	get pinLength() {
		return this.#store.security.pin?.length ?? null;
	}

	/** Sets a new PIN and logs in. */
	async setPin(pin) {
		if (!this.isAllowedPin(pin)) throw new Error('This PIN may not be used');
		const security = this.#store.security;
		security.pin = { ...(await createPinRecord(pin)), length: pin.length };
		security.keySalt = newSalt();
		await this.#privateNames.unlock(pin, security.keySalt);
		this.#store.save();
		this.#setLoggedIn(true);
	}

	/**
	 * Tries a PIN. Wrong PINs count towards a lockout, except the joke PIN, which
	 * only gets a "nice try". (A PIN set as 0000 before it was forbidden still works.)
	 * @returns {Promise<'ok'|'wrong'|'nice-try'>} 'ok': logged in.
	 */
	async login(pin) {
		const security = this.#store.security;
		if (!security.pin) return 'wrong'; // no PIN set: nothing to log in to
		if (!(await checkPin(pin, security.pin))) {
			if (pin === JOKE_PIN) return 'nice-try';
			security.failedAttempts += 1;
			if (security.failedAttempts >= this.#pinConfig.freeTries) security.lockedUntil = Date.now() + this.#pinConfig.lockoutMs;
			this.#store.save();
			return 'wrong';
		}
		Object.assign(security, { failedAttempts: 0, lockedUntil: null });
		security.pin.length ??= pin.length; // learnt now, for a PIN set before its length was kept
		security.keySalt ??= newSalt();
		await this.#privateNames.unlock(pin, security.keySalt);
		await this.#privateNames.open(this.#store.habits);
		this.#store.save(); // also encrypts private names that were still plain
		this.#setLoggedIn(true);
		return 'ok';
	}

	logout() {
		if (!this.#loggedIn) return;
		this.#privateNames.lock(this.#store.habits);
		this.#setLoggedIn(false);
	}

	/** Forgot PIN: removes the PIN and every private habit. @returns how many habits were removed. */
	resetPin() {
		const count = this.#store.removePrivate();
		this.#store.data.security = emptySecurity();
		this.#privateNames.lock(this.#store.habits);
		this.#setLoggedIn(false);
		return count;
	}

	#setLoggedIn(loggedIn) {
		this.#loggedIn = loggedIn;
		this.dispatchEvent(new Event('change'));
	}
}
