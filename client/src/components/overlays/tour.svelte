
<!--
	Tour: a walkthrough layer over the whole app. Everything is dimmed except what's
	being explained (the spotlights, e.g. a view and its button in the header),
	whose own outlines are drawn over in the tour's colour; a card next to the main
	one explains it, with Back, Next and "Skip tour".

	Nothing but the card can be tapped while it's on: four transparent panels
	around the main spotlight, and a cover over it, catch every touch. A step can
	leave the main spotlight open (`interactive`), e.g. to type a new PIN.

	The spotlights follow their targets as they move (e.g. a pop-up swinging in),
	and glide from one step's targets to the next; the dimming (one layer with a
	rounded hole cut out for each spotlight) is redrawn every frame to match them.
	They're measured and moved in code, every frame, rather than drawn from state.

	Props:
		onNext, onBack, onSkip
-->

<script>
	import { onMount } from 'svelte';
	import { replayAnimation } from '../../core/dom.js';

	// In rem (so they scale with the screen, like everything else).
	const PLAIN_BORDER = .3;   // the outline's width on something without a border of its own
	const PLAIN_RADIUS = 1.25; // and its corners, on something without rounded corners either
	const CARD_GAP = 1.25;     // between the main spotlight and the card
	const EDGE = 1;            // the card keeps this far from the edges of the screen

	let { onNext, onBack, onSkip } = $props();

	let root;
	let dim;
	let cover;
	let card;
	const panels = [];
	let step = $state(null);
	let starting = $state(false);
	let noTarget = $state(false);
	const spots = []; // one outline per spotlight; the first is the main one
	let lastHoles = null; // the targets' places last time, to only move things when they move
	let lastDim = null;   // the dimming's last shape
	let frame = 0;

	onMount(() => {
		// Keys too: while the tour is on, only a step that's left open may be typed into.
		const onKey = (event) => {
			if (!step || step.interactive) return;
			event.stopImmediatePropagation();
			event.preventDefault();
		};
		document.addEventListener('keydown', onKey, true);
		return () => {
			document.removeEventListener('keydown', onKey, true);
			cancelAnimationFrame(frame);
		};
	});

	/** True while the tour is on screen. */
	export function active() {
		return step !== null;
	}

	/**
	 * Shows a step.
	 * @param {object} shown
	 * @param {() => (Element|null)} [shown.target] The main thing to spotlight (none: just the card, in the middle).
	 * @param {() => Element[]} [shown.also] More things to spotlight with it (e.g. the view's button).
	 * @param {boolean} [shown.interactive] Let the main spotlit thing be tapped (and typed into).
	 * @param {string} shown.title
	 * @param {string} shown.text
	 * @param {number} shown.number 1, 2, 3…
	 * @param {number} shown.count How many steps there are.
	 * @param {string} [shown.nextLabel] Default "Next".
	 * @param {boolean} [shown.canGoBack]
	 */
	export function show(shown) {
		starting = step === null; // no gliding in from nowhere
		step = shown;
		root.hidden = false; // now, so it can be measured below
		lastHoles = null; // place everything afresh
		follow();
		replayAnimation(card, 'arriving');
		for (const spot of spots) replayAnimation(spot, 'arriving');
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(track);
	}

	export function hide() {
		cancelAnimationFrame(frame);
		step = null;
	}

	/** Every frame while on: keeps the spotlights on their targets, and the dimming on the spotlights. */
	function track() {
		if (!step) return;
		follow();
		starting = false;
		frame = requestAnimationFrame(track);
	}

	/** Places the spotlights, the panels and the card where the targets are now, and redraws the dimming. */
	function follow() {
		const layer = root.getBoundingClientRect();
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const main = holeAround(step?.target?.(), layer, rem); // null: nothing to light (e.g. the welcome)
		const extras = (step?.also?.() ?? []).map((target) => holeAround(target, layer, rem)).filter(Boolean);
		const holes = main ? [main, ...extras] : extras;

		const key = holes.map(({ left, top, width, height, radius }) => [left, top, width, height, radius].map(Math.round).join(' ')).join('|');
		if (key !== lastHoles) {
			lastHoles = key;
			noTarget = !main;
			placeSpots(holes);
			placeBlocks(main ?? { left: layer.width / 2, top: layer.height / 2, width: 0, height: 0 }, layer);
			placeCard(main, holes, layer, rem);
		}
		drawDim(layer, !main);
	}

	/** One outline per hole (made or removed as needed). */
	function placeSpots(holes) {
		while (spots.length < holes.length) {
			const spot = document.createElement('div');
			spot.className = 'tour-spot';
			dim.after(spot);
			spots.push(spot);
		}
		spots.forEach((spot, i) => {
			const hole = holes[i];
			spot.hidden = !hole;
			if (!hole) return;
			place(spot, hole);
			spot.style.borderRadius = `${hole.radius}px`;
			spot.style.setProperty('--spot-border', `${hole.border}px`);
		});
	}

	/** The panels around the main spotlight, and the cover over it, catch every touch. */
	function placeBlocks(hole, layer) {
		place(cover, hole);
		const right = hole.left + hole.width;
		const bottom = hole.top + hole.height;
		const [above, below, before, after] = panels;
		place(above, { left: 0, top: 0, width: layer.width, height: Math.max(0, hole.top) });
		place(below, { left: 0, top: bottom, width: layer.width, height: Math.max(0, layer.height - bottom) });
		place(before, { left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height });
		place(after, { left: right, top: hole.top, width: Math.max(0, layer.width - right), height: hole.height });
	}

	/**
	 * Dims everything but the spotlights: a hole for each, cut where it is right now,
	 * with its corners (so the holes glide along with the outlines).
	 */
	function drawDim(layer, nothingLit) {
		const holes = nothingLit ? [] : spots
			.filter((spot) => !spot.hidden)
			.map((spot) => {
				const box = spot.getBoundingClientRect();
				const radius = parseFloat(getComputedStyle(spot).borderTopLeftRadius) || 0;
				return { left: box.left - layer.left, top: box.top - layer.top, width: box.width, height: box.height, radius };
			})
			.filter((hole) => hole.width > 0 && hole.height > 0);
		const shape = holes.length
			? `path(evenodd, "M0 0H${layer.width}V${layer.height}H0Z ${holes.map(roundedRect).join(' ')}")`
			: 'none';
		if (shape === lastDim) return;
		lastDim = shape;
		dim.style.clipPath = shape;
	}

	/**
	 * The card goes where there's room without covering any spotlight: below the main
	 * one, above it, beside it, or (if none fits) in the middle.
	 */
	function placeCard(hole, holes, layer, rem) {
		const gap = CARD_GAP * rem;
		const edge = EDGE * rem;
		const width = card.offsetWidth;
		const height = card.offsetHeight;
		const clampX = (x) => Math.min(Math.max(x, edge), layer.width - width - edge);
		const clampY = (y) => Math.min(Math.max(y, edge), layer.height - height - edge);
		const middle = { x: (layer.width - width) / 2, y: (layer.height - height) / 2 };
		let spot = middle;
		if (hole) {
			const centreX = hole.left + hole.width / 2 - width / 2;
			const centreY = hole.top + hole.height / 2 - height / 2;
			const choices = [
				{ fits: hole.top + hole.height + gap + height + edge <= layer.height, x: clampX(centreX), y: hole.top + hole.height + gap },
				{ fits: hole.top - gap - height >= edge, x: clampX(centreX), y: hole.top - gap - height },
				{ fits: hole.left + hole.width + gap + width + edge <= layer.width, x: hole.left + hole.width + gap, y: clampY(centreY) },
				{ fits: hole.left - gap - width >= edge, x: hole.left - gap - width, y: clampY(centreY) },
			];
			const coversNothing = ({ x, y }) => holes.every((other) => !overlaps({ left: x, top: y, width, height }, other));
			spot = choices.find((c) => c.fits && coversNothing(c)) ?? choices.find((c) => c.fits) ?? { x: middle.x, y: clampY(centreY) };
		}
		card.style.left = `${spot.x}px`;
		card.style.top = `${spot.y}px`;
	}

	/**
	 * The spotlight on `target`: exactly its box (in px within the layer), its corner radius,
	 * and its border's width, so the outline lies on the target's own; null if it isn't on
	 * screen. Something with no border (or no rounded corners) gets a plain one.
	 */
	function holeAround(target, layer, rem) {
		if (!target?.isConnected) return null;
		const box = target.getBoundingClientRect();
		if (!box.width && !box.height) return null;
		const style = getComputedStyle(target);
		const corner = style.borderTopLeftRadius;
		const radius = corner.endsWith('%') ? (parseFloat(corner) / 100) * Math.min(box.width, box.height) : parseFloat(corner) || 0;
		const border = parseFloat(style.borderTopWidth) || 0;
		return {
			left: box.left - layer.left,
			top: box.top - layer.top,
			width: box.width,
			height: box.height,
			radius: radius || (border ? 0 : PLAIN_RADIUS * rem),
			border: border || PLAIN_BORDER * rem,
		};
	}

	/** True if two boxes overlap. */
	function overlaps(a, b) {
		return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
	}

	/** An SVG path for a rectangle with rounded corners (the radius shrinks to fit small ones). */
	function roundedRect({ left, top, width, height, radius }) {
		const r = Math.min(radius, width / 2, height / 2);
		const right = left + width;
		const bottom = top + height;
		return `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}`
			+ `H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`;
	}

	/** Sets an element's box, in px within the tour layer. */
	function place(element, { left, top, width, height }) {
		Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
	}
