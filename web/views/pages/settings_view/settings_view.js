
/**
 * Settings view. Changes apply right away (there is no Save button).
 *
 *   Data file      the file the habits and settings are kept in (in the data folder);
 *                  tap it to switch to another or start a new one
 *   Night and sleep   side by side: the night (the Auto theme turns dark),
 *                       and within it the sleep time (Auto brightness dims, and
 *                       the Auto screen goes off when idle)
 *   Date and time  the device's date and time, always on show: tap either to set it
 *                  by hand, or get both from the network
 *   Motion         Bouncy (animations) or Calm (none)
 *
 * The buttons open the clock, calendar and file pop-ups (via the controller).
 */

import { h } from '../../../core/dom.js';
import { clockText, formatDate } from '../../../core/dates.js';
import { Component } from '../../base/component/component.js';
import { Button } from '../../base/button/button.js';
import { PickButton } from '../../controls/pick_button/pick_button.js';
import { PillRow } from '../../controls/pill_row/pill_row.js';

const NETWORK_LABEL = 'Get from the network';

export class SettingsView extends Component {
	#locale;
	#rangeButtons = {}; // 'nightTime' / 'sleepTime' -> { from, until } time buttons
	#networkButton;
	#clockNote = h('p', { className: 'note', hidden: true });
	#dateButton;
	#timeButton;
	#fileButton;
	#motionPills = new PillRow();
	#motionChoices;
	#onPickMotion;

	/**
	 * @param {object} options
	 * @param {string} options.locale
	 * @param {(range: 'nightTime'|'sleepTime', which: 'from'|'until', element: HTMLElement) => void} options.onPickRangeTime
	 * @param {(element: HTMLElement) => void} options.onSyncClock "Get from the network" tapped.
	 * @param {(element: HTMLElement) => void} options.onPickDate Setting the date by hand.
	 * @param {(element: HTMLElement) => void} options.onPickTime Setting the time by hand.
	 * @param {(element: HTMLElement) => void} options.onPickFile The data file tapped.
	 * @param {{order: string[], labels: Object<string, string>}} options.motionChoices The Motion choices, in order.
	 * @param {(choice: string) => void} options.onPickMotion A Motion choice tapped.
	 */
	constructor({ locale, onPickRangeTime, onSyncClock, onPickDate, onPickTime, onPickFile, motionChoices, onPickMotion }) {
		super(h('section', { className: 'view settings-view scroll-area', hidden: true }));
		this.#locale = locale;
		this.#motionChoices = motionChoices;
		this.#onPickMotion = onPickMotion;
		const timeButton = (onTap) => new PickButton({ icon: 'clock', onTap });
		const rangePart = (range, title, note) => {
			const from = timeButton((element) => onPickRangeTime(range, 'from', element));
			const until = timeButton((element) => onPickRangeTime(range, 'until', element));
			this.#rangeButtons[range] = { from, until };
			return h('div', { className: 'settings-part' },
				h('h3', { text: title }),
				h('div', { className: 'settings-row' },
					h('span', { className: 'settings-word', text: 'From' }), from.element,
					h('span', { className: 'settings-word', text: 'until' }), until.element),
				h('p', { className: 'note', text: note }));
		};
		this.#networkButton = new Button({ className: 'button', label: NETWORK_LABEL, onTap: onSyncClock });
		this.#dateButton = new PickButton({ icon: 'calendar', onTap: onPickDate });
		this.#timeButton = timeButton(onPickTime);
		this.#fileButton = new PickButton({ icon: 'file', onTap: onPickFile });

		this.element.append(
			h('div', { className: 'settings-section' },
				h('h2', { text: 'Data file' }),
				h('div', { className: 'settings-row' }, this.#fileButton.element),
				h('p', { className: 'note', text: 'Your habits, ticks and settings are kept in this file. Tap it to switch to another file or start a new one.' })),
			h('div', { className: 'settings-section' },
				h('h2', { text: 'Night and sleep' }),
				h('div', { className: 'settings-parts' },
					rangePart('nightTime', 'Night', 'The Auto theme turns dark.'),
					rangePart('sleepTime', 'Sleep', 'Within the night. Auto brightness dims, and the Auto screen goes off when idle.'))),
			h('div', { className: 'settings-section' },
				h('h2', { text: 'Date and time' }),
				h('div', { className: 'settings-row' },
					this.#dateButton.element, this.#timeButton.element, h('span', { className: 'spacer' }), this.#networkButton.element),
				h('p', { className: 'note', text: 'Tap the date or the time to set it yourself, or get both from the network.' }),
				this.#clockNote),
			h('div', { className: 'settings-section' },
				h('h2', { text: 'Motion' }),
				this.#motionPills.element,
				h('p', { className: 'note', text: 'Bouncy: things pop, bounce and slide. Calm: they just appear, with no movement.' })));
		[...this.element.children].forEach((section, i) => section.style.setProperty('--i', i)); // the order they rise in
	}

	/** @param {{nightTime: {from: string, until: string}, sleepTime: {from: string, until: string}}} settings */
	showTimeRanges(settings) {
		for (const [range, { from, until }] of Object.entries(this.#rangeButtons)) {
			from.setLabel(settings[range].from);
			until.setLabel(settings[range].until);
		}
	}

	/** The device's date and time, on the date and time buttons. @param {Date} now */
	showNow(now) {
		this.#dateButton.setLabel(formatDate(now, this.#locale, 'full'));
		this.#timeButton.setLabel(clockText(now));
	}

	/** The Motion choices, the one in use filled. */
	showMotion(choice) {
		const { order, labels } = this.#motionChoices;
		this.#motionPills.show(order.map((name) => ({
			label: labels[name],
			selected: name === choice,
			onTap: () => this.#onPickMotion(name),
		})));
	}

	/** The data file in use, e.g. "habits". */
	showFile(name) {
		this.#fileButton.setLabel(name);
	}

	/** While asking the network: the button waits and says so. */
	setClockBusy(busy) {
		this.#networkButton.disabled = busy;
		this.#networkButton.setLabel(busy ? 'Asking the network…' : NETWORK_LABEL);
	}

	/** A short message under the date and time (or none). */
	showClockNote(text) {
		this.#clockNote.textContent = text ?? '';
		this.#clockNote.hidden = !text;
	}
}
