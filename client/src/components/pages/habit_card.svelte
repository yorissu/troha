
<!--
	Habit card on the Today view.

	Shows a habit's name and schedule; done cards get an outline and a check that
	draws itself in. A hidden habit, while locked, shows a blank bar and a lock;
	unlocking un-blurs its name with a little pop, locking blurs it away again.

	Props:
		item   { id, colorClass, name, schedule, hidden (shown as a blank bar), done }
		index  its place, for the staggered rise-in
		onTap  gets the card's handle: { id, element, busy(), playToggle(done) }
-->

<script>
	import { lockUntilAnimationEnds, replayAnimation } from '../../core/dom.js';
	import Icon from '../controls/icon.svelte';

	const CONCEAL_MS = 280; // length of the .concealing blur, before the bar slides in
	const CARD_ANIMATIONS = ['just-done', 'just-undone', 'cheer', 'just-revealed', 'tickled'];

	let { item, index, onTap } = $props();

	let element = $state();
	// svelte-ignore state_referenced_locally (where it starts; the effect below follows item.hidden)
	let blank = $state(item.hidden); // the blank bar is drawn (follows item.hidden, after the blur)
	let concealing = $state(false);
	// svelte-ignore state_referenced_locally (where it starts; the effect below follows item.name)
	let lastName = $state(item.name); // the name, kept for the blur while it's being hidden
	let concealTimer;

	$effect(() => {
		if (item.name !== null) lastName = item.name;
	});

	// Hidden or shown: blur the name away, then the bar slides in; or un-blur it with a pop.
	$effect(() => {
		const hidden = item.hidden;
		if (hidden === (blank || concealing)) return;
		clearTimeout(concealTimer);
		if (hidden) {
			concealing = true;
			concealTimer = setTimeout(() => {
				concealing = false;
				blank = true;
			}, CONCEAL_MS);
		} else {
			concealing = false;
			blank = false;
			replayAnimation(element, 'just-revealed', CARD_ANIMATIONS);
		}
	});

	/** True while the last tap's animation is still playing (taps are ignored). */
	export function busy() {
		return element.classList.contains('busy');
	}

	/** The tap wiggle (one way for done, the other for undone); taps wait until it ends. */
	export function playToggle(done) {
		replayAnimation(element, done ? 'just-done' : 'just-undone', CARD_ANIMATIONS);
		lockUntilAnimationEnds(element);
	}

	/** A hop, as part of the celebration wave. */
	export function cheer() {
		replayAnimation(element, 'cheer', CARD_ANIMATIONS);
	}

	/** A giggly jiggle (the day-number easter egg), starting after `delayMs`. */
	export function tickle(delayMs) {
		element.style.setProperty('--tickle-delay', `${delayMs}ms`);
		replayAnimation(element, 'tickled', CARD_ANIMATIONS);
	}

	const handle = {
		get id() { return item.id; },
		get element() { return element; },
		busy,
		playToggle,
	};
</script>

