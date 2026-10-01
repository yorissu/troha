
<!--
	Cycle button: a round button that steps through a few choices (e.g. Light, Dark,
	Auto) and shows the current one's icon, spinning it in on each change. What the
	choices mean is up to its owner. It can carry a countdown on its border (timeLeft;
	the screen button does).

	Its size and colours come from CSS variables, so owners can restyle it:
	--cycle-size, --cycle-fill, --cycle-text (and --timeout-color for the countdown).

	Props:
		name      spoken name, e.g. "Theme"
		icons     choice -> icon name
		choice    the current choice
		label     how the current choice is called, e.g. "Auto"
		timeLeft  the border's countdown: 1 = full, 0 = empty, null = none
		onTap
		element   the button (bindable)
-->

<script>
	import Icon from './icon.svelte';
	import { timeoutRing } from './timeout_ring.js';

	let { name, icons, choice, label, timeLeft = null, onTap, element = $bindable() } = $props();
</script>

<button type="button" class="cycle-button squish" aria-label="{name}: {label}" bind:this={element}
	use:timeoutRing={timeLeft} onclick={onTap}>
	{#key choice}
		<Icon name={icons[choice]} class="cycle-icon" />
	{/key}
</button>

<style>
	.cycle-button {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--cycle-size, 5.5rem);
		height: var(--cycle-size, 5.5rem);
		border-radius: 50%;
		background: var(--cycle-fill, var(--panel-button));
		color: var(--cycle-text, var(--panel-text));
	}

	.cycle-button :global(.cycle-icon) {
		width: 3rem;
		height: 3rem;
		animation: spin-in .6s var(--spring) both;
	}
</style>
