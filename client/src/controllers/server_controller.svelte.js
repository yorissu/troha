
/**
 * Keeps an eye on the server. Once it's lost (a request isn't answered in time,
 * or the regular check fails), nothing can be changed any more: the server-down
 * pop-up covers everything and can't be closed (`down`), no touch or key reaches
 * anything (not even what listens to the whole page, like the idle timer), and no
 * request is sent, so whatever wasn't saved is dropped. Only a tap on a blacked-out
 * screen still wakes it, so the pop-up can be seen. The page can't restart the server itself
 * (Docker does that, or it's the network that's gone). As soon as it answers
 * again, the page reloads with what the server has.
 *
 * It also passes on what any request may hear: that the session ended (signed out)
 * or the license did.
 */

import { serverAnswers, serverLost, watchServer } from '../models/api.js';

/** Input that's caught while the server is lost. */
const BLOCKED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
	'touchstart', 'touchend', 'keydown', 'keyup', 'keypress', 'wheel'];

export class ServerController {
	/** True while the server can't be reached (the pop-up is up). */
	down = $state(false);

	#checkEveryMs;
	#timer;

	/**
	 * @param {object} options
	 * @param {{serverCheckMs: number, serverTimeoutMs: number}} options.timing
	 * @param {() => void} options.onSignedOut The session ended.
	 * @param {() => void} options.onNoLicense The license ended.
	 */
	constructor({ timing, onSignedOut, onNoLicense }) {
		this.#checkEveryMs = timing.serverCheckMs;
		watchServer({ timeoutMs: timing.serverTimeoutMs, onLost: () => this.#lost(), onSignedOut, onNoLicense });
	}

	/** Starts the regular check (calling it again is fine). */
	start() {
		this.#checkLater();
	}

	#checkLater() {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#check(), this.#checkEveryMs);
	}

	async #check() {
		const answers = await serverAnswers();
		if (this.down && answers) {
			location.reload(); // back: start afresh from what it has
			return;
		}
		if (!answers) serverLost(); // calls #lost() the first time
		this.#checkLater();
	}

	#lost() {
		if (this.down) return;
		this.down = true;
		document.activeElement?.blur();
		// Caught first (on the window, as it comes in), so nothing else hears it. Never
		// let go: the page reloads once the server is back.
		for (const type of BLOCKED_EVENTS) window.addEventListener(type, blockInput, { capture: true, passive: false });
		this.#checkLater();
	}
}

/** Stops an input event, unless it's a tap waking a blacked-out screen (the night shade). */
function blockInput(event) {
	if (event.target instanceof Element && event.target.closest('.night-shade.blank, .night-shade.waking')) return;
	event.stopImmediatePropagation();
	event.preventDefault();
}
