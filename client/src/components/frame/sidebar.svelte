
<!--
	Sidebar: today's date, the progress bar, the clock, and the settings buttons under it.

	Easter egg: tapping the big day number a few times in quick succession
	(config.playful) flips it over and tickles the habit cards (onTickle). Each tap
	on the way there jiggles it, a little more every time, so something's clearly up.
	While it flips, taps on it are ignored, so nothing cuts the spin short.

	Props:
		progress   { done, total }, or null to show none (e.g. before signing in)
		onTickle   the day number was tapped enough times
		children   the settings buttons, under the clock
-->

<script>
	import { config } from '../../config.js';
	import { clockText, formatDate } from '../../core/dates.js';
	import { lockUntilAnimationEnds, replayAnimation } from '../../core/dom.js';
	import { QuickTaps } from '../../core/taps.js';
	import { clock as time } from '../../services/clock.svelte.js';

	const DAY_ANIMATIONS = ['cheer', 'flip', 'nudge', 'sunrise'];

	let { progress = null, onTickle, children } = $props();

	const { locale, playful } = config;
	const now = $derived(time.now);

	let dayNumber = $state();
	let clock = $state();
	let progressLabel = $state();
	const taps = new QuickTaps(playful.tickleGapMs);

	/** The big day number, and the clock (the tour points them out). */
	export function dayNumberElement() {
		return dayNumber;
	}

	export function clockElement() {
		return clock;
	}

	// A little bounce on "3 of 12 done" whenever the count changes (a habit ticked or unticked).
	let lastDone = null; // a plain variable: only the last count is kept
	$effect(() => {
		const done = progress?.done ?? null;
		if (lastDone !== null && done !== null && done !== lastDone) replayAnimation(progressLabel, 'bump');
		lastDone = done;
	});

	/** A happy bounce of the day number (celebration). */
	export function cheer() {
		replayAnimation(dayNumber, 'cheer', DAY_ANIMATIONS);
	}

	/** The early bird's celebration: the day number comes up like the sun, glowing, and bounces. */
	export function sunrise() {
		replayAnimation(dayNumber, 'sunrise', DAY_ANIMATIONS);
	}

	/** Make a wish: the clock twinkles. */
	export function shimmerClock() {
		replayAnimation(clock, 'shimmer');
	}

	/** Counts quick taps on the day number; enough of them flip it and tickle the cards. */
	function tapDayNumber() {
		if (dayNumber.classList.contains('busy')) return; // still flipping: let it finish
		const count = taps.tap();
		if (count < playful.tickleTaps) {
			dayNumber.style.setProperty('--nudge', count / playful.tickleTaps); // grows with each tap
			replayAnimation(dayNumber, 'nudge', DAY_ANIMATIONS);
			return;
		}
		taps.reset();
		replayAnimation(dayNumber, 'flip', DAY_ANIMATIONS);
		lockUntilAnimationEnds(dayNumber); // taps wait until the flip is done
		onTickle?.();
	}
</script>

<aside class="sidebar">
	<div class="weekday">{formatDate(now, locale, 'weekday')}</div>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (an easter egg, not a control) -->
	<div class="day-number" bind:this={dayNumber} onclick={tapDayNumber}>{now.getDate()}</div>
	<div class="month">{formatDate(now, locale, 'month')}</div>
	<div class="year">{now.getFullYear()}</div>
	<div class="sidebar-bottom">
		{#if progress}
			<div class="progress-label" bind:this={progressLabel}>
				{progress.total ? `${progress.done} of ${progress.total} done` : 'Nothing planned today'}
			</div>
			<div class="progress">
				<div class="progress-fill" style:--share={progress.total ? progress.done / progress.total : 0}></div>
			</div>
		{/if}
		<div class="clock" bind:this={clock}>{clockText(now)}</div>
		<div class="clock-buttons">{@render children?.()}</div>
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		padding: 4rem 3.25rem;
		background: var(--panel);
		color: var(--panel-text);
		transition: var(--fade);
	}

	.weekday { font-size: 2.75rem; color: var(--panel-soft); }
	.day-number { width: fit-content; font-size: 15rem; font-weight: 500; line-height: 1; margin: .5rem 0 .25rem; transform-origin: left bottom; }
	.month { font-size: 3rem; }
	.year { font-size: 2.25rem; color: var(--panel-soft); }

	.day-number:global(.cheer) { animation: day-bounce .8s var(--spring); }

	@keyframes day-bounce {
		30% { transform: scale(1.12) rotate(-3deg); }
		60% { transform: scale(.97) rotate(1deg); }
	}

	/* Easter egg: each quick tap jiggles the number, more with every tap (--nudge, 0 to 1)... */
	.day-number:global(.nudge) {
		transform-origin: center;
		animation: day-nudge .35s ease-in-out;
	}

	@keyframes day-nudge {
		25% { transform: rotate(calc(var(--nudge, .2) * -10deg)) scale(calc(1 + var(--nudge, .2) * .08)); }
		60% { transform: rotate(calc(var(--nudge, .2) * 7deg)); }
		85% { transform: rotate(calc(var(--nudge, .2) * -3deg)); }
	}

	/* ...and the last one flips it right round, overshooting a little. */
	.day-number:global(.flip) {
		transform-origin: center;
		animation: day-flip .9s var(--spring-soft);
	}

	@keyframes day-flip {
		from { transform: perspective(60rem) rotateY(0); }
		to   { transform: perspective(60rem) rotateY(360deg); }
	}

	.sidebar-bottom { margin-top: auto; }

	.progress-label { font-size: 2.25rem; color: var(--panel-soft); transform-origin: left center; }
	.progress-label:global(.bump) { animation: bump .45s var(--spring); }

	.progress {
		height: 1.375rem;
		margin: .875rem 0 1.75rem;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--progress-track);
		transition: var(--fade);
	}

	.progress-fill {
		width: calc(var(--share, 0) * 100%);
		height: 100%;
		border-radius: inherit;
		background: var(--progress);
		transition: width .7s var(--spring-soft), background-color .6s;
	}

	/* The settings buttons, in a row under the clock, spread across the panel
	   (the panel's padding keeps them off its edges, in line with the progress bar).
	   One that counts down (Screen) does so in the panel's text colour. */
	.clock-buttons {
		display: flex;
		justify-content: space-between;
		margin-top: 1.25rem;
		--timeout-color: var(--panel-text);
	}

	.clock {
		font-size: 5.75rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	/* ---------- Easter eggs that go by the clock (controllers/playful_controller.js) ---------- */

	/* Early bird: the day number sinks below the horizon, comes up glowing warm, and bounces. */
	.day-number:global(.sunrise) {
		transform-origin: center bottom;
		animation: day-sunrise 1.4s ease-out;
	}

	@keyframes day-sunrise {
		0%   { transform: none; }
		18%  { transform: translateY(1.5rem) scale(.92); opacity: .4; }
		50%  { transform: translateY(-.9rem) scale(1.06); opacity: 1; text-shadow: 0 0 2.5rem var(--butter-edge), 0 0 1rem var(--peach-edge); }
		72%  { transform: translateY(.25rem) scale(.99); text-shadow: 0 0 1.5rem var(--butter-edge); }
		100% { transform: none; text-shadow: none; }
	}

	/* Make a wish: the clock twinkles twice. */
	.clock:global(.shimmer) { animation: clock-shimmer 1.6s ease-in-out; }

	@keyframes clock-shimmer {
		0%, 100% { text-shadow: none; }
		20%, 60% { text-shadow: 0 0 1.25rem var(--progress), 0 0 .3rem var(--progress); }
		40%, 80% { text-shadow: none; }
	}
</style>
