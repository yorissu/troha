
/**
 * Timeout ring: turns an element's own border into a countdown. The border becomes
 * a faint track, and a line along it empties as time runs out, starting from the
 * top centre.
 *
 * Any button can have one (TimeoutButton does; so does the round Screen button).
 * It measures the element's real size and corner radius, so it fits any shape:
 * square, pill or round. The element's CSS sets the colour with --timeout-color.
 */

import { svg } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class TimeoutRing extends Component {
	#host;
	#path = svg('path', { class: 'timeout-fill', pathLength: '1' });

	/** @param {HTMLElement} host The element whose border becomes the countdown. */
	constructor(host) {
		super(svg('svg', { class: 'timeout-ring', hidden: '', 'aria-hidden': 'true' }));
		this.element.append(this.#path);
		this.#host = host;
		host.classList.add('has-timeout-ring');
		host.append(this.element);
		new ResizeObserver(() => this.#fit()).observe(host);
	}

	/**
	 * The countdown: 1 = full, 0 = empty. `null` hides it.
	 * @param {number|null} fraction
	 */
	setTimeLeft(fraction) {
		this.element.toggleAttribute('hidden', fraction === null); // an SVG element has no .hidden
		this.#host.classList.toggle('timing', fraction !== null);
		if (fraction === null) return;
		// Set on the path itself: Chrome doesn't redraw it when an inherited variable changes.
		this.#path.style.strokeDashoffset = (1 - fraction).toFixed(4);
	}

	/** Draws the line exactly on the border: a rounded rectangle starting at the top centre. */
	#fit() {
		const width = this.#host.offsetWidth;
		const height = this.#host.offsetHeight;
		if (!width || !height) return;
		const style = getComputedStyle(this.#host);
		const border = parseFloat(style.borderTopWidth) || 1;
		const half = border / 2;
		const corner = style.borderTopLeftRadius;
		const cornerPx = corner.endsWith('%') ? (parseFloat(corner) / 100) * width : parseFloat(corner) || 0;
		const radius = Math.max(0, Math.min(cornerPx, width / 2, height / 2) - half);
		const [left, top, right, bottom] = [half, half, width - half, height - half];

		this.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
		Object.assign(this.element.style, { top: `${-border}px`, left: `${-border}px`, width: `${width}px`, height: `${height}px` });
		this.#path.style.strokeWidth = `${border}`;
		this.#path.setAttribute('d', [
			`M${width / 2} ${top}`,
			`H${right - radius}`, `A${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
			`V${bottom - radius}`, `A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
			`H${left + radius}`, `A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
			`V${top + radius}`, `A${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
			'Z',
		].join(' '));
	}
}
