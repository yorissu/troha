
/**
 * Today view: a grid of habit cards that always fits the screen.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';
import { HabitCard } from '../habit_card/habit_card.js';

export class TodayView extends Component {
	#layout;
	#onCardTap;
	#grid = h('div', { className: 'habit-grid' });
	#empty = h('p', { className: 'empty', hidden: true });
	#cards = new Map(); // habit id -> HabitCard

	/**
	 * @param {object} options
	 * @param {{threeColumnLimit: number, minRows: number}} options.layout
	 * @param {(card: HabitCard) => void} options.onCardTap
	 */
	constructor({ layout, onCardTap }) {
		super(h('section', { className: 'view today-view' }));
		this.#layout = layout;
		this.#onCardTap = onCardTap;
		this.element.append(this.#grid, this.#empty);
	}

	/**
	 * Rebuilds the grid.
	 * @param {Array<{id: string, colorClass: string, name: string, schedule: string, hidden: boolean, done: boolean}>} items
	 * @param {string} emptyMessage Shown when there are no items.
	 */
	render(items, emptyMessage) {
		const columns = items.length > this.#layout.threeColumnLimit ? 4 : 3;
		this.#grid.style.setProperty('--cols', columns);
		this.#grid.style.setProperty('--rows', Math.max(this.#layout.minRows, Math.ceil(items.length / columns)));

		this.#cards.clear();
		this.#grid.replaceChildren(...items.map((item, index) => {
			const card = new HabitCard({ id: item.id, colorClass: item.colorClass, index, onTap: this.#onCardTap });
			card.fill(item);
			card.setDone(item.done);
			this.#cards.set(item.id, card);
			return card.element;
		}));

		this.#grid.hidden = items.length === 0;
		this.#empty.hidden = items.length > 0;
		this.#empty.textContent = emptyMessage;
	}

	/** All cards on screen. */
	get cards() {
		return [...this.#cards.values()];
	}

	/** The celebration wave: every card hops, one after another. */
	cheer() {
		for (const card of this.#cards.values()) card.cheer();
	}

	/** Easter egg: every card giggles, each starting at a slightly different moment. */
	tickle() {
		for (const card of this.#cards.values()) card.tickle(Math.round(Math.random() * 160));
	}
}
