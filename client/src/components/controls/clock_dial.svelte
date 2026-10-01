
<!--
	Clock dial: a round 24-hour clock face for picking a time. Hours (00–23) sit on
	the outer ring, minutes on the inner ring. To keep it calm, only every 3rd hour
	and every 15th minute is labelled; small dots mark the rest. Tap or drag on a
	ring to pick any hour or minute: a dot glides there and shows the number.

	It can be limited to a range of times (e.g. the sleep time must stay inside the
	night): hours and minutes outside it fade and can't be picked.

	Drawn in SVG units: the face is SIZE × SIZE, centred on (CENTRE, CENTRE).

	Props:
		hour, minute  the time (bindable); outside the limit, the limit's start is used
		limit         { from, until } ("HH:MM", both included, wrapping past midnight), or null for any time
		minuteStep    minutes snap to multiples of this (e.g. 5)
-->

<script>
	import { minutesAfter, minutesOf, pad } from '../../core/dates.js';
	import { replayAnimation } from '../../core/dom.js';

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

	const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: hour, ...place(HOUR_R, hour / 24), labelled: hour % HOUR_LABEL_EVERY === 0 }));
	const MINUTES = Array.from({ length: 60 }, (_, minute) => ({ value: minute, ...place(MINUTE_R, minute / 60), labelled: minute % MINUTE_LABEL_EVERY === 0 }));
	const MINUTE_PIPS = MINUTES.filter(({ value }) => value % MINUTE_PIP_EVERY === 0 && value % MINUTE_LABEL_EVERY !== 0);

	let { hour = $bindable(0), minute = $bindable(0), limit = null, minuteStep = 1 } = $props();

	let svg;
	let hourDot;
	let minuteDot;
	let dragging = $state(null); // 'hour' or 'minute' while a finger is on the dial
	let angles = { hour: 0, minute: 0 }; // running angles, so the dots always take the short way round

	/** The allowed times: { from, span } in minutes (both ends included), or null for any. */
	const range = $derived(limit ? { from: minutesOf(limit.from), span: minutesAfter(minutesOf(limit.from), minutesOf(limit.until)) } : null);
	const hourAngle = $derived(turnTo('hour', (hour / 24) * 360));
	const minuteAngle = $derived(turnTo('minute', (minute / 60) * 360));

	// A time outside the limit moves to the limit's start.
	$effect.pre(() => {
		if (range && !allowed(hour * 60 + minute)) {
			hour = Math.floor(range.from / 60);
			minute = range.from % 60;
		}
	});

	/** True if `time` (minutes since midnight) may be picked. */
	function allowed(time) {
		return !range || minutesAfter(range.from, time) <= range.span;
	}

	/** The minutes that may be picked in hour `h`: the minute steps, plus the limit's own ends. */
	function minuteChoices(h) {
		const minutes = new Set();
		for (let m = 0; m < 60; m += minuteStep) minutes.add(m);
		if (range) {
			for (const end of [range.from, (range.from + range.span) % 1440]) {
				if (Math.floor(end / 60) === h) minutes.add(end % 60);
			}
		}
		return [...minutes].filter((m) => allowed(h * 60 + m)).sort((a, b) => a - b);
	}

	function press(event) {
		const [x, y] = toDial(event);
		const distance = Math.hypot(x - CENTRE, y - CENTRE);
		if (distance < IGNORE_R || distance > FACE_R + 10) return;
		dragging = distance > (HOUR_R + MINUTE_R) / 2 ? 'hour' : 'minute';
		svg.setPointerCapture(event.pointerId);
		pointAt(event);
	}

	/** Picks the hour or minute (whichever ring was pressed) under the finger. */
	function pointAt(event) {
		const [x, y] = toDial(event);
		const turn = (Math.atan2(x - CENTRE, CENTRE - y) / (2 * Math.PI) + 1) % 1;
		const before = [hour, minute];
		if (dragging === 'hour') {
			const h = Math.round(turn * 24) % 24;
			const choices = minuteChoices(h);
			if (!choices.length) return; // an hour outside the limit
			hour = h;
			if (!choices.includes(minute) && !allowed(h * 60 + minute)) minute = nearest(choices, minute);
		} else {
			const choices = minuteChoices(hour);
			if (!choices.length) return;
			minute = nearest(choices, turn * 60);
		}
		if (hour === before[0] && minute === before[1]) return;
		replayAnimation(dragging === 'hour' ? hourDot : minuteDot, 'pop'); // the dot bounces as it lands
	}

	function release() {
		dragging = null;
	}

	/** The event's position in the dial's own units (whatever the screen scaling). */
	function toDial(event) {
		const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
		return [point.x, point.y];
	}

	/** The angle to rotate an arm to for `degrees`, the short way round from where it is. */
	function turnTo(key, degrees) {
		const previous = angles[key];
		const delta = ((((degrees - previous) % 360) + 540) % 360) - 180;
		angles[key] = previous + delta;
		return angles[key];
	}

	/** The value in `choices` closest to `target` round a 60-minute clock face. */
	function nearest(choices, target) {
		const distance = (m) => Math.min(Math.abs(m - target), 60 - Math.abs(m - target));
		return choices.reduce((best, m) => (distance(m) < distance(best) ? m : best));
	}

	/** The point `radius` from the centre, `turn` of the way round clockwise from the top (0–1). */
	function place(radius, turn) {
		const angle = turn * 2 * Math.PI;
		return { x: CENTRE + radius * Math.sin(angle), y: CENTRE - radius * Math.cos(angle) };
	}
