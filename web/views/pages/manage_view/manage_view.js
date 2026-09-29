
/**
 * Manage view: every habit as a row; tapping a row opens it for editing.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class ManageView extends Component {
	#onRowTap;
	#list = h('div', { className: 'manage-list scroll-area' });
	#empty = h('p', { className: 'empty', text: 'No habits yet. Tap + to add your first one.', hidden: true });

	/** @param {{onRowTap: (id: string, row: HTMLElement) => void}} options */
	constructor({ onRowTap }) {
		super(h('section', { className: 'view manage-view' }));
		this.#onRowTap = onRowTap;
		this.element.append(this.#list, this.#empty);
	}

	/** @param {Array<{id: string, colorClass: string, name: string, schedule: string, hidden: boolean}>} items */
	render(items) {
		this.#list.replaceChildren(...items.map((item, index) => {
			const row = h('button', {
				className: `manage-row ${item.colorClass} squish`,
				type: 'button',
				style: { '--delay': `${index * 30}ms` },
				on: { click: () => this.#onRowTap(item.id, row) },
			},
			item.hidden ? h('span', { className: 'redacted' }) : h('span', { className: 'manage-name', text: item.name }),
			h('span', { className: 'manage-schedule', text: item.schedule }));
			return row;
		}));
		this.#empty.hidden = items.length > 0;
	}
}
