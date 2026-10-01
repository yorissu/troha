
/**
 * The PIN lock on hidden habits. Hidden habits show as blank bars until the PIN
 * unlocks them; the server checks the PIN, counts wrong tries (after a few, the
 * next must wait), and sends the names once it's right. Locking forgets the names
 * on the page again.
 *
 * The server decides how long they stay unlocked: each answer that unlocks them, or
 * keeps them unlocked while the page is in use (touch()), says how many seconds are
 * left, and this counts those down (msLeft). Once they've run out, the server has
 * locked them (the page then locks too: see HiddenController).
 *
 * Easter egg: 0000 can't be set as a PIN; tried, it gets a "nice try" (and doesn't
 * count as a wrong try).
 */

import { call, ServerLost } from './api.js';

const JOKE_PIN = '0000';

export class HiddenLock {
	/** True while hidden habits are shown. */
	unlocked = $state(false);
	/** True once the account has a PIN. */
	hasPin = $state(false);
	/** How many digits the PIN has (the PIN pad checks it as soon as that many are typed). */
	pinLength = $state(null);

	#store;
	#onChange;
	#locking = false;
	#waitUntil = 0;   // performance.now() until which no PIN may be tried
	#lastTouch = 0;
	#touching = false;
	#unlockedUntil = 0; // performance.now() when the server locks them (unless touched before)
	#unlockMs = 1;      // how long the last unlock (or touch) gave them

	/**
	 * @param {object} options
	 * @param {import('./habit_store.svelte.js').HabitStore} options.store
	 * @param {(unlocked: boolean) => void} [options.onChange] After unlocking or locking.
	 */
	constructor({ store, onChange }) {
		this.#store = store;
		this.#onChange = onChange;
	}

	/** Takes what the server said about the account (hasPin, pinLength, pinWait). */
	know({ hasPin, pinLength, pinWait }) {
		this.hasPin = hasPin;
		this.pinLength = pinLength;
		this.#wait(pinWait);
	}

	get locking() { return this.#locking; }

	/** True while a touch() is on its way (what's left is about to change). */
	get touching() { return this.#touching; }

	/** Milliseconds until the server locks them (0: it has, or they're locked). */
	get msLeft() {
		return this.unlocked ? Math.max(0, this.#unlockedUntil - performance.now()) : 0;
	}

	/** How much of the unlock is left, from 1 (just unlocked or touched) to 0. */
	get fractionLeft() {
		return Math.min(1, this.msLeft / this.#unlockMs);
	}

	/** Seconds until another PIN may be tried (0: now). */
	get waitSecondsLeft() {
		return Math.max(0, Math.ceil((this.#waitUntil - performance.now()) / 1000));
	}

	/** False for a PIN that may not be set (see JOKE_PIN). */
	isAllowedPin(pin) {
		return pin !== JOKE_PIN;
	}

	/** Sets the first PIN, which unlocks. @returns {Promise<'ok'|'error'>} */
	async setPin(pin) {
		return this.#unlocked(await this.#ask('/api/pin', { pin }));
	}

	/** A new PIN, with the account password (also when the PIN is forgotten). @returns the server's answer */
	async changePin(password, pin) {
		const answer = await this.#ask('/api/pin/change', { password, pin });
		this.#unlocked(answer);
		return answer;
	}

	/** Tries a PIN. @returns {Promise<'ok'|'wrong'|'nice-try'|'wait'|'error'>} 'ok': unlocked. */
	async unlock(pin) {
		const answer = await this.#ask('/api/pin/unlock', { pin });
		if (answer.ok) return this.#unlocked(answer);
		this.#wait(answer.wait ?? 0);
		return ['wrong', 'nice-try', 'wait'].includes(answer.reason) ? answer.reason : 'error';
	}

	/** Locks: saves first (a change still waiting to be saved has the names), then forgets them. */
	async lock() {
		if (!this.unlocked || this.#locking) return;
		this.#locking = true;
		try {
			await this.#store.save();
			await this.#ask('/api/pin/lock');
		} finally {
			this.#locking = false;
		}
		this.#store.hideNames();
		this.#setUnlocked(false);
	}

	/** Starts locked: if the server still has this session unlocked (e.g. after a reload), locks it there too. */
	async startLocked(serverUnlocked) {
		if (serverUnlocked) await this.#ask('/api/pin/lock');
	}

	/** Forgets the unlock on the page only (e.g. the server no longer has it, or after signing out). */
	forget() {
		this.#store.hideNames();
		this.#setUnlocked(false);
	}

	/** True if the server was last told the page is in use at least `everyMs` ago (and nothing is on its way). */
	touchDue(everyMs) {
		return !this.#touching && performance.now() - this.#lastTouch >= everyMs;
	}

	/** The page is in use: asks the server to keep them unlocked a while longer. */
	async touch() {
		if (!this.unlocked || this.#touching) return;
		this.#lastTouch = performance.now();
		this.#touching = true;
		try {
			const answer = await this.#ask('/api/pin/touch');
			if (!answer.ok) return;
			if (answer.unlocked) this.#keep(answer.unlockSeconds);
			else this.forget(); // it ran out on the server meanwhile
		} finally {
			this.#touching = false;
		}
	}

	#unlocked(answer) {
		if (!answer.ok) return 'error';
		this.#store.showNames(answer.names ?? {});
		this.hasPin = true;
		this.pinLength = answer.pinLength ?? this.pinLength;
		this.#lastTouch = performance.now();
		this.#keep(answer.unlockSeconds);
		this.#wait(0);
		this.#setUnlocked(true);
		return 'ok';
	}

	/** The server keeps them unlocked for `seconds` more (counted from now: the device's clock doesn't matter). */
	#keep(seconds) {
		this.#unlockMs = Math.max(1, (seconds ?? 0) * 1000);
		this.#unlockedUntil = performance.now() + this.#unlockMs;
	}

	#setUnlocked(unlocked) {
		if (this.unlocked === unlocked) return;
		this.unlocked = unlocked;
		this.#onChange?.(unlocked);
	}

	#wait(seconds) {
		this.#waitUntil = seconds > 0 ? performance.now() + seconds * 1000 : 0;
	}

	async #ask(url, body) {
		try {
			return await call('POST', url, body);
		} catch (error) {
			if (error instanceof ServerLost) return { ok: false, reason: 'lost' };
			throw error;
		}
	}
}
