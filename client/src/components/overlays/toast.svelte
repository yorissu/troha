
<!--
	Toasts: draws the toasts (services/toast.svelte.js) at the bottom, in a column, so
	a new one never lands on top of one still leaving. Each pops in, and hops away
	when it goes. Its outline counts down to when it goes (see timeout_ring.js), so
	it's clear how long it (and its action) will stay.
-->

<script>
	import { toast } from '../../services/toast.svelte.js';
	import { TimeoutRing } from '../controls/timeout_ring.js';

	/** Counts the outline down over `ms` (none while it's null: a toast that stays). */
	function countdown(element, ms) {
		const ring = new TimeoutRing(element);
		const start = (time) => {
			if (time === null) ring.setTimeLeft(null);
			else ring.run(time);
		};
		start(ms);
		return {
			update: (next) => start(next),
			destroy: () => ring.destroy(),
		};
	}
</script>

<div class="toasts">
	{#each toast.items as item (item.id)}
		<div class="toast" class:has-action={item.actionLabel !== null}
			class:leaving={item.leaving} role="status" use:countdown={item.durationMs}>
			<span class="toast-message">{item.message}</span>
			{#if item.actionLabel !== null}
				<button type="button" class="toast-action squish" onclick={() => toast.tapAction(item.id)}>{item.actionLabel}</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* The stack: the newest message nearest the bottom edge. Taps go through the gaps. */
	.toasts {
		position: absolute;
		left: 50%;
		bottom: 2.5rem;
		translate: -50% 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		pointer-events: none;
	}

	.toast {
		padding: 1.25rem 2.25rem;
		border: .3rem solid var(--text-soft);
		border-radius: 1.5rem;
		--timeout-color: var(--text); /* the outline counts down to when it goes: a dark line on a pale track */
		background: var(--page); /* reads as "no fill", but stays legible over cards */
		color: var(--text);
		font-size: 1.75rem;
		white-space: nowrap;
		pointer-events: none; /* taps go through to what's underneath (e.g. a calendar day)... */
		animation: toast-in .5s var(--spring) both;
	}

	/* While it counts down, its outline is the pale track the countdown's line runs on. */
	.toast:global(.timing) {
		border-color: color-mix(in srgb, var(--text-soft) 30%, transparent);
	}

	.toast.has-action {
		display: flex;
		align-items: center;
		gap: 2rem;
		padding-right: 1rem;
	}

	/* "Undo": a filled pill inside the outlined toast. */
	.toast-action {
		height: 4rem;
		padding: 0 1.75rem;
		border-radius: 1rem;
		background: var(--selected);
		color: var(--selected-text);
		font-size: 1.75rem;
		pointer-events: auto; /* ...except on its button */
	}

	/* Popping up, free to grow past its edges (it's on its own, over everything). */
	@keyframes toast-in {
		from { transform: scale(.6) translateY(1.25rem); opacity: 0; }
		to   { transform: none; opacity: 1; }
	}

	/* On the way out: a little hop, then it tips over and drops off the screen. */
	.toast.leaving {
		animation: toast-away .7s cubic-bezier(.5, -0.4, .7, .4) both;
		pointer-events: none;
	}

	.toast.leaving * { pointer-events: none; }

	@keyframes toast-away {
		30%  { transform: translateY(-1.25rem) rotate(2deg) scale(1.04); opacity: 1; }
		100% { transform: translateY(9rem) rotate(-8deg) scale(.85); opacity: 0; }
	}
</style>
