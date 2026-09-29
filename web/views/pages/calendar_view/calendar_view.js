
/**
 * Calendar view: a month of progress rings (done / total for each day) and the streak.
 *
 * Clear mode (the Clear button): days with counters jiggle, and tapping one reports
 * it through onDayTap so the controller can remove it.
 *
 * Easter eggs: an empty day tapped again and again gets offended: a wobble, then a
 * harder shake, then a little remark like "hey!". And a few quick taps on the month's
 * name send a wave across the days.
 */

import { h, replayAnimation, svg } from '../../../core/dom.js';
import { pickOne, plural } from '../../../core/text.js';
import { QuickTaps } from '../../../core/taps.js';
import { calendarDays, firstOfMonth, fromKey, isoWeekday, shiftMonth, toKey, weeksInMonth } from '../../../core/dates.js';
import { Component } from '../../base/component/component.js';
import { MonthBar, weekdayRow } from '../../controls/month_bar/month_bar.js';
import { ClearButton } from '../../controls/clear_button/clear_button.js';

const RING_RADIUS = 40;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const CLEAR_OUT_MS = 350; // length of the .cleared animation in calendar_view.css
const HEY_MS = 1600;      // length of the "hey!" (see calendar_view.css)
const WAVE_STEP_MS = 45;  // the wave reaches each next diagonal of days this much later
const DAY_ANIMATIONS = ['miffed', 'offended', 'wave'];

export class CalendarView extends Component {
	#source;
	#onDayTap;
	#playful;
	#heyRemarks;
	#month = null;
	#clearing = false;
	#monthBar;
	#streak = h('div', { className: 'streak' });
	#clearButton;
	#grid = h('div', { className: 'calendar-grid' });
	#offendedTaps; // quick taps on one empty day
	#monthTaps;    // quick taps on the month's name