</script>

<div class="tour" class:starting class:no-target={noTarget} hidden={step === null} bind:this={root}>
	<div class="tour-dim" bind:this={dim}></div>
	{#each [0, 1, 2, 3] as i (i)}<div class="tour-block" bind:this={panels[i]}></div>{/each}
	<div class="tour-block tour-cover" hidden={Boolean(step?.interactive)} bind:this={cover}></div>
	<div class="tour-card" role="dialog" aria-live="polite" bind:this={card}>
		<div class="tour-top">
			<span class="tour-progress">{step ? `${step.number} of ${step.count}` : ''}</span>
			<button type="button" class="button link squish" onclick={onSkip}>Skip tour</button>
		</div>
		<h2 class="tour-title">{step?.title ?? ''}</h2>
		<p class="tour-text">{step?.text ?? ''}</p>
		<div class="tour-actions">
			{#if step?.canGoBack}<button type="button" class="button squish" onclick={onBack}>Back</button>{/if}
			<button type="button" class="button primary squish" onclick={onNext}>{step?.nextLabel ?? 'Next'}</button>
		</div>
	</div>
</div>

<style>
	/* A dimmed screen with spotlights, and a card explaining them. The layer itself lets
	   touches through: its panels (and the card) are what catch them. */
	.tour {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* Catch every touch around the spotlight (and over it, unless the step is interactive). */
	.tour-block {
		position: absolute;
		pointer-events: auto;
	}

	/* The dimming: the whole screen, with a rounded hole cut out for each spotlight
	   (redrawn every frame, following the spotlights). */
	.tour-dim {
		position: absolute;
		inset: 0;
		background: var(--tour-dim);
		pointer-events: none;
	}

	/* A spotlight (made in code, hence :global): exactly the box of what it lights, with
	   the same corners. It glides from one target to the next with a soft bounce. */
	.tour :global(.tour-spot) {
		position: absolute;
		pointer-events: none;
		transition: left .6s var(--spring-soft), top .6s var(--spring-soft), width .6s var(--spring-soft),
			height .6s var(--spring-soft), border-radius .6s var(--spring-soft);
	}

	/* Its outline, in the tour's colour, drawn over the thing's own border (as thick as it,
	   --spot-border). */
	.tour :global(.tour-spot::before) {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		border: var(--spot-border, .3rem) solid var(--tour-outline);
	}

	/* Arriving at a new target: the outline pops. */
	.tour :global(.tour-spot.arriving::before) {
		animation: tour-arrive .6s var(--spring) both;
	}

	.tour.no-target :global(.tour-spot::before) {
		display: none;
	}

	@keyframes tour-arrive {
		from { transform: scale(1.08); opacity: 0; }
	}

	/* The card: like a toast, a little bigger. It glides beside each new target, and its
	   contents rise in. */
	.tour-card {
		position: absolute;
		width: 27rem;
		padding: 2rem 2.25rem 1.5rem;
		border: .3rem solid var(--tour-outline);
		border-radius: 2rem;
		background: var(--surface);
		color: var(--text);
		transition: left .6s var(--spring-soft), top .6s var(--spring-soft);
		pointer-events: auto;
		--rise: .8rem;
	}

	.tour-card:global(.arriving) > * {
		animation: rise-in .5s ease-out both;
	}

	.tour-card:global(.arriving) > :nth-child(2) { animation-delay: 40ms; }
	.tour-card:global(.arriving) > :nth-child(3) { animation-delay: 80ms; }
	.tour-card:global(.arriving) > :nth-child(4) { animation-delay: 120ms; }

	/* "3 of 11" on the left, "Skip tour" on the right. */
	.tour-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 1.3rem;
		color: var(--text-soft);
	}

	.tour-top .button.link {
		height: auto;
		padding: .25rem 0;
		font-size: 1.3rem;
	}

	.tour-title {
		margin: .25rem 0 .75rem;
		font-size: 2.25rem;
	}

	.tour-text {
		margin: 0;
		font-size: 1.6rem;
		line-height: 1.45;
	}

	/* Back and Next, at the bottom right. */
	.tour-actions {
		display: flex;
		justify-content: flex-end;
		gap: .75rem;
		margin-top: 1.75rem;
	}

	.tour-actions .button {
		height: 4.25rem;
		padding: 0 1.75rem;
		font-size: 1.6rem;
	}

	/* Showing the first step: everything goes straight into place (nothing glides in from nowhere). */
	.tour.starting :global(.tour-spot),
	.tour.starting .tour-card {
		transition: none;
	}

	/* The header's buttons pop one after another (header.svelte's flare()). */
	:global(.tour-pop) {
		animation: tour-pop .6s var(--spring) backwards; /* not "both": once done, it lets go (the buttons squish again) */
		animation-delay: var(--pop-delay, 0ms);
	}

	@keyframes -global-tour-pop {
		40% { transform: scale(1.18); }
	}
</style>
