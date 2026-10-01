
<!--
	Lock button, for hidden habits: Set PIN / Unlock / Lock. While they're unlocked,
	its border shows how long until "Lock them?" is asked.

	Props:
		state     'set' (no PIN yet), 'locked' or 'open'
		timeLeft  the border's countdown: 1 = full, 0 = empty, null = none
		disabled
		onTap     gets the button element
		element   the button (bindable)
-->

<script>
	import Icon from './icon.svelte';
	import { timeoutRing } from './timeout_ring.js';

	const ICONS = { set: 'lock_set', locked: 'lock', open: 'lock_open' };
	const LABELS = { set: 'Set PIN', locked: 'Show hidden habits', open: 'Lock hidden habits' };

	let { state, timeLeft = null, disabled = false, onTap, element = $bindable() } = $props();
</script>

<button type="button" class="icon-button c-plain lock-button squish" aria-label={LABELS[state]} {disabled} bind:this={element}
	use:timeoutRing={timeLeft} onclick={() => onTap(element)}>
	{#key state}
		<Icon name={ICONS[state]} class="lock-icon" />
	{/key}
</button>

<style>
	.lock-button {
		--timeout-color: var(--c-soft);
	}

	.lock-button :global(.lock-icon) {
		animation: spin-in .5s var(--spring) both;
	}
</style>
