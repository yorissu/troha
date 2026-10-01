
/**
 * Sheet host: the dimmed overlay for pop-up sheets, showing one sheet at a time.
 * Sheets swing in from the side of the element that opened them, and shrink back
 * toward it when closed. (The overlay is sheet_layer.svelte; each sheet is a
 * sheet.svelte, which registers itself here.)
 */

import { visibleRect } from '../../core/dom.js';

const CLOSE_MS = 450; // longest exit animation in styles/sheets.css

class SheetHost {
	/** The overlay element (set by sheet_layer.svelte). */
	element = null;

	#current = null;
	#sheets = new Set();
	#originRect = null; // where the element that opened the current sheet is (null: unknown)
	#closeTimer;

	/** The sheet on screen (or null). */
	get current() {
		return this.#current;
	}

	/** True while a sheet is shown (not while one is closing). */
	get isOpen() {
		return Boolean(this.element) && !this.element.hidden && !this.element.classList.contains('closing');
	}

	/** Adds a sheet (done by sheet.svelte). @param {{element: HTMLElement, onOutsideTap: () => void, onHide: () => void}} sheet */
	add(sheet) {
		this.#sheets.add(sheet);
	}

	remove(sheet) {
		this.#sheets.delete(sheet);
	}

	/** Shows `sheet` (replacing any other), swinging in from `origin`'s side; it will close toward `origin`. */
	show(sheet, origin) {
		const from = visibleRect(origin); // before anything is hidden: it may be in the sheet on screen now
		clearTimeout(this.#closeTimer);
		this.element.classList.remove('closing');
		this.element.hidden = false;
		for (const other of this.#sheets) {
			other.element.hidden = other !== sheet;
			other.element.classList.remove('leaving', 'poof');
		}
		this.#current = sheet;
		this.#originRect = from;

		const element = sheet.element;
		[...element.children].forEach((child, i) => child.style.setProperty('--i', i)); // stagger contents
		element.style.transformOrigin = ''; // its own (sheets.css), for swinging in
		// From the left if it was opened on the left half of the screen, else from the right.
		const overlay = this.element.getBoundingClientRect();
		const fromLeft = from && from.left + from.width / 2 < overlay.left + overlay.width / 2;
		element.style.setProperty('--enter-from', fromLeft ? -1 : 1);
		replayAnimationOf(element);
	}

	/**
	 * Closes the current sheet.
	 * @param {{poof?: boolean}} [options] `poof`: the "deleted" exit instead of shrinking back.
	 */
	close({ poof = false } = {}) {
		const sheet = this.#current;
		if (!sheet || !this.isOpen) return;
		this.#current = null;
		this.#aimAtOrigin(sheet.element);
		sheet.element.classList.add(poof ? 'poof' : 'leaving');
		this.element.classList.add('closing');
		this.#closeTimer = setTimeout(() => {
			this.element.hidden = true;
			this.element.classList.remove('closing');
		}, CLOSE_MS);
		document.activeElement?.blur();
		sheet.onHide();
	}

	/** A tap on the dimmed area around the sheet. */
	tapOutside() {
		this.#current?.onOutsideTap();
	}

	/** Makes a closing sheet shrink toward the element that opened it (or its own top). */
	#aimAtOrigin(element) {
		element.style.animation = 'none'; // measure where it sits, without its animation
		const box = element.getBoundingClientRect();
		const from = this.#originRect;
		element.style.transformOrigin = from
			? `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`
			: '50% 0';
		element.style.animation = '';
	}
}

export const sheets = new SheetHost();

/** Plays an element's CSS animation again from the start. */
function replayAnimationOf(element) {
	element.style.animation = 'none';
	void element.offsetWidth; // let the browser notice
	element.style.animation = '';
}
