
/**
 * Server-down pop-up: covers everything while the server isn't answering, so
 * nothing can be changed. It can't be closed: it goes when the server answers
 * again and the page reloads (see ServerController). It looks like the other
 * pop-ups (sheet.css) but has its own overlay, above all of them.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class ServerDown extends Component {
	constructor() {
		super(h('div', {
			className: 'overlay server-down',
			hidden: true,
			attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'server-down-title' },
		}));
		const sheet = h('div', { className: 'sheet sheet-small' },
			h('h2', { text: "Troha's server is down", attrs: { id: 'server-down-title' } }),
			h('p', {
				className: 'note',
				text: "Changes can't be saved, so the last one was undone, and nothing can be changed for now.",
			}),
			h('p', { className: 'note', text: 'Waiting for the server to come back… This goes away by itself then.' }));
		[...sheet.children].forEach((child, i) => child.style.setProperty('--i', i)); // contents rise in one by one
		this.element.append(sheet);
	}

	show() {
		this.element.hidden = false;
	}
}
