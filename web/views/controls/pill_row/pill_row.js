
/**
 * Pill row: a row of choice pills, the chosen ones filled. For one choice (e.g.
 * Settings -> Motion, or Repeat in the habit editor) or several at once (Days).
 * Its owner decides what a tap means, then shows the pills again.
 * (Styles: .pill-row and .pill in styles/controls.css.)
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class PillRow extends Component {
	constructor() {
		super(h('div', { className: 'pill-row' }));
	}

	/**
	 * Shows the pills.
	 * @param {Array<{label: string, selected: boolean, onTap: () => void}>} pills
	 */
	show(pills) {
		this.element.replaceChildren(...pills.map(({ label, selected, onTap }) => h('button', {
			className: `pill squish${selected ? ' selected' : ''}`,
			type: 'button',
			text: label,
			attrs: { 'aria-pressed': String(selected) },
			on: { click: onTap },
		})));
	}
}
