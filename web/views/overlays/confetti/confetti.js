
/**
 * Confetti: pastel pieces that shoot up from the bottom and fall back down.
 */

import { h } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

export class Confetti extends Component {
	#colors;

	/** @param {{colors: string[]}} options Habit colour names (pieces use their outline colour). */
	constructor({ colors }) {
		super(h('div', { className: 'confetti', attrs: { 'aria-hidden': 'true' } }));
		this.#colors = colors;
	}

	burst(count = 80) {
		const { width, height } = this.element.getBoundingClientRect();
		for (let i = 0; i < count; i++) {
			const piece = h('span', {
				className: `confetti-piece c-${this.#colors[i % this.#colors.length]}${i % 3 === 0 ? ' round' : ''}`,
				style: { left: `${width * (0.25 + Math.random() * 0.72)}px`, top: `${height + 20}px` },
			});
			this.element.append(piece);

			const drift = (Math.random() - 0.5) * width * 0.3;
			const rise = -height * (0.5 + Math.random() * 0.45);
			const spin = (Math.random() - 0.5) * 1080;
			const flight = piece.animate([
				{ transform: 'translate(0, 0) rotate(0deg)', easing: 'cubic-bezier(.15, .75, .4, 1)' },
				{ transform: `translate(${drift * 0.6}px, ${rise}px) rotate(${spin / 2}deg)`, offset: 0.42, easing: 'cubic-bezier(.5, 0, .9, .6)' },
				{ transform: `translate(${drift}px, 60px) rotate(${spin}deg)` },
			], { duration: 2000 + Math.random() * 1200, delay: Math.random() * 300 });
			flight.onfinish = () => piece.remove();
		}
	}
}
