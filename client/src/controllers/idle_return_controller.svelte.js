
/**
 * Going home after a while without a touch: once nobody has touched the screen for
 * `afterMs`, any pop-up closes and the home view (Today) comes back. Meanwhile,
 * `pending` says how close that is, so the home view's button can fill its ring
 * toward it (components/controls/view_button.svelte).
 *
 * Made while the board is set up; stops with it (it subscribes to services/clock
 * and services/idle itself).
 */

import { onDestroy } from 'svelte';
import { clock } from '../services/clock.svelte.js';
import { idle } from '../services/idle.js';
import { sheets } from '../components/base/sheet_host.js';

export class IdleReturnController {
	/**
	 * While another view is on: { view: the home view, fraction: 0 just touched, 1 going
	 * there now }. null on the home view (or before the board is ready).
	 * @type {{view: string, fraction: number}|null}
	 */
	pending = $state(null);

	#home;
	#afterMs;
	#currentView;
	#show;

	/**
	 * @param {object} options
	 * @param {string} options.home The view to go back to.
	 * @param {number} options.afterMs After this long without a touch.
	 * @param {() => string|null} options.currentView The view on screen, or null while there's nothing to go back from (not loaded yet).
	 * @param {(view: string) => void} options.show Shows a view.
	 */
	constructor({ home, afterMs, currentView, show }) {
		this.#home = home;
		this.#afterMs = afterMs;
		this.#currentView = currentView;
		this.#show = show;
		onDestroy(clock.onTick(() => this.#tick()));
		onDestroy(idle.onActivity(() => this.#showPending())); // a touch empties the ring at once
	}

	#tick() {
		const view = this.#currentView();
		if (view !== null && idle.idleMs > this.#afterMs && (view !== this.#home || sheets.isOpen)) {
			sheets.close();
			this.#show(this.#home);
		}
		this.#showPending();
	}

	#showPending() {
		const view = this.#currentView();
		this.pending = view !== null && view !== this.#home
			? { view: this.#home, fraction: Math.min(1, idle.idleMs / this.#afterMs) }
			: null;
	}
}
