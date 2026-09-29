
/**
 * Keeps an eye on the server. Once it's lost (a request isn't answered in time,
 * or the regular check fails), nothing can be changed any more: the server-down
 * pop-up covers everything and can't be closed, and no request is sent, so
 * whatever wasn't saved is dropped. The page can't start the server itself: on
 * the Pi the system does (troha.service), a few seconds later. As soon as it
 * answers again, the page reloads with what the server has.
 */

import { serverAnswers, serverLost, watchServer } from '../models/api.js';

const DOWN_CHECK_MS = 1000; // while it's down: check this often, to reload as soon as it's back

export class ServerController {
	#dialog;
	#checkEveryMs;
	#down = false;
	#timer;

	/**
	 * @param {object} options
	 * @param {import('../views/overlays/server_down/server_down.js').ServerDown} options.dialog
	 * @param {{serverCheckMs: number, serverTimeoutMs: number}} options.timing
	 */
	constructor({ dialog, timing }) {
		this.#dialog = dialog;
		this.#checkEveryMs = timing.serverCheckMs;
		watchServer({ timeoutMs: timing.serverTimeoutMs, onLost: () => this.#lost() });
	}

	/** Starts the regular check (calling it again is fine). */
	start() {
		this.#checkLater();
	}

	#checkLater() {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#check(), this.#down ? DOWN_CHECK_MS : this.#checkEveryMs);
	}

	async #check() {
		const answers = await serverAnswers();
		if (this.#down && answers) {
			location.reload(); // back: start afresh from what it has
			return;
		}
		if (!answers) serverLost(); // calls #lost() the first time
		this.#checkLater();
	}

	#lost() {
		if (this.#down) return;
		this.#down = true;
		document.activeElement?.blur();
		this.#dialog.show();
		this.#checkLater();
	}
}
