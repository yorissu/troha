
<!--
	Confetti: pastel pieces that shoot up from the bottom and fall back down, set
	off through services/confetti.js. Pieces use the habit colours' outline colour.
-->

<script>
	import { onMount } from 'svelte';
	import { config } from '../../config.js';
	import { confetti } from '../../services/confetti.js';

	let element;

	onMount(() => {
		confetti.setLayer({ burst });
		return () => confetti.setLayer(null);
	});

	/**
	 * @param {string[]} [burstColors] Habit colour names for this burst (default: all of them).
	 * @param {number} [count] How many pieces.
	 */
	function burst(burstColors = config.colors, count = 80) {
		const { width, height } = element.getBoundingClientRect();
		for (let i = 0; i < count; i++) {
			const piece = document.createElement('span');
			piece.className = `confetti-piece c-${burstColors[i % burstColors.length]}${i % 3 === 0 ? ' round' : ''}`;
			piece.style.left = `${width * (0.25 + Math.random() * 0.72)}px`;
			piece.style.top = `${height + 20}px`;
			element.append(piece);

			const drift = (Math.random() - 0.5) * width * 0.3;
			const rise = -height * (0.5 + Math.random() * 0.45);
			const spin = (Math.random() - 0.5) * 1080;
			const flight = piece.animate([
				{ transform: 'translate(0, 0) rotate(0deg)', easing: 'cubic-bezier(.15, .75, .4, 1)' },
				{ transform: `translate(${drift * 0.6}px, ${rise}px) rotate(${spin / 2}deg)`, offset: 0.42, easing: 'cubic-bezier(.5, 0, .9, .6)' },
				{ transform: `translate(${drift}px, 60px) rotate(${spin}deg)` },
			], { duration: 2000 + Math.random() * 1200, delay: Math.random() * 300 });
			flight.onfinish = () => piece.remove();
		}
	}
</script>

<div class="confetti" aria-hidden="true" bind:this={element}></div>

<style>
	/* A layer over the whole stage. */
	.confetti {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}

	/* The pieces are made in code, so these styles are global (their class names are their own). */
	.confetti :global(.confetti-piece) {
		position: absolute;
		width: 1rem;
		height: 1.5rem;
		border-radius: .3rem;
		background: var(--c-edge); /* habit colours, so it follows the theme */
	}

	.confetti :global(.confetti-piece.round) {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
	}
</style>
