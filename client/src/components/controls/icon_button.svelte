
<!--
	Icon button: a square button with an icon, in the theme's own colours (or in a
	habit colour). Styles: .icon-button in styles/controls.css.

	Props:
		icon       icon name
		ariaLabel  spoken name
		color      'plain' (the theme's colours, the default) or a habit colour like 'mint'
		small      the smaller size (month arrows)
		active     pressed (aria-pressed; e.g. the view on screen, see view_button.svelte)
		disabled
		class      extra classes
		ring       its border as a timeout ring (controls/timeout_ring.js): 0 to 1 drawn, null = none
		onTap      gets the button element (pop-ups grow out of it)
		element    the button (bindable, e.g. for the tour to point at)
-->

<script>
	import Icon from './icon.svelte';
	import { timeoutRing } from './timeout_ring.js';

	let {
		icon, ariaLabel, color = 'plain', small = false, active = false, disabled = false,
		class: className = '', ring = null, onTap, element = $bindable(), children,
	} = $props();
</script>

<button type="button" class="icon-button c-{color} squish {className}" class:small {disabled}
	aria-label={ariaLabel} aria-pressed={active} bind:this={element} use:timeoutRing={ring} onclick={() => onTap?.(element)}>
	{#if icon}<Icon name={icon} />{/if}
	{@render children?.()}
</button>
