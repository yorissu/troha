
<!--
	Today view: a grid of habit cards that always fits the screen. With many habits,
	there are 4 columns instead of 3, and the rows (and their text) shrink to fit.

	Props:
		items         [{ id, colorClass, name, schedule, hidden, done }], in order
		emptyMessage  shown when there are no items
		layout        { threeColumnLimit, minRows }
		onCardTap     gets the tapped card's handle (see habit_card.svelte)
-->

<script>
	import HabitCard from './habit_card.svelte';

	let { items, emptyMessage, layout, onCardTap } = $props();

	const cards = $state({}); // habit id -> its HabitCard
	const columns = $derived(items.length > layout.threeColumnLimit ? 4 : 3);
	const rows = $derived(Math.max(layout.minRows, Math.ceil(items.length / columns)));

	/** The celebration wave: every card hops, one after another. */
	export function cheer() {
		for (const item of items) cards[item.id]?.cheer();
	}

	/** Easter egg: every card giggles, each starting at a slightly different moment. */
	export function tickle() {
		for (const item of items) cards[item.id]?.tickle(Math.round(Math.random() * 160));
	}

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

<section class="view today-view" bind:this={root}>
	{#if items.length}
		<div class="habit-grid" style:--cols={columns} style:--rows={rows}>
			{#each items as item, index (item.id)}
				<HabitCard {item} {index} onTap={onCardTap} bind:this={cards[item.id]} />
			{/each}
		</div>
	{:else}
		<p class="empty">{emptyMessage}</p>
	{/if}
</section>

<style>
	.habit-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
		grid-template-rows: repeat(var(--rows, 7), minmax(0, 1fr));
		gap: 1.375rem;
		--rise: 1rem; /* cards rise in (habit_card.svelte): under the gap ÷ 1.3, so they never overlap */
	}
</style>
