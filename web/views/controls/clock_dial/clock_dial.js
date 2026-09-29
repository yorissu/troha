
/**
 * Clock dial: a round 24-hour clock face for picking a time. Hours (00–23) sit on
 * the outer ring, minutes on the inner ring. To keep it calm, only every 3rd hour
 * and every 15th minute is labelled; small dots mark the rest. Tap or drag on a
 * ring to pick any hour or minute: a dot glides there and shows the number.
 *
 * It can be limited to a range of times (e.g. the sleep time must stay inside the
 * night): hours and minutes outside it fade and can't be picked.
 *
 * Drawn in SVG units: the face is SIZE × SIZE, centred on (CENTRE, CENTRE).
 */

import { minutesAfter, minutesOf, pad } from '../../../core/dates.js';
import { replayAnimation, svg } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';

const SIZE = 440;
const CENTRE = SIZE / 2;
const FACE_R = 218;
const HOUR_R = 178;   // hour ring
const MINUTE_R = 98;  // minute ring
const INNER_R = 138;  // the inner disc behind the minutes
const HOUR_DOT_R = 34;
const MINUTE_DOT_R = 30;
const PIP_R = 4.5;    // the small dots between labels
const HOUR_LABEL_EVERY = 3;
const MINUTE_LABEL_EVERY = 15;
const MINUTE_PIP_EVERY = 5;
const IGNORE_R = 40;  // taps this close to the centre pick nothing

export class ClockDial extends Component {
	#hour = 0;
	#minute = 0;
	#minuteStep = 1;
	#onChange;
	#dragging = null; // 'hour' or 'minute' while a finger is on the dial
	#hourArm;
	#minuteArm;
	#hourLabels = [];   // one per hour; unlabelled hours only show theirs when chosen
	#minuteLabels = []; // one per minute; likewise
	#hourPips = new Map();   // hour -> its small dot (unlabelled hours)
	#minutePips = new Map(); // minute -> its small dot
	#limit = null; // allowed times: { from, span } in minutes (both ends included), or null for any
	#angles = { hour: 0, minute: 0 }; // running angles, so the dots always take the short way round

