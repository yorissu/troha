
/**
 * File picker: choose the data file in use, or name a new one.
 *
 * A name field on top, and the existing files below. Typing filters the list like
 * a fuzzy finder (matched letters are highlighted). Tapping a file uses it; its bin
 * button deletes it (not the one in use); Create makes a new file with the typed
 * name. An empty name, or one that's taken, is marked in the field itself (like a
 * habit without a name).
 */

import { clearInvalid, h, icon, markInvalid } from '../../../core/dom.js';
import { fuzzyFilter } from '../../../core/fuzzy.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';

const PLACEHOLDER = 'Search or name a new file';
const NAME_MISSING = 'Type a name first';

export class FilePicker extends Sheet {
	#keyboard;
	#cleanName;
	#name;
	#taken = h('span', { className: 'field-hint', text: 'Already exists: tap it below', hidden: true });
	#list = h('div', { className: 'file-list scroll-area' });
	#request = null;

	/**
	 * @param {import('../../base/sheet/sheet.js').SheetHost} host
	 * @param {object} options
	 * @param {import('../../overlays/on_screen_keyboard/on_screen_keyboard.js').OnScreenKeyboard} options.keyboard
	 * @param {{maxLength: number, clean: (text: string) => string}} options.fileName What a file may be called.
	 */
	constructor(host, { keyboard, fileName }) {
		super(host, { tag: 'form', className: 'file-picker' });
		this.#keyboard = keyboard;
		this.#cleanName = fileName.clean;
		this.element.autocomplete = 'off';
		this.element.addEventListener('submit', (event) => {
			event.preventDefault();
			this.#create();
		});

		this.#name = h('input', {
			className: 'text-input',
			maxLength: fileName.maxLength,
			placeholder: PLACEHOLDER,
			attrs: { inputmode: 'none', 'aria-label': 'File name' }, // the on-screen keyboard, not the system one
			on: { input: () => this.#typed() },
		});
		keyboard.attach(this.#name);

		const cancel = new Button({ className: 'button', label: 'Cancel', onTap: () => this.close() });
		const create = new Button({ className: 'button primary', label: 'Create', type: 'submit' });
		this.element.append(
			h('h2', { text: 'Data file' }),
			h('div', { className: 'field-with-hint' }, this.#name, this.#taken),
			h('p', { className: 'note', text: 'Tap a file to use it, or type a new name (a–z, 0–9, _ and -) and tap Create.' }),
			this.#list,
			h('div', { className: 'sheet-actions' }, h('span', { className: 'spacer' }), cancel.element, create.element));
	}

	/**
	 * Opens the picker.
	 * @param {object} request
	 * @param {string[]} request.files The existing files' names.
	 * @param {string} request.inUse
	 * @param {Element} [request.origin]
	 * @param {(name: string) => void} request.onUse A file was tapped.
	 * @param {(name: string) => void} request.onCreate Create was tapped with a new, valid name.
	 * @param {(name: string, element: HTMLElement) => void} request.onDelete A file's bin button was tapped.
	 */
	pick(request) {
		this.#request = request;
		this.#name.value = '';
		this.#clearMarks();
		this.#render();
		this.open(request.origin); // no focus: the keyboard appears only when the field is tapped
	}

	/**
	 * Comes back (e.g. after "Delete this file?") with a fresh list, keeping what was typed.
	 * @param {{files: string[], inUse: string}} listing
	 * @param {Element} [origin]
	 */
	reopen(listing, origin) {
		Object.assign(this.#request, listing);
		this.#render();
		this.open(origin);
	}

	/** The typed name is taken (e.g. the server said so): mark it. */
	markTaken() {
		this.#taken.hidden = false;
		markInvalid(this.#name);
	}

	onHide() {
		this.#keyboard.hide();
	}

	/** Keeps the name to what a file name may be (e.g. lowercase, spaces become _). */
	#typed() {
		const cleaned = this.#cleanName(this.#name.value);
		if (cleaned !== this.#name.value) this.#name.value = cleaned;
		this.#clearMarks();
		this.#render();
	}

	#render() {
		const { files, inUse } = this.#request;
		const matches = fuzzyFilter(this.#name.value, files);
		this.#list.replaceChildren(...matches.map(({ name, indexes }, index) => {
			const open = h('button', {
				className: 'file-open',
				type: 'button',
				on: { click: () => this.#request.onUse(name) },
			},
			h('span', { className: 'file-name' }, ...highlighted(name, indexes)),
			name === inUse ? h('span', { className: 'file-tag', text: 'In use' }) : null);
			// The file in use can't be deleted, so it has no bin.
			const remove = name === inUse ? null : h('button', {
				className: 'file-delete squish',
				type: 'button',
				attrs: { 'aria-label': `Delete ${name}` },
				on: { click: (event) => this.#request.onDelete(name, event.currentTarget) },
			}, icon('trash'));
			return h('div', {
				className: `file-row${name === inUse ? ' in-use' : ''}`,
				style: { '--delay': `${index * 25}ms` },
			}, open, remove);
		}));
		if (!matches.length) this.#list.append(h('p', { className: 'file-empty', text: 'No file with that name yet. Tap Create to make it.' }));
	}

	#create() {
		const name = this.#name.value;
		if (!name) {
			this.#name.placeholder = NAME_MISSING;
			markInvalid(this.#name);
			return;
		}
		if (this.#request.files.includes(name)) {
			this.markTaken();
			return;
		}
		this.#request.onCreate(name);
	}

	#clearMarks() {
		clearInvalid(this.#name);
		this.#taken.hidden = true;
		this.#name.placeholder = PLACEHOLDER;
	}
}

/** The name as text, with the matched letters in <mark>. */
function highlighted(name, indexes) {
	const matched = new Set(indexes);
	return [...name].map((letter, i) => (matched.has(i) ? h('mark', { text: letter }) : letter));
}
