
<!--
	Manage view: every habit as a card, in a grid like Today's; tapping a card opens
	it for editing. Each card shows the habit's name, its week (a bar per weekday,
	filled on the days it's on), and small tags for anything out of the ordinary
	(e.g. "every 2 weeks", "starts tomorrow", "high priority", "hidden").

	Props:
		items         [{ id, colorClass, name, hidden (shown as a blank bar), schedule, days, tags }]
		              days: ISO weekdays (1 = Monday); schedule: the same as text
		dayLetters    weekday initials, Monday first (under the week bars)
		emptyMessage  shown when there are no items
		onCardTap     gets the habit's id and the card element
-->

<script>
	let { items, dayLetters, emptyMessage, onCardTap } = $props();

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

<section class="view manage-view" bind:this={root}>
	{#if items.length}
		<div class="manage-grid scroll-area">
			{#each items as item, index (item.id)}
				<button type="button" class="manage-card {item.colorClass} squish" style:--delay="{index * 30}ms"
					aria-label={[item.hidden ? 'Hidden habit' : item.name, item.schedule, ...item.tags].join(', ')}
					onclick={(event) => onCardTap(item.id, event.currentTarget)}>
					{#if item.hidden}
						<span class="redacted"></span>
					{:else}
						<span class="manage-name">{item.name}</span>
					{/if}
					{#if item.tags.length}
						<span class="manage-tags">
							{#each item.tags as tag (tag)}<span class="manage-tag">{tag}</span>{/each}
						</span>
					{/if}
					<!-- The week: a bar per weekday, Monday first, filled on the habit's days; its initial under each. -->
					<span class="week-strip" aria-hidden="true">
						{#each dayLetters as letter, i (i)}
							<span class="week-day" class:on={item.days.includes(i + 1)}><span class="week-bar"></span>{letter}</span>
						{/each}
					</span>
				</button>
			{/each}
		</div>
	{:else}
		<p class="empty">{emptyMessage}</p>
	{/if}
</section>

<style>
	/* A scroll area (styles/layout.css). */
	.manage-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-content: start;
		gap: 1.375rem;           /* as on Today */
		--rise: 1rem;            /* cards rise in: under the gap ÷ 1.3, so they never overlap */
		--bounce-room: .5rem;    /* room above for the first row's bounce */
		padding-bottom: 1rem;
	}

	/* Name on top, then any tags; the week sits at the bottom, so the weeks of a row line up. */
	.manage-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
		min-width: 0;
		padding: 1.75rem 2rem 1.5rem;
		border-radius: var(--radius);
		background: var(--c-fill);
		color: var(--c-text);
		text-align: left;
		animation: rise-in .55s ease-out both;
		animation-delay: var(--delay, 0ms);
	}

	/* Up to two lines, then "…". */
	.manage-name {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		font-size: 1.875rem;
		font-weight: 500;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.manage-card .redacted {
		width: 60%;
		height: 1.6rem;
		margin: .6rem 0;
	}

	/* Tags: what's out of the ordinary (every 2 weeks, starts later, hidden…). */
	.manage-tags {
		display: flex;
		flex-wrap: wrap;
		gap: .5rem;
	}

	.manage-tag {
		padding: .2rem .8rem;
		border-radius: .75rem;
		background: color-mix(in srgb, var(--c-soft) 14%, transparent);
		color: var(--c-soft);
		font-size: 1.3rem;
	}

	/* The week: a bar per weekday, filled on the habit's days, with the day's initial under it.
	   The soft text colour reads on every habit fill in both themes. */
	.week-strip {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: .6rem;
		width: 100%;
		margin-top: auto;
	}

	.week-day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: .35rem;
		font-size: 1.2rem;
		color: color-mix(in srgb, var(--c-soft) 55%, transparent);
	}

	.week-bar {
		width: 100%;
		height: .7rem;
		border-radius: .35rem;
		background: color-mix(in srgb, var(--c-soft) 20%, transparent);
	}

	.week-day.on { color: var(--c-soft); font-weight: 500; }
	.week-day.on .week-bar { background: var(--c-soft); }
</style>
