
/**
 * Header: the view title and the row of buttons (lock, views, add, settings).
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';
import { IconButton } from '../../controls/icon_button/icon_button.js';

/**
 * The views, in button order: the title shown, the button's spoken name and icon.
 * `afterAdd` puts the button after the + button. To add a view, add it here and
 * show it in controllers/app_controller.js (#showView).
 */
const VIEWS = [
	{ id: 'today', title: 'Today', label: 'Today', icon: 'today' },
	{ id: 'calendar', title: 'Calendar', label: 'Calendar', icon: 'calendar' },
	{ id: 'manage', title: 'Your habits', label: 'Manage habits', icon: 'manage' },
	{ id: 'settings', title: 'Settings', label: 'Settings', icon: 'settings', afterAdd: true },
];

export class Header extends Component {
	#title = h('h1', { className: 'title' });
	#viewButtons = new Map(); // view id -> IconButton

	/**
	 * @param {object} options
	 * @param {import('../../base/component/component.js').Component} options.lockButton
	 * @param {(view: string) => void} options.onNavigate
	 * @param {(element: HTMLElement) => void} options.onAdd
	 */
	constructor({ lockButton, onNavigate, onAdd }) {
		super(h('header', { className: 'header' }));
		for (const view of VIEWS) {
			this.#viewButtons.set(view.id, new IconButton({ icon: view.icon, ariaLabel: view.label, onTap: () => onNavigate(view.id) }));
		}
		const addButton = new IconButton({ icon: 'add', ariaLabel: 'Add habit', onTap: onAdd });
		const buttonsOf = (afterAdd) => VIEWS.filter((view) => Boolean(view.afterAdd) === afterAdd)
			.map((view) => this.#viewButtons.get(view.id).element);
		this.element.append(this.#title, h('nav', { className: 'nav' },
			lockButton.element, ...buttonsOf(false), addButton.element, ...buttonsOf(true)));
	}

	/** Shows `view`'s title and highlights its button. */
	setView(view) {
		this.#title.textContent = VIEWS.find((v) => v.id === view).title;
		for (const [id, button] of this.#viewButtons) button.setActive(id === view);
	}
}
