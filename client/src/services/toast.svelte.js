
/**
 * Toasts: short messages at the bottom of the screen, which anything can show, and
 * which go by themselves. One at a time: a new one replaces the one before (the one
 * on its way out still finishes leaving, below it, never on top). A toast can carry
 * an action, e.g. "Undo". components/overlays/toast.svelte draws them. (Messages
 * that stay for as long as they apply are notices: services/notices.svelte.js.)
 */

import { config } from '../config.js';

const LEAVE_MS = 700; // length of a toast's .leaving animation

let lastId = 0;

class Toasts {
	/**
	 * What's on screen: the toast, and any still leaving.
	 * @type {{id: number, message: string, actionLabel: string|null, durationMs: number|null, leaving: boolean}[]}
	 */
	items = $state([]);

	#actions = new Map(); // item id -> its action (only while it's offered)
	#timers = new Map();  // item id -> its timer (going, or leaving)

	/**
	 * A toast, replacing the one on screen.
	 * @param {string} text
	 * @param {object} [options]
	 * @param {'short'|'normal'|'long'|number} [options.duration] How long it stays: one of
	 *   config.toastMs (by how long the message is), or a time in ms.
	 * @param {boolean} [options.sticky] Stay until hide() is called.
	 * @param {{label: string, onTap: () => void}} [options.action] A button in the toast; tapping it closes the toast.
	 */
	show(text, { duration = 'normal', sticky = false, action = null } = {}) {
		const current = this.#toast();
		if (current) this.#remove(current.id); // replaced at once: the new one pops in where it was
		const item = this.#add({ message: text, action, durationMs: sticky ? null : this.#ms(duration) });
		if (item.durationMs !== null) this.#later(item.id, item.durationMs, () => this.#leave(item.id));
	}

	/** Sends the toast away. */
	hide() {
		const current = this.#toast();
		if (current) this.#leave(current.id);
	}

	/** True while the toast offers an action (e.g. "Undo"). */
	hasAction() {
		const current = this.#toast();
		return Boolean(current && this.#actions.has(current.id));
	}

	/** True while `onTap` (an action given to show()) is the one on offer. */
	offers(onTap) {
		const current = this.#toast();
		return Boolean(current) && this.#actions.get(current.id) === onTap;
	}

	/** A toast's action button was tapped: it goes, and the action runs. */
	tapAction(id) {
		const action = this.#actions.get(id);
		this.#leave(id);
		action?.();
	}

	#add({ message, action, durationMs }) {
		const id = ++lastId;
		if (action) this.#actions.set(id, action.onTap);
		this.items.push({ id, message, actionLabel: action?.label ?? null, durationMs, leaving: false });
		return this.#find(id);
	}

	/** Hops away, then is gone. Its action is no longer on offer. */
	#leave(id) {
		const item = this.#find(id);
		this.#actions.delete(id);
		if (!item || item.leaving) return;
		item.leaving = true;
		this.#later(id, LEAVE_MS, () => this.#remove(id));
	}

	#remove(id) {
		clearTimeout(this.#timers.get(id));
		this.#timers.delete(id);
		this.#actions.delete(id);
		const index = this.items.findIndex((item) => item.id === id);
		if (index !== -1) this.items.splice(index, 1);
	}

	#later(id, ms, then) {
		clearTimeout(this.#timers.get(id));
		this.#timers.set(id, setTimeout(then, ms));
	}

	#toast() {
		return this.items.find((item) => !item.leaving);
	}

	#find(id) {
		return this.items.find((item) => item.id === id);
	}

	#ms(duration) {
		return config.toastMs[duration] ?? duration;
	}
}

export const toast = new Toasts();
