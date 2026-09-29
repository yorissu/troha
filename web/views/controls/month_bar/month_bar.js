
/**
 * Month bar: ‹ September 2026 ›, for the Calendar and the date picker. It only
 * shows a month; its owner decides which one (onShift reports the arrows), and may
 * append more to the bar (the Calendar adds its streak and eraser).
 *
 * weekdayRow() makes the row of weekday names that goes under it.
 */

import { h } from '../../../core/dom.js';
import { formatDate } from '../../../core/dates.js';
import { Component } from '../../base/component/component.js';
import { IconButton } from '../icon_button/icon_button.js';

export class MonthBar extends Component {
	#locale;
	#label = h('div', { className: 'month-label' });
	#previous;

	/**
	 * @param {object} options
	 * @param {string} options.locale
	 * @param {(step: number) => void} options.onShift An arrow was tapped: -1 back, 1 on.
	 * @param {string} [options.className] Extra classes; the owner's CSS lays the bar out.
	 */
	constructor({ locale, onShift, className = '' }) {
		super(h('div', { className: `month-bar ${className}`.trim() }));
		this.#locale = locale;
		this.#previous = arrow('chevron_left', 'Previous month', () => onShift(-1));
		const next = arrow('chevron_right', 'Next month', () => onShift(1));
		this.element.append(this.#previous.element, this.#label, next.element);
	}

	/**
	 * Shows the month that `month` is in.
	 * @param {Date} month
	 * @param {{canGoBack?: boolean}} [options] `canGoBack` false greys out the back arrow.
	 */
	show(month, { canGoBack = true } = {}) {
		this.#label.textContent = formatDate(month, this.#locale, 'monthYear');
		this.#previous.disabled = !canGoBack;
	}
}

/**
 * The weekday names in a row (a 7-column grid), to go above a month's days.
 * @param {string[]} dayNames Short weekday names, Monday first.
 * @param {string} className The owner's class, e.g. 'calendar-weekdays'.
 */
export function weekdayRow(dayNames, className) {
	return h('div', { className: `weekday-row ${className}` }, ...dayNames.map((name) => h('div', { text: name })));
}

function arrow(icon, ariaLabel, onTap) {
	return new IconButton({ icon, small: true, ariaLabel, onTap });
}
