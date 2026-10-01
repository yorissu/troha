<!--
	Notices view: a scrollable list of notices, each a card for as long as it applies,
	e.g. "License ends in 3 days" (services/notices.svelte.js; the view's button gets
	a dot meanwhile).
-->

<script>
	import { notices } from '../../services/notices.svelte.js';
	import Icon from '../controls/icon.svelte';

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

<section class="view notices-view scroll-area section-list" bind:this={root}>
	{#each notices.items as item, index (item.id)}
		<div class="settings-section notice tone-{item.tone}" class:leaving={item.leaving} style:--i={index} role="status">
			<Icon name="warning" class="notice-icon" />
			<span class="notice-text">
				<span class="notice-message">{item.message}</span>
				{#if item.detail}<span class="note">{item.detail}</span>{/if}
			</span>
		</div>
	{:else}
		<p class="empty">Nothing needs your attention.</p>
	{/each}
</section>

<style>
	.notice {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
	}

	/* The warning icon: amber while something is coming up, red once it has gone wrong. */
	.notice :global(.notice-icon) {
		flex-shrink: 0;
		width: 3.5rem;
		height: 3.5rem;
		stroke-width: 2.4;
	}

	.notice.tone-warning :global(.notice-icon) { color: var(--peach-edge); }
	.notice.tone-error :global(.notice-icon) { color: var(--error); }

	.notice-text { display: flex; flex-direction: column; gap: .25rem; }
	.notice-text .note { margin: 0; }
	.notice-message { font-size: 2.5rem; font-weight: 500; line-height: 1.3; }

	/* No longer applies: fades away. */
	.notice.leaving { opacity: 0; }
</style>
