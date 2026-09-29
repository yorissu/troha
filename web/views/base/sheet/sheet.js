
/**
 * Pop-up sheets.
 *
 * SheetHost owns the dimmed overlay and shows one sheet at a time. Sheets swing in
 * from the side of the element that opened them, and shrink back toward it when
 * closed. Every pop-up is a subclass of Sheet.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../component/component.js';

const CLOSE_MS = 450; // longest exit animation in sheet.css

export class SheetHost extends Component {
	#sheets = [];
	#current = null;
	#originRect = null; // where the element that opened the current sheet is (null: unknown)
	#closeTimer;

	constructor() {
		super(h('div', { className: 'overlay', hidden: true }));
		this.element.addEventListener('click', (event) => {
			if (event.target === this.element) this.#current?.onOutsideTap();
		});
	}

	/** The sheet on screen (or null). */
	get current() {
		return this.#current;
	}

	/** True while a sheet is shown (not while one is closing). */
	get isOpen() {
		return !this.element.hidden && !this.element.classList.contains('closing');
	}

	/** Adds a sheet to the overlay (done by the Sheet constructor). */
	add(sheet) {
		this.#sheets.push(sheet);
		this.element.append(sheet.element);
	}

	/**
	 * Shows `sheet` (replacing any other), swinging in from `origin`'s side; it will close toward `origin`.
	 * @param {Sheet} sheet
	 * @param {Element} [origin]
	 */
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
		element.style.transformOrigin = ''; // its own (sheet.css), for swinging in
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

/** Where `element` is on screen, or null if it isn't (none given, removed, or hidden). */
function visibleRect(element) {
	if (!element?.isConnected) return null;
	const rect = element.getBoundingClientRect();
	return rect.width || rect.height ? rect : null;
}

/** Plays an element's CSS animation again from the start. */
function replayAnimationOf(element) {
	element.style.animation = 'none';
	void element.offsetWidth; // let the browser notice
	element.style.animation = '';
}

export class Sheet extends Component {
	/**
	 * @param {SheetHost} host
	 * @param {object} [options]
	 * @param {string} [options.className]
	 * @param {() => void} [options.onSubmit] Makes the sheet a form: Enter (or a submit button) calls this.
	 */
	constructor(host, { className = '', onSubmit = null } = {}) {
		super(h(onSubmit ? 'form' : 'div', { className: `sheet ${className}`.trim(), hidden: true }));
		this.host = host;
		host.add(this);
		if (onSubmit) {
			this.element.autocomplete = 'off';
			this.element.addEventListener('submit', (event) => {
				event.preventDefault(); // stay on the page
				onSubmit();
			});
		}
	}

	/** True while this sheet is on screen. */
	get isOpen() {
		return this.host.current === this && this.host.isOpen;
	}

	/** @param {Element} [origin] The element that opened it (it closes toward it). */
	open(origin) {
		this.host.show(this, origin);
	}

	close(options) {
		if (this.host.current === this) this.host.close(options);
	}

	/** Tapping the dimmed area around the sheet. Subclasses may override. */
	onOutsideTap() {
		this.close();
	}

	/** Called after this sheet was closed. Subclasses clean up here. */
	onHide() {}
}
