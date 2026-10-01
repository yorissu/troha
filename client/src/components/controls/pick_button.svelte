
<!--
	Pick button: a filled pill with an icon and a value, e.g. a date or a time.
	Tapping it opens the pop-up where the value is picked. (Styles: .pick-button in
	styles/controls.css.)

	Props:
		icon     icon name, e.g. 'calendar' or 'clock'
		label    the value shown
		onTap    gets the button element (the pop-up grows out of it)
		element  the button (bindable)
-->

<script>
	import Icon from './icon.svelte';

	let { icon, label, onTap, element = $bindable() } = $props();
</script>

<button type="button" class="pill pick-button squish" bind:this={element} onclick={() => onTap(element)}>
	<Icon name={icon} />
	<span class="button-label">{label}</span>
</button>
