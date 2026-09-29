
/**
 * Habit editor: adds a new habit, or edits one (changes apply as you make them).
 *
 * Fields: name, days, repeat, privacy, start date and colour. It only collects
 * choices; the controller decides what happens with them (via the callbacks).
 */

import { clearInvalid, h, markInvalid } from '../../../core/dom.js';
import { formatDate, fromKey, isoWeekday } from '../../../core/dates.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';
import { PickButton } from '../../controls/pick_button/pick_button.js';
import { PillRow } from '../../controls/pill_row/pill_row.js';
import { TextField } from '../../controls/text_field/text_field.js';

const NAME_PLACEHOLDER = 'Water the plants';
const NAME_MISSING = 'Give the habit a name';

export class HabitEditor extends Sheet {
	#options;
	#habit = null; // the habit being edited, or null when adding
	#nameBefore = ''; // the name before the field was last tapped into (put back if closed with it erased)
	#draft = null; // choices so far: { days: Set, everyWeeks, startDate, earliestStart, private, color }

	#heading = h('h2');
	#name;
	#dayPills = new PillRow();
	#repeatPills = new PillRow();
	#privacyPills = new PillRow();
	#startButton;
	#swatches = h('div', { className: 'swatch-row' });
	#deleteButton;
	#closeButton;
	#addButton;

