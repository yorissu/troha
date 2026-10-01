
<!--
	Calendar view: a month of progress rings (done / total for each day) and the streak.

	Every day flips round when tapped: on its back, a dot for every habit of that day,
	in the habit's colour. Up to today, the habits that were due (from the log), filled
	while not done and hollow once done; days logged before the due habits were kept
	show their done ones in colour and the rest as plain dots. After today, the habits
	planned for it (by their schedules), faded. A day without any says so instead.
	Tapped again, it flips back (only a tap on it, or the button below, turns a day).

	The round button in the month bar turns every day to one side, one after another
	like dominoes: Rings (the fronts) or Dots (the backs); days already showing that
	side stay as they are. A day doesn't take taps while it's turning.

	Props:
		dayNames        short weekday names, Monday first
		entry           (day) => { total, due?, done } or undefined: a day's log entry
		planned         (day) => the ids of the habits planned for a day after today
		habitColor      (habit id) => its colour class, e.g. 'c-mint' ('c-plain' once it's deleted)
		streak          perfect days in a row
		onScreen        true while the Calendar is the view on screen (each time it comes up, it shows this month)
-->

<script>
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { config } from '../../config.js';
	import { clock } from '../../services/clock.svelte.js';
	import { calendarDays, firstOfMonth, fromKey, isoWeekday, shiftMonth, toKey, weeksInMonth } from '../../core/dates.js';
	import { plural } from '../../core/text.js';
	import CycleButton from '../controls/cycle_button.svelte';
	import MonthBar from '../controls/month_bar.svelte';
	import WeekdayRow from '../controls/weekday_row.svelte';

	const RING_RADIUS = 40;
	const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
	const DOT_GRID_WIDTH = 1.8; // a day's back is about 1.8 times as wide as it is tall
	const DOTS_IN_MS = 500;     // the dots pop in one after another within this long, however many
	const FLIP_MS = 600;        // how long a day takes to turn round
	const DOMINO_MS = 30;       // the button: each day starts turning this long after the one before
	const SIDES = { front: { label: 'Rings', icon: 'calendar_rings' }, back: { label: 'Dots', icon: 'calendar_dots' } };

	let { dayNames, entry, planned, habitColor, streak, onScreen } = $props();

	const { locale } = config;
	const today = $derived(clock.day);
	let month = $state(null);
	let side = $state('front');     // what the days show: 'front' (rings) or 'back' (dots); the button turns them all
	const turned = new SvelteSet(); // the day keys of the days turned to the other side by a tap
	let wave = $state(false);       // true while the button's dominoes fall
	let waveTimer;
	let waveUntil = 0;              // performance.now() when the dominoes have all fallen
	const busyUntil = new Map();    // day key -> performance.now() when it has finished turning
	onDestroy(() => clearTimeout(waveTimer));

	const shown = $derived(month ?? firstOfMonth(fromKey(today)));
	const weeks = $derived(weeksInMonth(shown));
	const days = $derived(calendarDays(shown, weeks).map((date) => {
		const key = toKey(date);
		const outside = date.getMonth() !== shown.getMonth();
		const log = entry(key);
		const past = key <= today;
		const hasHabits = past && log?.total > 0;
		return {
			key,
			date,
			hasHabits,
			done: hasHabits ? Math.min(log.done.length, log.total) : 0,
			total: hasHabits ? log.total : 0,
			dots: hasHabits ? dotsOf(log) : past ? [] : planned(key).map((id) => ({ key: id, color: habitColor(id), done: false })),
			empty: past ? 'Nothing due' : 'Nothing planned', // the back, without dots
			outside,
			order: outside ? null : date.getDate() - 1, // its place in the dominoes
			weekend: isoWeekday(date) >= 6,
		};
	}));

	/** True if day `key` shows its back (the dots). */
	function showsBack(key) {
		return (side === 'back') !== turned.has(key);
	}

	// Each time the Calendar comes up, it shows this month.
	$effect(() => {
		if (onScreen) month = null;
	});

	/** A day tapped: it turns round (or back again), unless it's still turning. */
	function tapDay(day) {
		const now = performance.now();
		if (day.outside || (busyUntil.get(day.key) ?? 0) > now) return;
		if (turned.has(day.key)) turned.delete(day.key);
		else turned.add(day.key);
		busyUntil.set(day.key, now + FLIP_MS);
	}

	/**
	 * The side button: every day turns to the other side, one after another (days turned
	 * by a tap that already show it stay). Not again until they've all turned.
	 */
	function nextSide() {
		const now = performance.now();
		if (now < waveUntil) return;
		side = side === 'front' ? 'back' : 'front';
		turned.clear();
		for (const day of days) {
			if (!day.outside) busyUntil.set(day.key, now + day.order * DOMINO_MS + FLIP_MS);
		}
		const count = days.filter((day) => !day.outside).length;
		waveUntil = now + count * DOMINO_MS + FLIP_MS;
		wave = true;
		clearTimeout(waveTimer);
		waveTimer = setTimeout(() => { wave = false; }, waveUntil - now);
	}

	/**
	 * A day's dots, one per habit due: { key, color, done }. Without `due` (logged before
	 * it was kept), the done habits in their colours, then plain ones for the rest.
	 */
	function dotsOf(log) {
		const done = new Set(log.done);
		if (log.due) return log.due.map((id) => ({ key: id, color: habitColor(id), done: done.has(id) }));
		const missed = Math.max(0, log.total - log.done.length);
		return [
			...log.done.map((id) => ({ key: id, color: habitColor(id), done: true })),
			...Array.from({ length: missed }, (_, i) => ({ key: `missed-${i}`, color: 'c-plain', done: false })),
		];
	}

	/**
	 * A grid for `count` dots, as wide as the back of a day (so they can be as big as can
	 * be), with its rows as full as can be: 4: 2 × 2, 6: 3 × 2, 16: 6 × 3, 40: 8 × 5.
	 * @returns {{cols: number, rows: number}}
	 */
	function dotGrid(count) {
		const rows = Math.ceil(count / Math.ceil(Math.sqrt(count * DOT_GRID_WIDTH)));
		return { cols: Math.ceil(count / rows), rows };
	}

	/** A progress ring's colour, by how much got done. */
	function tone(share) {
		return share >= 1 ? 'full' : share >= 0.6 ? 'high' : share >= 0.3 ? 'mid' : 'low';
	}

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

<section class="view calendar-view" bind:this={root}>
	<MonthBar month={shown} {locale} class="calendar-bar" onShift={(step) => { month = shiftMonth(shown, step); }}>
		<div class="streak">{streak ? `${plural(streak, 'perfect day')} in a row` : ''}</div>
		<CycleButton name="Days show" icons={{ front: SIDES.front.icon, back: SIDES.back.icon }} choice={side}
			label={SIDES[side].label} onTap={nextSide} />
	</MonthBar>
	<WeekdayRow {dayNames} class="calendar-weekdays" />
	<div class="calendar-grid" class:wave style:--weeks={weeks} style:--flip-ms="{FLIP_MS}ms">
		{#each days as day, i (day.key)}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (turning a day round only shows its habits as dots) -->
			<div class="calendar-day" class:outside={day.outside} class:weekend={day.weekend} class:future={day.key > today}
				class:today={day.key === today} style:--delay="{i * 12}ms" style:--domino="{(day.order ?? 0) * DOMINO_MS}ms"
				onclick={() => tapDay(day)}>
				<div class="day-card" class:flipped={showsBack(day.key)}>
					<div class="day-face front">
						<span class="ring-wrap">
							{#if day.hasHabits}
								<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
									<circle class="ring-track" cx="50" cy="50" r={RING_RADIUS} />
									{#if day.done > 0}
										<circle class="ring-fill {tone(day.done / day.total)}" cx="50" cy="50" r={RING_RADIUS}
											stroke-dasharray="{(RING_LENGTH * day.done / day.total).toFixed(1)} {RING_LENGTH.toFixed(1)}" />
									{/if}
								</svg>
							{/if}
							{day.date.getDate()}
						</span>
						{#if day.hasHabits}<span class="calendar-count">{day.done}/{day.total}</span>{/if}
					</div>
					<div class="day-face back" class:planned={day.key > today}>
						{#if day.dots.length}
							{@const grid = dotGrid(day.dots.length)}
							<span class="dot-area">
								<span class="dots" style:--cols={grid.cols} style:--rows={grid.rows}
									aria-label={day.hasHabits ? `${day.done} of ${day.total} done` : `${plural(day.dots.length, 'habit')} planned`}>
									{#each day.dots as dot, d (dot.key)}
										<span class="dot {dot.color}" class:done={dot.done}
											style:--dot-delay="{Math.round(d * Math.min(25, DOTS_IN_MS / day.dots.length))}ms"></span>
									{/each}
								</span>
							</span>
						{:else}
							<span class="back-note">{day.empty}</span>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	/* The month bar, with the streak on its right. */
	:global(.calendar-bar) {
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	:global(.calendar-bar .month-label) { min-width: 22rem; font-size: 2.5rem; }

	/* The side button: round, the size of the month arrows, in the days' colours. */
	:global(.calendar-bar) {
		--cycle-size: 4.5rem;
		--cycle-fill: var(--muted-fill);
		--cycle-text: var(--text);
	}
	.streak { margin-left: auto; font-size: 1.875rem; color: var(--text-soft); }

	:global(.calendar-weekdays) {
		gap: 1rem;
		margin-bottom: .75rem;
		font-size: 1.75rem;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 1rem;
		flex: 1;
		min-height: 0;
		grid-template-rows: repeat(var(--weeks, 5), minmax(0, 1fr));
		--rise: .75rem; /* days rise in: under the gap ÷ 1.3, so they never overlap */
	}

	/* A day is a card with two faces: the ring in front, the dots on the back. */
	.calendar-day {
		position: relative;
		perspective: 60rem;
		animation: rise-in .5s ease-out both;
		animation-delay: var(--delay, 0ms);
	}

	.day-card {
		position: absolute;
		inset: 0;
		transform-style: preserve-3d;
		transition: transform var(--flip-ms) var(--spring-soft);
	}

	.day-card.flipped { transform: rotateY(180deg); }

	/* The button's dominoes: each day starts turning a little after the one before. */
	.calendar-grid.wave .day-card { transition-delay: var(--domino, 0ms); }

	.day-face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: .5rem;
		border: .3rem solid transparent;
		border-radius: 1.75rem;
		background: var(--muted-fill);
		backface-visibility: hidden;
		transition: var(--fade);
	}

	.day-face.back {
		padding: .75rem 1rem;
		transform: rotateY(180deg);
	}

	.calendar-day.outside { visibility: hidden; }
	.calendar-day.weekend .day-face { background: var(--weekend-fill); } /* Saturday and Sunday: a shade deeper */
	.calendar-day.future { color: var(--text-soft); }
	.calendar-day.today .day-face { border-color: var(--primary); border-style: dashed; }

	/* ---------- The front: a progress ring ---------- */

	.ring-wrap {
		position: relative;
		display: grid;
		place-items: center;
		width: calc(26rem / var(--weeks, 5)); /* smaller rings when the month has 6 weeks */
		height: calc(26rem / var(--weeks, 5));
		font-size: 1.75rem;
		font-weight: 500;
	}

	.ring {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		rotate: -90deg;
	}

	.ring circle { stroke-width: 11; }
	.ring-track { stroke: var(--line); }
	.ring-fill { animation: draw-ring 1s var(--spring-soft) both; animation-delay: var(--delay, 0ms); }
	.ring-fill.full { stroke: var(--ring-full); }
	.ring-fill.high { stroke: var(--ring-high); }
	.ring-fill.mid { stroke: var(--ring-mid); }
	.ring-fill.low { stroke: var(--ring-low); }

	@keyframes draw-ring {
		from { stroke-dasharray: 0 260; }
	}

	.calendar-count { font-size: 1.375rem; color: var(--text-soft); }

	/* ---------- The back: a dot per habit ---------- */

	/* The dots take the whole back and shrink to fit it however many there are (up to
	   their full size); the gaps and the hollow ones' outline shrink along. */
	.dot-area {
		align-self: stretch;
		flex: 1;
		min-height: 0;
		display: grid;
		place-items: center;
		container-type: size; /* the dots measure it (cqw, cqh) */
	}

	.dots {
		--gap-share: .3; /* a gap is this share of a dot */
		--dot: min(2rem,
			calc(100cqw / (var(--cols) * (1 + var(--gap-share)) - var(--gap-share))),
			calc(100cqh / (var(--rows) * (1 + var(--gap-share)) - var(--gap-share))));
		display: grid;
		grid-template-columns: repeat(var(--cols), var(--dot));
		gap: calc(var(--dot) * var(--gap-share));
	}

	/* In the habit's colour (its edge tone, which shows on the day in both themes).
	   Filled: not done; hollow: done. They pop in as the day turns round. */
	.dot {
		width: var(--dot);
		height: var(--dot);
		border: calc(var(--dot) * .17) solid var(--c-edge);
		border-radius: 50%;
		background: var(--c-edge);
	}

	.dot.done { background: transparent; }

	/* After today: planned, not due yet. */
	.back.planned .dot { opacity: .45; }

	.back-note { font-size: 1.375rem; color: var(--text-soft); text-align: center; }

	.day-card.flipped .dot {
		animation: dot-in .4s var(--spring) both;
		animation-delay: calc(.2s + var(--dot-delay, 0ms));
	}

	/* With the dominoes, as their own day turns. */
	.calendar-grid.wave .day-card.flipped .dot {
		animation-delay: calc(.2s + var(--domino, 0ms) + var(--dot-delay, 0ms));
	}

	@keyframes dot-in {
		from { transform: scale(0); }
	}
</style>
