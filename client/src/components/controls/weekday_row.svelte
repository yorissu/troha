
<!--
	The weekday names in a row (a 7-column grid), to go above a month's days.

	Props:
		dayNames  short weekday names, Monday first
		class     the owner's class, e.g. 'calendar-weekdays' (sizes and spacing)
-->

<script>
	let { dayNames, class: className = '' } = $props();
</script>

<div class="weekday-row {className}">
	{#each dayNames as name, i (i)}<div>{name}</div>{/each}
</div>

<style>
	.weekday-row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		color: var(--text-soft);
		text-align: center;
	}
</style>
