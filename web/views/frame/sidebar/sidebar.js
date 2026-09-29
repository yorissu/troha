
/**
 * Sidebar: today's date, the progress bar, the clock, and the settings buttons under it.
 *
 * Easter egg: tapping the big day number a few times in quick succession
 * (config.playful) flips it over and tickles the habit cards (onTickle). Each tap
 * on the way there jiggles it, a little more every time, so something's clearly up.
 * While it flips, taps on it are ignored, so nothing cuts the spin short.
 */

import { h, lockUntilAnimationEnds, replayAnimation } from '../../../core/dom.js';
import { clockText, formatDate } from '../../../core/dates.js';
import { QuickTaps } from '../../../core/taps.js';
import { Component } from '../../base/component/component.js';

const DAY_ANIMATIONS = ['cheer', 'flip', 'nudge', 'sunrise'];

export class Sidebar extends Component {
	#locale;
	#weekday = h('div', { className: 'weekday' });
	#dayNumber = h('div', { className: 'day-number' });
	#month = h('div', { className: 'month' });
	#year = h('div', { className: 'year' });
	#progressLabel = h('div', { className: 'progress-label' });
	#progressFill = h('div', { className: 'progress-fill' });
	#clock = h('div', { className: 'clock' });
	#onTickle;
	#tickleTaps;
	#taps;

	/**
	 * @param {object} options
	 * @param {string} options.locale
	 * @param {import('../../base/component/component.js').Component[]} options.buttons Shown under the clock.
	 * @param {{tickleTaps: number, tickleGapMs: number}} options.playful How many quick taps tickle.
	 * @param {() => void} options.onTickle The day number was tapped that many times.
	 */
	constructor({ locale, buttons, playful, onTickle }) {
		super(h('aside', { className: 'sidebar' }));
		this.#locale = locale;
		this.#tickleTaps = playful.tickleTaps;
		this.#taps = new QuickTaps(playful.tickleGapMs);
		this.#onTickle = onTickle;
		this.#dayNumber.addEventListener('click', () => this.#tapDayNumber());
		this.element.append(
			this.#weekday, this.#dayNumber, this.#month, this.#year,
			h('div', { className: 'sidebar-bottom' },
				this.#progressLabel,
				h('div', { className: 'progress' }, this.#progressFill),
				this.#clock,
				h('div', { className: 'clock-buttons' }, ...buttons.map((button) => button.element))));
	}

	/** The big day number, and the clock (the tour points them out). */
	get dayNumber() {
		return this.#dayNumber;
	}

	get clock() {
		return this.#clock;
	}

	/** @param {Date} date */
	showDate(date) {
		this.#weekday.textContent = formatDate(date, this.#locale, 'weekday');
		this.#dayNumber.textContent = date.getDate();
		this.#month.textContent = formatDate(date, this.#locale, 'month');
		this.#year.textContent = date.getFullYear();
	}

	/** "3 of 12 done" and the bar. `bump` plays a little bounce on the text. */
	showProgress(done, total, { bump = false } = {}) {
		this.#progressLabel.textContent = total ? `${done} of ${total} done` : 'Nothing planned today';
		this.#progressFill.style.setProperty('--share', total ? done / total : 0);
		if (bump) replayAnimation(this.#progressLabel, 'bump');
	}

	/** @param {Date} now */
	showTime(now) {
		this.#clock.textContent = clockText(now);
	}

	/** A happy bounce of the day number (celebration). */
	cheer() {
		replayAnimation(this.#dayNumber, 'cheer', DAY_ANIMATIONS);
	}

	/** The early bird's celebration: the day number comes up like the sun, glowing, and bounces. */
	sunrise() {
		replayAnimation(this.#dayNumber, 'sunrise', DAY_ANIMATIONS);
	}

	/** Make a wish: the clock twinkles. */
	shimmerClock() {
		replayAnimation(this.#clock, 'shimmer');
	}

	/** Counts quick taps on the day number; enough of them flip it and tickle the cards. */
	#tapDayNumber() {
		if (this.#dayNumber.classList.contains('busy')) return; // still flipping: let it finish
		const taps = this.#taps.tap();
		if (taps < this.#tickleTaps) {
			this.#dayNumber.style.setProperty('--nudge', taps / this.#tickleTaps); // grows with each tap
			replayAnimation(this.#dayNumber, 'nudge', DAY_ANIMATIONS);
			return;
		}
		this.#taps.reset();
		replayAnimation(this.#dayNumber, 'flip', DAY_ANIMATIONS);
		lockUntilAnimationEnds(this.#dayNumber); // taps wait until the flip is done
		this.#onTickle();
	}
}
