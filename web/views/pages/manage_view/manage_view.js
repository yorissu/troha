
/**
 * Manage view: every habit as a card, in a grid like Today's; tapping a card opens
 * it for editing. Each card shows the habit's name, its week (a bar per weekday,
 * filled on the days it's on), and small tags for anything out of the ordinary
 * (e.g. "every 2 weeks", "starts tomorrow", "private").
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class ManageView extends Component {
	#dayLetters;
	#onCardTap;
	#grid = h('div', { className: 'manage-grid scroll-area' });
	#empty = h('p', { className: 'empty', hidden: true });

	/**
	 * @param {object} options
	 * @param {string[]} options.dayLetters Weekday initials, Monday first (under the week bars).
	 * @param {(id: string, card: HTMLElement) => void} options.onCardTap
	 */
	constructor({ dayLetters, onCardTap }) {
		super(h('section', { className: 'view manage-view' }));
		this.#dayLetters = dayLetters;
		this.#onCardTap = onCardTap;
		this.element.append(this.#grid, this.#empty);
	}

	/**
	 * @param {Array<{id: string, colorClass: string, name: string, hidden: boolean, schedule: string,
	 *   days: number[], tags: string[]}>} items days: ISO weekdays (1 = Monday); schedule: the same as text.
	 * @param {string} emptyMessage Shown when there are no items.
	 */
	render(items, emptyMessage) {
		this.#grid.replaceChildren(...items.map((item, index) => {
			const card = h('button', {
				className: `manage-card ${item.colorClass} squish`,
				type: 'button',
				style: { '--delay': `${index * 30}ms` },
				attrs: { 'aria-label': [item.hidden ? 'Private habit' : item.name, item.schedule, ...item.tags].join(', ') },
				on: { click: () => this.#onCardTap(item.id, card) },
			},
			item.hidden ? h('span', { className: 'redacted' }) : h('span', { className: 'manage-name', text: item.name }),
			item.tags.length ? h('span', { className: 'manage-tags' }, ...item.tags.map((tag) => h('span', { className: 'manage-tag', text: tag }))) : null,
			this.#weekStrip(item.days));
			return card;
		}));
		this.#grid.hidden = items.length === 0;
		this.#empty.hidden = items.length > 0;
		this.#empty.textContent = emptyMessage;
	}

	/** A bar per weekday, Monday first, filled on the habit's days; its initial under each. */
	#weekStrip(days) {
		return h('span', { className: 'week-strip', attrs: { 'aria-hidden': 'true' } },
			...this.#dayLetters.map((letter, i) => h('span', { className: days.includes(i + 1) ? 'week-day on' : 'week-day' },
				h('span', { className: 'week-bar' }),
				letter)));
	}
}