	/**
	 * @param {import('../../base/sheet/sheet.js').SheetHost} host
	 * @param {object} options
	 * @param {string} options.locale
	 * @param {string[]} options.dayNames Short weekday names, Monday first.
	 * @param {string[]} options.colors Habit colour names.
	 * @param {number[]} options.repeatChoices "Every N weeks" choices.
	 * @param {number} options.nameMaxLength
	 * @param {import('../../overlays/on_screen_keyboard/on_screen_keyboard.js').OnScreenKeyboard} options.keyboard
	 * @param {import('../date_picker/date_picker.js').DatePicker} options.datePicker
	 * @param {() => string} options.today Today's day key.
	 * @param {() => boolean} options.canChoosePrivate True if Private may be chosen right now (logged in).
	 * @param {(fields: object) => void} options.onAdd
	 * @param {(habit: object, fields: object) => void} options.onChange
	 * @param {(habit: object, element: HTMLElement) => void} options.onDelete
	 * @param {(element: HTMLElement) => void} options.onNeedLogin Private was tapped while logged out.
	 */
	constructor(host, options) {
		super(host, { className: 'editor-sheet', onSubmit: () => this.#submit() });
		this.#options = options;

		this.#name = new TextField({
			keyboard: options.keyboard,
			id: 'habit-name',
			maxLength: options.nameMaxLength,
			placeholder: NAME_PLACEHOLDER,
			onInput: () => { this.#clearInvalid(); this.#applyEdit(); },
			onFocus: () => { if (this.#name.value.trim()) this.#nameBefore = this.#name.value; },
		});

		this.#startButton = new PickButton({ icon: 'calendar', onTap: () => this.#pickStart() });
		this.#deleteButton = new Button({
			className: 'button danger',
			label: 'Delete',
			onTap: (element) => this.#options.onDelete(this.#habit, element),
		});
		this.#closeButton = new Button({ className: 'button', label: 'Cancel', onTap: () => this.close() });
		this.#addButton = new Button({ className: 'button primary', label: 'Add', type: 'submit' });

		this.element.append(
			this.#heading,
			h('label', { className: 'field-label', htmlFor: 'habit-name', text: 'Name' }),
			this.#name.element,
			h('div', { className: 'field-label', text: 'Days' }),
			this.#dayPills.element,
			h('div', { className: 'field-label', text: 'Repeat' }),
			this.#repeatPills.element,
			h('div', { className: 'field-pair' },
				h('div', {}, h('div', { className: 'field-label', text: 'Privacy' }), this.#privacyPills.element),
				h('div', {}, h('div', { className: 'field-label', text: 'Starts' }), this.#startButton.element)),
			h('div', { className: 'field-label', text: 'Colour' }),
			this.#swatches,
			h('div', { className: 'sheet-actions' },
				this.#deleteButton.element, h('span', { className: 'spacer' }), this.#closeButton.element, this.#addButton.element));
	}

	/**
	 * Opens the editor.
	 * @param {object|null} habit The habit to edit, or null to add a new one.
	 * @param {object} options
	 * @param {string} [options.name] The habit's name to show (edit only).
	 * @param {number} [options.colorIndex] Suggested colour for a new habit.
	 * @param {Element} [options.origin]
	 */
	edit(habit, { name = '', colorIndex = 0, origin } = {}) {
		const today = this.#options.today();
		const colors = this.#options.colors;
		this.#habit = habit;
		this.#draft = habit
			? {
				days: new Set(habit.days),
				everyWeeks: habit.everyWeeks,
				startDate: habit.startDate,
				earliestStart: habit.startDate < today ? habit.startDate : today,
				private: habit.private,
				color: colors.includes(habit.color) ? habit.color : colors[0],
			}
			: {
				days: new Set([isoWeekday(fromKey(today))]),
				everyWeeks: 1,
				startDate: today,
				earliestStart: today,
				private: false,
				color: colors[colorIndex % colors.length],
			};

		// Adding needs an "Add" button; when editing, every change applies right away.
		this.#heading.textContent = habit ? 'Edit habit' : 'New habit';
		this.#name.value = habit ? name : '';
		this.#nameBefore = this.#name.value;
		this.#deleteButton.hidden = !habit;
		this.#addButton.hidden = Boolean(habit);
		this.#closeButton.setLabel(habit ? 'Done' : 'Cancel');
		this.#closeButton.element.classList.toggle('primary', Boolean(habit));
		this.#clearInvalid();
		this.#renderChoices();
		this.open(origin); // no focus: the keyboard appears only when the name field is tapped
	}

	/** Comes back to the editor as it was (after the date picker, a question or the PIN pad). */
	reopen(origin) {
		this.#renderChoices();
		this.open(origin);
	}

	/** Selects Private (after logging in) and comes back to the editor. */
	choosePrivate(origin) {
		this.#draft.private = true;
		this.reopen(origin);
		this.#applyEdit();
	}

	onHide() {
		this.#options.keyboard.hide();
		// Edits apply as you type, so erasing a name letter by letter saved each shorter
		// version; closing with the name erased puts back the name from before the erasing.
		if (this.#habit && !this.#name.value.trim()) {
			this.#name.value = this.#nameBefore;
			this.#clearInvalid();
			this.#applyEdit();
		}
	}

	#renderChoices() {
		const draft = this.#draft;
		const { dayNames, repeatChoices, colors, locale } = this.#options;

		this.#dayPills.show([
			...dayNames.map((name, i) => this.#choice(name, draft.days.has(i + 1), () => {
				if (draft.days.has(i + 1)) draft.days.delete(i + 1);
				else draft.days.add(i + 1);
			})),
			this.#choice('Every day', draft.days.size === 7, () => { draft.days = new Set([1, 2, 3, 4, 5, 6, 7]); }),
		]);

		this.#repeatPills.show(repeatChoices.map((weeks) =>
			this.#choice(weeks === 1 ? 'Every week' : `Every ${weeks} weeks`, draft.everyWeeks === weeks, () => {
				draft.everyWeeks = weeks;
			})));

		this.#privacyPills.show([
			this.#choice('Public', !draft.private, () => { draft.private = false; }),
			this.#choice('Private', draft.private, () => {
				if (this.#options.canChoosePrivate()) draft.private = true;
				else this.#options.onNeedLogin(this.#privacyPills.element);
			}),
		]);

		this.#startButton.setLabel(formatDate(fromKey(draft.startDate), locale, 'full'));

		this.#swatches.replaceChildren(...colors.map((color) => h('button', {
			className: `swatch c-${color} squish${draft.color === color ? ' selected' : ''}`,
			type: 'button',
			attrs: { 'aria-label': color },
			on: { click: () => { draft.color = color; this.#changed(); } },
		})));
	}

	/** A choice pill for a PillRow; tapping runs `onTap`, then refreshes and applies. */
	#choice(label, selected, onTap) {
		return { label, selected, onTap: () => { onTap(); this.#changed(); } };
	}

	#changed() {
		this.#clearInvalid();
		this.#renderChoices();
		this.#applyEdit();
	}

	#pickStart() {
		const draft = this.#draft;
		const origin = this.#startButton.element;
		this.#options.datePicker.pick({
			value: draft.startDate,
			earliest: draft.earliestStart,
			today: this.#options.today(),
			origin,
			onPick: (day) => {
				draft.startDate = day;
				this.reopen(origin);
				this.#applyEdit();
			},
			onCancel: () => this.reopen(origin),
		});
	}

	/** The choices as habit fields, or null (with the missing part marked) if something is missing. */
	#fields() {
		const draft = this.#draft;
		const name = this.#name.value.trim();
		if (!name) {
			this.#name.markInvalid(NAME_MISSING);
			return null;
		}
		if (draft.days.size === 0) return markInvalid(this.#dayPills.element);
		return {
			name,
			days: [...draft.days].sort((a, b) => a - b),
			everyWeeks: draft.everyWeeks,
			startDate: draft.startDate,
			private: draft.private,
			color: draft.color,
		};
	}

	/** Clears the red marks of a missing name or days (see markInvalid in core/dom.js). */
	#clearInvalid() {
		this.#name.clearMarks();
		clearInvalid(this.#dayPills.element);
	}

	/** Editing: every valid change applies right away. */
	#applyEdit() {
		if (!this.#habit) return;
		const fields = this.#fields();
		if (fields) this.#options.onChange(this.#habit, fields);
	}

	#submit() {
		if (this.#habit) {
			this.close(); // Enter while editing just closes
			return;
		}
		const fields = this.#fields();
		if (fields) this.#options.onAdd(fields);
	}
}