	/** @param {{onChange?: (time: {hour: number, minute: number}) => void}} [options] */
	constructor({ onChange } = {}) {
		super(svg('svg', { class: 'clock-dial', viewBox: `0 0 ${SIZE} ${SIZE}`, role: 'group', 'aria-label': 'Clock' }));
		this.#onChange = onChange;

		this.#hourArm = arm('hour', HOUR_R, HOUR_DOT_R);
		this.#minuteArm = arm('minute', MINUTE_R, MINUTE_DOT_R);
		this.#hourLabels = Array.from({ length: 24 }, (_, hour) =>
			label('dial-hour', pad(hour), HOUR_R, hour / 24, hour % HOUR_LABEL_EVERY === 0));
		this.#minuteLabels = Array.from({ length: 60 }, (_, minute) =>
			label('dial-minute', pad(minute), MINUTE_R, minute / 60, minute % MINUTE_LABEL_EVERY === 0));
		for (let hour = 0; hour < 24; hour++) {
			if (hour % HOUR_LABEL_EVERY !== 0) this.#hourPips.set(hour, pip(HOUR_R, hour / 24));
		}
		for (let minute = 0; minute < 60; minute += MINUTE_PIP_EVERY) {
			if (minute % MINUTE_LABEL_EVERY !== 0) this.#minutePips.set(minute, pip(MINUTE_R, minute / 60));
		}

		this.element.append(
			svg('circle', { class: 'dial-face', cx: CENTRE, cy: CENTRE, r: FACE_R }),
			svg('circle', { class: 'dial-inner', cx: CENTRE, cy: CENTRE, r: INNER_R }),
			...this.#hourPips.values(),
			...this.#minutePips.values(),
			this.#minuteArm,
			this.#hourArm,
			...this.#hourLabels,
			...this.#minuteLabels);

		this.element.addEventListener('pointerdown', (event) => this.#press(event));
		this.element.addEventListener('pointermove', (event) => { if (this.#dragging) this.#pointAt(event); });
		for (const type of ['pointerup', 'pointercancel']) {
			this.element.addEventListener(type, () => {
				this.#dragging = null;
				this.element.classList.remove('dragging');
			});
		}
	}

	/** @returns {{hour: number, minute: number}} */
	get value() {
		return { hour: this.#hour, minute: this.#minute };
	}

	/** @param {{hour: number, minute: number}} time (outside the limit, the limit's start is used) */
	set value({ hour, minute }) {
		const time = this.#allowed(hour * 60 + minute) ? hour * 60 + minute : this.#limit.from;
		this.#hour = Math.floor(time / 60);
		this.#minute = time % 60;
		this.#render();
	}

	/**
	 * Only allow times from..until (both "HH:MM", both included, wrapping past
	 * midnight), or any time with null. Set it before the value.
	 * @param {{from: string, until: string}|null} range
	 */
	set limit(range) {
		this.#limit = range ? { from: minutesOf(range.from), span: minutesAfter(minutesOf(range.from), minutesOf(range.until)) } : null;
	}

	/** Minutes snap to multiples of this (e.g. 5). */
	set minuteStep(step) {
		this.#minuteStep = step;
	}

	#press(event) {
		const [x, y] = this.#toDial(event);
		const distance = Math.hypot(x - CENTRE, y - CENTRE);
		if (distance < IGNORE_R || distance > FACE_R + 10) return;
		this.#dragging = distance > (HOUR_R + MINUTE_R) / 2 ? 'hour' : 'minute';
		this.element.classList.add('dragging');
		this.element.setPointerCapture(event.pointerId);
		this.#pointAt(event);
	}

	/** Picks the hour or minute (whichever ring was pressed) under the finger. */
	#pointAt(event) {
		const [x, y] = this.#toDial(event);
		const turn = (Math.atan2(x - CENTRE, CENTRE - y) / (2 * Math.PI) + 1) % 1;
		const before = this.value;
		if (this.#dragging === 'hour') {
			const hour = Math.round(turn * 24) % 24;
			const choices = this.#minuteChoices(hour);
			if (!choices.length) return; // an hour outside the limit
			this.#hour = hour;
			if (!choices.includes(this.#minute) && !this.#allowed(hour * 60 + this.#minute)) this.#minute = nearest(choices, this.#minute);
		} else {
			const choices = this.#minuteChoices(this.#hour);
			if (!choices.length) return;
			this.#minute = nearest(choices, turn * 60);
		}
		if (this.#hour === before.hour && this.#minute === before.minute) return;
		const arm = this.#dragging === 'hour' ? this.#hourArm : this.#minuteArm;
		replayAnimation(arm.firstElementChild, 'pop'); // the dot bounces as it lands
		this.#render();
		this.#onChange?.(this.value);
	}

	/** The event's position in the dial's own units (whatever the screen scaling). */
	#toDial(event) {
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(this.element.getScreenCTM().inverse());
		return [point.x, point.y];
	}

	/** True if `time` (minutes since midnight) may be picked. */
	#allowed(time) {
		return !this.#limit || minutesAfter(this.#limit.from, time) <= this.#limit.span;
	}

	/** The minutes that may be picked in `hour`: the minute steps, plus the limit's own ends. */
	#minuteChoices(hour) {
		const minutes = new Set();
		for (let minute = 0; minute < 60; minute += this.#minuteStep) minutes.add(minute);
		if (this.#limit) {
			for (const end of [this.#limit.from, (this.#limit.from + this.#limit.span) % 1440]) {
				if (Math.floor(end / 60) === hour) minutes.add(end % 60);
			}
		}
		return [...minutes].filter((minute) => this.#allowed(hour * 60 + minute)).sort((a, b) => a - b);
	}

	#render() {
		this.#turnArm(this.#hourArm, 'hour', (this.#hour / 24) * 360);
		this.#turnArm(this.#minuteArm, 'minute', (this.#minute / 60) * 360);
		this.#hourLabels.forEach((element, hour) => {
			element.classList.toggle('on', hour === this.#hour);
			const off = !this.#minuteChoices(hour).length;
			element.classList.toggle('off', off);
			this.#hourPips.get(hour)?.classList.toggle('off', off);
		});
		this.#minuteLabels.forEach((element, minute) => {
			element.classList.toggle('on', minute === this.#minute);
			const off = !this.#allowed(this.#hour * 60 + minute);
			element.classList.toggle('off', off);
			this.#minutePips.get(minute)?.classList.toggle('off', off);
		});
	}

	/** Rotates an arm (its dot) to `degrees`, the short way round from where it is. */
	#turnArm(element, key, degrees) {
		const previous = this.#angles[key];
		const delta = ((((degrees - previous) % 360) + 540) % 360) - 180;
		this.#angles[key] = previous + delta;
		element.style.transform = `rotate(${this.#angles[key]}deg)`;
	}
}

/** The value in `choices` closest to `target` round a 60-minute clock face. */
function nearest(choices, target) {
	const distance = (minute) => Math.min(Math.abs(minute - target), 60 - Math.abs(minute - target));
	return choices.reduce((best, minute) => (distance(minute) < distance(best) ? minute : best));
}

/** The point `radius` from the centre, `turn` of the way round clockwise from the top (0–1). */
function polar(radius, turn) {
	const angle = turn * 2 * Math.PI;
	return [CENTRE + radius * Math.sin(angle), CENTRE - radius * Math.cos(angle)];
}

/** The choice marker: a dot at the top of its ring, turned into place by rotating its group. */
function arm(kind, radius, dotRadius) {
	return svg('g', { class: `dial-arm ${kind}-arm` },
		svg('circle', { class: 'dial-dot', cx: CENTRE, cy: CENTRE - radius, r: dotRadius }));
}

/** A number on a ring. Unlabelled positions (`shown` false) only show it while chosen. */
function label(className, text, radius, turn, shown) {
	const [x, y] = polar(radius, turn);
	const element = svg('text', { class: `${className}${shown ? ' shown' : ''}`, x, y });
	element.textContent = text;
	return element;
}

/** A small dot marking an unlabelled position. */
function pip(radius, turn) {
	const [cx, cy] = polar(radius, turn);
	return svg('circle', { class: 'dial-pip', cx, cy, r: PIP_R });
}
