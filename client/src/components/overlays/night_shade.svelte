
<!--
	Night shade: a dark layer over the whole stage. Dimmed, it lets taps through;
	blank (fully black), it catches the first tap so waking the screen can't tick
	a habit by accident.

	Props:
		dim     how much darker, from 0 (not at all) to 1 (black)
		blank   fully black, catching taps
		onWake  a tap woke a blank screen
-->

<script>
	const WAKE_MS = 600; // length of the fade back in; taps stay caught until it's done

	let { dim, blank, onWake } = $props();

	let waking = $state(false);
	let wasBlank = false;
	let timer;

	// Waking: keep catching taps while it fades, so the rest of the waking tap lands here too.
	$effect.pre(() => {
		if (wasBlank && !blank) {
			waking = true;
			clearTimeout(timer);
			timer = setTimeout(() => { waking = false; }, WAKE_MS);
		}
		wasBlank = blank;
	});
</script>

<div class="night-shade" class:blank class:waking aria-hidden="true" style:opacity={blank ? 1 : dim}
	onpointerdown={(event) => {
		if (!blank) return;
		event.preventDefault();
		onWake();
	}}></div>

<style>
	/* Black over everything, as dark as its opacity. */
	.night-shade {
		position: absolute;
		inset: 0;
		z-index: 1; /* over everything, even the server-down pop-up */
		background: #000;
		opacity: var(--start-dim, 0); /* as dim as last time (first_look.js), so it doesn't fade in on a reload */
		pointer-events: none;
		transition: opacity 2s ease;
	}

	/* Going black is slow and gentle; waking up is quick. */
	.night-shade.blank {
		transition-duration: 4s;
	}

	.night-shade.waking {
		transition-duration: .6s;
	}

	.night-shade.blank,
	.night-shade.waking {
		pointer-events: auto;
	}

	/* Until the shade exists, the whole window is as dim as last time (first_look.js). */
	:global(body:not(:has(.night-shade))::after) {
		content: "";
		position: fixed;
		inset: 0;
		background: #000;
		opacity: var(--start-dim, 0);
		pointer-events: none;
	}
</style>
