
<!--
	Month bar: ‹ September 2026 ›, for the Calendar and the date picker. It only
	shows a month; its owner decides which one (onShift reports the arrows), and may
	put more into the bar after the arrows (the Calendar adds its streak and the
	button that turns its days round).
	Sizes and spacing come from the owner (its `class`).

	Props:
		month       a Date in the month to show
		locale
		canGoBack   false greys out the back arrow
		onShift     an arrow was tapped: -1 back, 1 on
		class       the owner's class, e.g. 'calendar-bar'
		children    more for the bar
-->

<script>
	import { formatDate } from '../../core/dates.js';
	import IconButton from './icon_button.svelte';

	let { month, locale, canGoBack = true, onShift, class: className = '', children } = $props();
</script>

<div class="month-bar {className}">
	<IconButton icon="chevron_left" small ariaLabel="Previous month" disabled={!canGoBack} onTap={() => onShift(-1)} />
	<div class="month-label">{formatDate(month, locale, 'monthYear')}</div>
	<IconButton icon="chevron_right" small ariaLabel="Next month" onTap={() => onShift(1)} />
	{@render children?.()}
</div>

<style>
	.month-bar {
		display: flex;
		align-items: center;
	}

	.month-label {
		font-weight: 500;
		text-align: center;
	}
</style>