</script>

<svg class="clock-dial" class:dragging viewBox="0 0 {SIZE} {SIZE}" role="group" aria-label="Clock" bind:this={svg}
	onpointerdown={press} onpointermove={(event) => { if (dragging) pointAt(event); }}
	onpointerup={release} onpointercancel={release}>
	<circle class="dial-face" cx={CENTRE} cy={CENTRE} r={FACE_R} />
	<circle class="dial-inner" cx={CENTRE} cy={CENTRE} r={INNER_R} />
	{#each HOURS.filter((h) => !h.labelled) as pip (pip.value)}
		<circle class="dial-pip" class:off={!minuteChoices(pip.value).length} cx={pip.x} cy={pip.y} r={PIP_R} />
	{/each}
	{#each MINUTE_PIPS as pip (pip.value)}
		<circle class="dial-pip" class:off={!allowed(hour * 60 + pip.value)} cx={pip.x} cy={pip.y} r={PIP_R} />
	{/each}
	<g class="dial-arm minute-arm" style:transform="rotate({minuteAngle}deg)">
		<circle class="dial-dot" bind:this={minuteDot} cx={CENTRE} cy={CENTRE - MINUTE_R} r={MINUTE_DOT_R} />
	</g>
	<g class="dial-arm hour-arm" style:transform="rotate({hourAngle}deg)">
		<circle class="dial-dot" bind:this={hourDot} cx={CENTRE} cy={CENTRE - HOUR_R} r={HOUR_DOT_R} />
	</g>
	{#each HOURS as label (label.value)}
		<text class="dial-hour" class:shown={label.labelled} class:on={label.value === hour}
			class:off={!minuteChoices(label.value).length} x={label.x} y={label.y}>{pad(label.value)}</text>
	{/each}
	{#each MINUTES as label (label.value)}
		<text class="dial-minute" class:shown={label.labelled} class:on={label.value === minute}
			class:off={!allowed(hour * 60 + label.value)} x={label.x} y={label.y}>{pad(label.value)}</text>
	{/each}
</svg>

<style>
	.clock-dial {
		display: block;
		width: 40rem;
		height: 40rem;
		margin: 0 auto;
		touch-action: none; /* dragging picks, it doesn't scroll */
		fill: none;
		stroke: none;
	}

	/* Two tones: the hour ring on the outside, a softer disc behind the minutes. */
	.dial-face {
		fill: var(--muted-fill);
		transition: var(--fade);
	}

	.dial-inner {
		fill: color-mix(in srgb, var(--muted-fill) 45%, var(--surface));
		transition: var(--fade);
	}

	.dial-pip {
		fill: var(--text-soft);
		opacity: .4;
	}

	/* The chosen hour and minute: dots that glide round with a little bounce (quicker while dragging). */
	.dial-arm {
		transform-box: view-box;
		transform-origin: 50% 50%;
		transition: transform .45s var(--spring);
	}

	.clock-dial.dragging .dial-arm {
		transition-duration: .12s;
	}

	.dial-dot {
		filter: drop-shadow(0 3px 5px rgb(0 0 0 / .22));
		transform-box: fill-box;
		transform-origin: center;
	}

	.dial-dot:global(.pop) {
		animation: dial-pop .4s var(--spring);
	}

	@keyframes dial-pop {
		40% { transform: scale(1.15); }
	}

	.hour-arm .dial-dot { fill: var(--primary); }
	.minute-arm .dial-dot { fill: color-mix(in srgb, var(--primary) 60%, var(--surface)); }

	/* Numbers: only the labelled ones show, plus whichever is chosen (inside its dot). */
	.dial-hour,
	.dial-minute {
		fill: var(--text);
		font-weight: 500;
		text-anchor: middle;
		dominant-baseline: central;
		pointer-events: none;
		opacity: 0;
		transition: fill .2s, opacity .2s;
	}

	.dial-hour { font-size: 30px; }
	.dial-minute { font-size: 26px; fill: var(--text-soft); }

	.dial-hour.shown,
	.dial-minute.shown,
	.dial-hour.on,
	.dial-minute.on {
		opacity: 1;
	}

	.dial-hour.on,
	.dial-minute.on {
		fill: var(--primary-text);
	}

	/* Outside the allowed range (the limit): faded, and can't be picked. */
	.dial-hour.shown.off,
	.dial-minute.shown.off {
		opacity: .22;
	}

	.dial-pip.off {
		opacity: .12;
	}
</style>
