
/**
 * Time picker: a clock pop-up. A round clock face (hours outside, minutes inside;
 * see ClockDial), the chosen time in big digits, and Cancel / Set.
 */

import { h } from '../../../core/dom.js';
import { pad } from '../../../core/dates.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';
import { ClockDial } from '../../controls/clock_dial/clock_dial.js';

export class TimePicker extends Sheet {
	#title = h('h2');
	#readout = h('span', { className: 'time-picker-readout' });
	#dial = new ClockDial({ onChange: () => this.#showReadout() });
	#request = null;

	/**
	 * @param {import('../../base/sheet/sheet.js').SheetHost} host
	 * @param {{minuteStep: number}} options Minutes snap to multiples of this (e.g. 5).
	 */
	constructor(host, { minuteStep }) {
		super(host, { className: 'time-picker' });
		this.#dial.minuteStep = minuteStep;
		const cancel = new Button({ className: 'button', label: 'Cancel', onTap: () => this.#cancel() });
		const set = new Button({ className: 'button primary', label: 'Set', onTap: () => this.#pick() });
		this.element.append(
			h('div', { className: 'time-picker-bar' }, this.#title, this.#readout),
			this.#dial.element,
			h('div', { className: 'sheet-actions' }, h('span', { className: 'spacer' }), cancel.element, set.element));
	}

	/**
	 * Opens the picker.
	 * @param {object} request
	 * @param {string} request.value The starting time, "HH:MM".
	 * @param {string} [request.title]
	 * @param {{from: string, until: string}} [request.limit] Only times in this range (both ends included).
	 * @param {Element} [request.origin]
	 * @param {(time: string) => void} request.onPick
	 * @param {() => void} [request.onCancel] Default: just close.
	 */
	pick(request) {
		this.#request = request;
		const [hour, minute] = request.value.split(':').map(Number);
		this.#dial.limit = request.limit ?? null;
		this.#dial.value = { hour, minute };
		this.#title.textContent = request.title ?? 'Set the time';
		this.#showReadout();
		this.open(request.origin);
	}

	onOutsideTap() {
		this.#cancel();
	}

	#time() {
		const { hour, minute } = this.#dial.value;
		return `${pad(hour)}:${pad(minute)}`;
	}

	#showReadout() {
		this.#readout.textContent = this.#time();
	}

	#pick() {
		this.#request?.onPick(this.#time());
	}

	#cancel() {
		if (this.#request?.onCancel) this.#request.onCancel();
		else this.close();
	}
}
