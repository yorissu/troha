
<!--
	Pill row: a row of choice pills, the chosen ones filled. For one choice (e.g.
	Repeat in the habit editor) or several at once (Days).
	Its owner decides what a tap means. (Styles: .pill-row and .pill in styles/controls.css.)

	Props:
		pills    [{ label, selected, onTap }]
		element  the row (bindable, e.g. to mark it as missing with markInvalid)
-->

<script>
	let { pills, element = $bindable() } = $props();
</script>

<div class="pill-row" bind:this={element}>
	{#each pills as pill (pill.label)}
		<button type="button" class="pill squish" class:selected={pill.selected} aria-pressed={pill.selected} onclick={pill.onTap}>
			{pill.label}
		</button>
	{/each}
</div>
