
/**
 * Date picker: a month calendar in a pop-up, for choosing a habit's start date.
 */

import { h } from '../../../core/dom.js';
import { addDays, firstOfMonth, fromKey, mondayOf, shiftMonth, toKey } from '../../../core/dates.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';
import { MonthBar, weekdayRow } from '../../controls/month_bar/month_bar.js';

export class DatePicker extends Sheet {
	#monthBar;
	#grid = h('div', { className: 'picker-grid' });
	#month = null;
	#request = null;

	/**
	 * @param {import('../../base/sheet/sheet.js').SheetHost} host
	 * @param {{locale: string, dayNames: string[]}} options
	 */
	constructor(host, { locale, dayNames }) {
		super(host, { className: 'sheet-date' });
		this.#monthBar = new MonthBar({ locale, className: 'picker-bar', onShift: (step) => this.#shift(step) });
		const today = new Button({ className: 'button', label: 'Today', onTap: () => this.#pick(this.#request.today) });
		const cancel = new Button({ className: 'button', label: 'Cancel', onTap: () => this.#cancel() });
		this.element.append(
			this.#monthBar.element,
			weekdayRow(dayNames, 'picker-weekdays'),
			this.#grid,
			h('div', { className: 'sheet-actions' }, today.element, h('span', { className: 'spacer' }), cancel.element));
	}

	/**
	 * Opens the picker.
	 * @param {object} request
	 * @param {string} request.value The chosen day key.
	 * @param {string} request.earliest The earliest day that may be chosen.
	 * @param {string} request.today
	 * @param {Element} [request.origin]
	 * @param {(day: string) => void} request.onPick
	 * @param {() => void} request.onCancel
	 */
	pick(request) {
		this.#request = request;
		this.#month = firstOfMonth(fromKey(request.value));
		this.#render();
		this.open(request.origin);
	}

	onOutsideTap() {
		this.#cancel();
	}

	#render() {
		const { value, earliest, today } = this.#request;
		const month = this.#month;
		this.#monthBar.show(month, { canGoBack: month > firstOfMonth(fromKey(earliest)) });

		// Always 6 weeks, so the pop-up keeps its size from month to month.
		const firstCell = mondayOf(month);
		this.#grid.replaceChildren(...Array.from({ length: 42 }, (_, i) => {
			const date = addDays(firstCell, i);
			const key = toKey(date);
			const day = h('button', {
				className: 'picker-day squish',
				type: 'button',
				text: String(date.getDate()),
				disabled: key < earliest,
				on: { click: () => this.#pick(key) },
			});
			day.classList.toggle('outside', date.getMonth() !== month.getMonth());
			day.classList.toggle('today', key === today);
			day.classList.toggle('selected', key === value);
			return day;
		}));
	}

	#shift(step) {
		this.#month = shiftMonth(this.#month, step);
		this.#render();
	}

	#pick(day) {
		const { earliest, onPick } = this.#request;
		onPick(day < earliest ? earliest : day);
	}

	#cancel() {
		this.#request.onCancel();
	}
}
