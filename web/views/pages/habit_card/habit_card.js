
/**
 * Habit card on the Today view.
 *
 * Shows a habit's name and schedule; done cards get an outline and a check that
 * draws itself in. A hidden (private, logged out) card shows a blank bar and a lock.
 */

import { h, icon, replayAnimation, lockUntilAnimationEnds } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

const CONCEAL_MS = 280; // length of the .concealing blur, before the bar slides in
const CARD_ANIMATIONS = ['just-done', 'just-undone', 'cheer', 'just-revealed', 'tickled'];

export class HabitCard extends Component {
	#concealTimer = null;

	/**
	 * @param {object} options
	 * @param {string} options.id Habit id.
	 * @param {string} options.colorClass e.g. "c-mint".
	 * @param {number} options.index Position, for the staggered pop-in.
	 * @param {(card: HabitCard) => void} options.onTap
	 */
	constructor({ id, colorClass, index, onTap }) {
		super(h('button', {
			className: `card ${colorClass} squish`,
			type: 'button',
			dataset: { id },
			style: { '--delay': `${index * 40}ms` },
			on: { click: () => onTap(this) },
		}));
		this.id = id;
	}

	/** True while the last tap's animation is still playing (taps are ignored). */
	get busy() {
		return this.element.classList.contains('busy');
	}

	get done() {
		return this.element.classList.contains('done');
	}

	/**
	 * Sets the contents.
	 * @param {{name: string, schedule: string, hidden: boolean}} content
	 */
	fill({ name, schedule, hidden }) {
		clearTimeout(this.#concealTimer); // a newer fill wins over a conceal still waiting
		this.element.classList.toggle('censored', hidden);
		this.element.classList.remove('concealing');
		this.element.setAttribute('aria-label', hidden ? 'Private habit' : name);
		this.element.replaceChildren(
			hidden ? h('span', { className: 'redacted' }) : h('span', { className: 'card-name', text: name }),
			h('span', { className: 'card-schedule', text: schedule }),
			icon('check', 'check'),
		);
		if (hidden) this.element.append(icon('lock', 'lock'));
	}

	setDone(done) {
		this.element.classList.toggle('done', done);
		this.element.setAttribute('aria-pressed', String(done));
	}

	/** The tap wiggle (one way for done, the other for undone); taps wait until it ends. */
	playToggle() {
		replayAnimation(this.element, this.done ? 'just-done' : 'just-undone', CARD_ANIMATIONS);
		lockUntilAnimationEnds(this.element);
	}

	/** Shows the name with a little pop as it un-blurs (after logging in). */
	reveal(content) {
		this.fill(content);
		replayAnimation(this.element, 'just-revealed', CARD_ANIMATIONS);
	}

	/** Blurs the name away, then slides the blank bar in (after logging out). */
	conceal(content) {
		clearTimeout(this.#concealTimer);
		this.element.classList.add('concealing');
		this.#concealTimer = setTimeout(() => this.fill(content), CONCEAL_MS);
	}

	/** A hop, as part of the celebration wave. */
	cheer() {
		replayAnimation(this.element, 'cheer', CARD_ANIMATIONS);
	}

	/** A giggly jiggle (the day-number easter egg), starting after `delayMs`. */
	tickle(delayMs) {
		this.element.style.setProperty('--tickle-delay', `${delayMs}ms`);
		replayAnimation(this.element, 'tickled', CARD_ANIMATIONS);
	}
}
