
/**
 * Notices: standing messages, listed in the Notices view (components/pages/notices_view.svelte)
 * for as long as they apply, e.g. "License ends in 3 days"; meanwhile that view's
 * button has a dot (components/frame/header.svelte). Whoever shows one drops it once
 * it no longer applies. Each has a key, so the same notice is never shown twice at once.
 */

const LEAVE_MS = 450; // length of a notice's .leaving animation

let lastId = 0;

class Notices {
	/** @type {{id: number, key: string, message: string, detail: string, tone: 'warning'|'error', leaving: boolean}[]} */
	items = $state([]);

	/**
	 * Shows a notice, or updates the one with the same key.
	 * @param {string} key
	 * @param {string} text Short: a headline.
	 * @param {{detail?: string, tone?: 'warning'|'error'}} [options] detail: a smaller second line;
	 *   tone: the colour of its warning icon (amber, or red for something that has gone wrong).
	 */
	show(key, text, { detail = '', tone = 'warning' } = {}) {
		const existing = this.#byKey(key);
		if (existing) {
			if (existing.message !== text) existing.message = text;
			if (existing.detail !== detail) existing.detail = detail;
			if (existing.tone !== tone) existing.tone = tone;
			return;
		}
		this.items.push({ id: ++lastId, key, message: text, detail, tone, leaving: false });
	}

	/** The most serious tone of the notices up (for the dot on the Notices button), or null if there are none. */
	get tone() {
		const shown = this.items.filter((item) => !item.leaving);
		return shown.some((item) => item.tone === 'error') ? 'error' : shown.length ? 'warning' : null;
	}

	/** Sends the notice with `key` away (it no longer applies), if it's there. */
	drop(key) {
		const item = this.#byKey(key);
		if (!item) return;
		item.leaving = true;
		setTimeout(() => {
			const index = this.items.findIndex((other) => other.id === item.id);
			if (index !== -1) this.items.splice(index, 1);
		}, LEAVE_MS);
	}

	#byKey(key) {
		return this.items.find((item) => item.key === key && !item.leaving);
	}
}

export const notices = new Notices();
