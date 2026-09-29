
/**
 * Header: the view title and the row of buttons (lock, views, add, settings).
 */

import { h, replayAnimation } from '../../../core/dom.js';
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
	#nav;

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
		this.#nav = h('nav', { className: 'nav' }, lockButton.element, ...buttonsOf(false), addButton.element, ...buttonsOf(true));
		this.element.append(this.#title, this.#nav);
	}

	/** The buttons in the row, left to right (the tour points them out). */
	get navButtons() {
		return [...this.#nav.children];
	}

	/** The button of view `id` ('today', 'calendar', 'manage' or 'settings'). */
	viewButton(id) {
		return this.#viewButtons.get(id).element;
	}

	/** The buttons pop one after another, left to right (the tour's flourish). */
	flare() {
		[...this.#nav.children].forEach((button, i) => {
			button.style.setProperty('--pop-delay', `${150 + i * 110}ms`);
			replayAnimation(button, 'tour-pop');
		});
	}

	/** Shows `view`'s title and highlights its button. */
	setView(view) {
		this.#title.textContent = VIEWS.find((v) => v.id === view).title;
		for (const [id, button] of this.#viewButtons) button.setActive(id === view);
	}
}