	/**
	 * @param {object} options
	 * @param {string} options.locale
	 * @param {string[]} options.dayNames Short weekday names, Monday first.
	 * @param {object} options.source Where the data comes from:
	 * @param {() => string} options.source.today Today's day key.
	 * @param {(day: string) => ({total: number, done: string[]}|undefined)} options.source.entry
	 * @param {() => number} options.source.streak
	 * @param {(element: HTMLElement) => void} options.onClearTap The Clear button.
	 * @param {(day: string, cell: HTMLElement) => void} options.onDayTap A day with counters, tapped in clear mode.
	 * @param {{offendedGapMs: number, shakeFromTap: number, heyAtTap: number, waveTaps: number, waveGapMs: number}} options.playful
	 *   The easter eggs' tuning.
	 * @param {string[]} options.heyRemarks What the offended day says (one at random, like "hey!").
	 */
	constructor({ locale, dayNames, source, onClearTap, onDayTap, playful, heyRemarks }) {
		super(h('section', { className: 'view calendar-view' }));
		this.#source = source;
		this.#onDayTap = onDayTap;
		this.#playful = playful;
		this.#offendedTaps = new QuickTaps(playful.offendedGapMs);
		this.#monthTaps = new QuickTaps(playful.waveGapMs);
		this.#heyRemarks = heyRemarks;
		this.#clearButton = new ClearButton({ onTap: onClearTap });
		this.#monthBar = new MonthBar({
			locale,
			className: 'calendar-bar',
			onShift: (step) => this.#shift(step),
			onLabelTap: () => this.#tapMonthName(),
		});
		this.#monthBar.element.append(this.#streak, this.#clearButton.element);
		this.element.append(this.#monthBar.element, weekdayRow(dayNames, 'calendar-weekdays'), this.#grid);
	}

	/** Goes to the month that contains `day` (shown by the next render()). */
	goToMonthOf(day) {
		this.#month = firstOfMonth(fromKey(day));
	}

	render() {
		const today = this.#source.today();
		this.#month ??= firstOfMonth(fromKey(today));
		const month = this.#month;
		this.#monthBar.show(month);

		const weeks = weeksInMonth(month);
		this.#grid.style.setProperty('--weeks', weeks);

		this.#grid.replaceChildren(...calendarDays(month, weeks).map((date, i) => {
			const key = toKey(date);
			const entry = this.#source.entry(key);
			const hasHabits = key <= today && entry?.total > 0;
			const done = hasHabits ? Math.min(entry.done.length, entry.total) : 0;

			const cell = h('div', { className: 'calendar-day', style: { '--delay': `${i * 12}ms` } },
				h('span', { className: 'ring-wrap' }, hasHabits ? ring(done / entry.total) : null, String(date.getDate())),
				hasHabits ? h('span', { className: 'calendar-count', text: `${done}/${entry.total}` }) : null);
			cell.classList.toggle('outside', date.getMonth() !== month.getMonth());
			cell.classList.toggle('weekend', isoWeekday(date) >= 6);
			cell.classList.toggle('future', key > today);
			cell.classList.toggle('today', key === today);
			cell.classList.toggle('has-counter', hasHabits);
			if (hasHabits) cell.addEventListener('click', () => {
				if (this.#clearing && !cell.classList.contains('cleared')) this.#onDayTap(key, cell); // not while it's going
			});
			else cell.addEventListener('click', () => this.#tapEmptyDay(cell));
			return cell;
		}));

		const streak = this.#source.streak();
		this.#streak.textContent = streak ? `${plural(streak, 'perfect day')} in a row` : '';
	}

	/** Turns clear mode on or off (the Clear button lights up, days with counters jiggle). */
	setClearMode(on) {
		this.#clearing = on;
		this.element.classList.toggle('clearing', on);
		this.#clearButton.setActive(on);
		if (!on) this.#clearButton.setTimeLeft(null);
	}

	/** The Clear button's border timer: how long until clear mode turns itself off (1 to 0). */
	setClearTimeLeft(fraction) {
		this.#clearButton.setTimeLeft(this.#clearing ? fraction : null);
	}

	/** Plays the "cleared" animation on a day, then calls `then` (e.g. to redraw). */
	clearOut(cell, then) {
		cell.classList.add('cleared');
		setTimeout(then, CLEAR_OUT_MS);
	}

	/** An empty day tapped: each quick tap in a row offends it a little more. */
	#tapEmptyDay(cell) {
		if (this.#clearing) return;
		const { shakeFromTap, heyAtTap } = this.#playful;
		const taps = this.#offendedTaps.tap(cell);
		replayAnimation(cell, taps < shakeFromTap ? 'miffed' : 'offended', DAY_ANIMATIONS);
		if (taps < heyAtTap) return;
		this.#offendedTaps.reset();
		cell.querySelector('.calendar-hey')?.remove();
		const hey = h('span', { className: 'calendar-hey', text: pickOne(this.#heyRemarks) });
		cell.append(hey);
		setTimeout(() => hey.remove(), HEY_MS);
	}

	/** The month's name tapped: enough quick taps send a wave across the days, from the top left. */
	#tapMonthName() {
		if (this.#monthTaps.tap() < this.#playful.waveTaps) return;
		this.#monthTaps.reset();
		[...this.#grid.children].forEach((cell, i) => {
			const diagonal = (i % 7) + Math.floor(i / 7);
			cell.style.setProperty('--wave-delay', `${diagonal * WAVE_STEP_MS}ms`);
			replayAnimation(cell, 'wave', DAY_ANIMATIONS);
		});
	}

	#shift(step) {
		this.#month = shiftMonth(this.#month ?? firstOfMonth(fromKey(this.#source.today())), step);
		this.render();
	}
}


/** A progress ring for `share` (0..1), coloured by how much got done. */
function ring(share) {
	const tone = share >= 1 ? 'full' : share >= 0.6 ? 'high' : share >= 0.3 ? 'mid' : 'low';
	return svg('svg', { class: 'ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
		svg('circle', { class: 'ring-track', cx: '50', cy: '50', r: String(RING_RADIUS) }),
		...(share > 0 ? [svg('circle', {
			class: `ring-fill ${tone}`, cx: '50', cy: '50', r: String(RING_RADIUS),
			'stroke-dasharray': `${(RING_LENGTH * share).toFixed(1)} ${RING_LENGTH.toFixed(1)}`,
		})] : []));
}
