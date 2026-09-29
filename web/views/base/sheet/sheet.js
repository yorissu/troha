
/**
 * Pop-up sheets.
 *
 * SheetHost owns the dimmed overlay and shows one sheet at a time. Sheets grow out
 * of the element that opened them, and shrink back when closed. Every pop-up is a
 * subclass of Sheet.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../component/component.js';

const CLOSE_MS = 450; // longest exit animation in sheet.css

export class SheetHost extends Component {
	#sheets = [];
	#current = null;
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
	 * Shows `sheet` (replacing any other), growing out of `origin`.
	 * @param {Sheet} sheet
	 * @param {Element} [origin]
	 */
	show(sheet, origin) {
		clearTimeout(this.#closeTimer);
		this.element.classList.remove('closing');
		this.element.hidden = false;
		for (const other of this.#sheets) {
			other.element.hidden = other !== sheet;
			other.element.classList.remove('leaving', 'poof');
		}
		this.#current = sheet;

		const element = sheet.element;
		[...element.children].forEach((child, i) => child.style.setProperty('--i', i)); // stagger contents
		element.style.animation = 'none'; // measure the sheet without its animation
		const box = element.getBoundingClientRect();
		const from = origin?.getBoundingClientRect();
		element.style.transformOrigin = from
			? `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`
			: '50% 0';
		void element.offsetWidth;
		element.style.animation = '';
	}

	/**
	 * Closes the current sheet.
	 * @param {{poof?: boolean}} [options] `poof`: the "deleted" exit instead of shrinking back.
	 */
	close({ poof = false } = {}) {
		const sheet = this.#current;
		if (!sheet || !this.isOpen) return;
		this.#current = null;
		sheet.element.classList.add(poof ? 'poof' : 'leaving');
		this.element.classList.add('closing');
		this.#closeTimer = setTimeout(() => {
			this.element.hidden = true;
			this.element.classList.remove('closing');
		}, CLOSE_MS);
		document.activeElement?.blur();
		sheet.onHide();
	}
}

export class Sheet extends Component {
	/**
	 * @param {SheetHost} host
	 * @param {{tag?: string, className?: string}} [options]
	 */
	constructor(host, { tag = 'div', className = '' } = {}) {
		super(h(tag, { className: `sheet ${className}`.trim(), hidden: true }));
		this.host = host;
		host.add(this);
	}

	/** True while this sheet is on screen. */
	get isOpen() {
		return this.host.current === this && this.host.isOpen;
	}

	/** @param {Element} [origin] The element it grows out of. */
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