<button type="button" class="card {item.colorClass} squish" class:done={item.done} class:concealing
	aria-pressed={item.done} aria-label={blank ? 'Hidden habit' : lastName} style:--delay="{index * 40}ms"
	bind:this={element} onclick={() => onTap(handle)}>
	{#if blank}
		<span class="redacted"></span>
	{:else}
		<span class="card-name">{lastName}</span>
	{/if}
	<span class="card-schedule">{item.schedule}</span>
	<Icon name="check" class="check" />
	{#if blank}<Icon name="lock" class="lock" />{/if}
</button>

<style>
	/* Sizes shrink with --rows, set by the Today view. */
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		padding: 0 4.5rem 0 2rem;
		border: .3rem solid transparent;
		border-radius: var(--radius);
		background: var(--c-fill);
		color: var(--c-text);
		text-align: left;
		animation: rise-in .6s ease-out both;
		animation-delay: var(--delay, 0ms);
	}

	.card-name,
	.card-schedule {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.card-name {
		font-size: min(1.875rem, calc(13.25rem / var(--rows, 7)));
		font-weight: 500;
	}

	.card-schedule {
		font-size: min(1.375rem, calc(9.5rem / var(--rows, 7)));
		color: var(--c-soft);
	}

	/* ---------- Done: fill fades away, outline and check appear ---------- */

	/* With no fill the card shows the page, so its text switches to the page's inks. */
	.card.done {
		background: var(--page);
		border-color: var(--c-edge);
		color: var(--c-ink);
	}

	.card.done .card-schedule,
	.card.done :global(.check) {
		color: var(--c-ink-soft);
		stroke: var(--c-ink-soft);
	}

	.card :global(.check),
	.card :global(.lock) {
		position: absolute;
		right: 1.5rem;
		top: 50%;
		translate: 0 -50%;
		stroke: var(--c-soft);
	}

	.card :global(.check) {
		width: min(2.75rem, calc(19rem / var(--rows, 7)));
		height: min(2.75rem, calc(19rem / var(--rows, 7)));
		stroke-width: 3;
		scale: 0;
		/* The check draws itself in (and quickly out again). */
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		transition: scale .45s var(--spring), stroke-dashoffset .2s ease-in;
	}

	.card.done :global(.check) {
		scale: 1;
		stroke-dashoffset: 0;
		transition: scale .45s var(--spring), stroke-dashoffset .4s ease-out .12s;
	}

	/* ---------- Tickled (easter egg: tap the big date 5 times) ---------- */

	/* A giggly jiggle, each card a little out of step. It only tilts a little and lifts
	   a little, so neighbours never touch (under half the gap each). Before the tap
	   wiggles below, so a tap during the giggle still wiggles. */
	.card:global(.tickled) {
		animation: tickle .7s ease-in-out;
		animation-delay: var(--tickle-delay, 0ms);
	}

	@keyframes tickle {
		15% { transform: translateY(-.3rem) rotate(-1.6deg); }
		30% { transform: rotate(1.6deg); }
		45% { transform: translateY(-.2rem) rotate(-1.2deg); }
		60% { transform: rotate(.9deg); }
		80% { transform: rotate(-.4deg); }
	}

	/* ---------- Tap: squeeze-and-wiggle, one way for done, the other for undone ---------- */

	.card:global(.just-done) { animation: wiggle-done .45s ease-in-out; }
	.card:global(.just-undone) { animation: wiggle-undone .45s ease-in-out; }
	.card:global(.busy) { pointer-events: none; }

	@keyframes wiggle-done {
		30% { transform: scale(.94) rotate(.8deg); }
		65% { transform: scale(1.02) rotate(-.5deg); }
	}

	@keyframes wiggle-undone {
		30% { transform: scale(.94) rotate(-.8deg); }
		65% { transform: scale(1.02) rotate(.5deg); }
	}

	/* ---------- Hidden and locked: a blank bar and a lock ---------- */

	.card .redacted {
		display: block;
		width: 12.5rem;
		max-width: 100%;
		height: min(1.5rem, calc(10.5rem / var(--rows, 7)));
		margin: .3rem 0 .4rem;
		transform-origin: left center;
		animation: bar-in .45s var(--spring) both;
	}

	.card :global(.lock) {
		width: min(2.5rem, calc(17rem / var(--rows, 7)));
		height: min(2.5rem, calc(17rem / var(--rows, 7)));
	}

	.card.done :global(.lock) { display: none; } /* done: the check shows instead */

	@keyframes bar-in {
		from { transform: scaleX(.2); opacity: 0; }
	}

	/* Unlocking: a small pop as the name un-blurs. Locking: the name blurs away. */
	.card:global(.just-revealed) { animation: peek .4s var(--spring); }
	.card:global(.just-revealed) .card-name { animation: unblur .5s ease-out both; }
	.card.concealing .card-name { animation: blur-away .28s ease-in both; }

	@keyframes peek { 40% { transform: scale(1.03); } }
	@keyframes unblur { from { filter: blur(.8rem); opacity: 0; } }
	@keyframes blur-away { to { filter: blur(.8rem); opacity: 0; } }

	/* ---------- Celebration wave (uses each card's --delay) ---------- */

	.card:global(.cheer) {
		animation: cheer .6s var(--spring) both;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes cheer {
		35% { transform: translateY(-1rem) scale(1.03) rotate(-1deg); }
		70% { transform: translateY(.2rem) scale(.99); }
	}
</style>
