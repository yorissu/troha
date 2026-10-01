<!--
	View button: an icon button for going to a view (the header's row). Being the
	view on screen is shown by an outline that draws itself round the border as a
	ring, quickly, and retracts just as quickly once another view is picked.

	It can also fill its ring slowly toward being selected (`progress`), e.g. while
	the page is about to come back to its view by itself; tapped then, the ring
	carries on from there, and if the progress falls back (a touch), it retracts quickly.

	Props:
		icon, ariaLabel, disabled, onTap, element (bindable), children: as an icon button
		selected   its view is on screen
		progress   0 to 1: how far toward being selected by itself; null = not on its way
-->

<script>
	import IconButton from './icon_button.svelte';

	let { icon, ariaLabel, selected = false, progress = null, disabled = false, onTap, element = $bindable(), children } = $props();

	// The slow glide only while the progress rises; when it falls back, it retracts
	// quickly like a deselected button. (A plain variable: only the last value is kept.)
	let lastProgress = null;
	const rising = $derived.by(() => {
		const up = progress !== null && lastProgress !== null && progress >= lastProgress;
		lastProgress = progress;
		return up;
	});
	const ring = $derived(selected ? 1 : progress ?? 0);
</script>

<IconButton {icon} {ariaLabel} active={selected} {disabled} {onTap} bind:element
	class="view-button {!selected && progress !== null && rising ? 'filling' : ''}" {ring}>
	{@render children?.()}
</IconButton>

<style>
	/* The outline is the ring (controls/timeout_ring.js), in the selected outline's
	   colour, with no faint track behind it. */
	:global(.icon-button.view-button) {
		--timeout-color: var(--c-edge);
	}

	:global(.icon-button.view-button.timing) {
		border-color: transparent;
	}

	/* Selected or not: it draws itself, or retracts, quickly. While filling by itself (a
	   little every second) it keeps the ring's usual one-second glide. */
	:global(.icon-button.view-button:not(.filling) .timeout-fill) {
		transition: stroke-dashoffset .35s ease-out;
	}
</style>
